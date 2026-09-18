import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

// 업체품목(SYS-06) — 업체가 부르는 품목명을 모아 두고, 원방 품목과 잇는다(매핑은 2단계).
// 엑셀 「품목관리」·「신규품목확인」을 대신한다.
const router = Router();

function fail(res, e) {
  const status = e.status ?? 500;
  if (status === 500) console.error('[vendor-item]', e.message);
  res.status(status).json({ error: status === 500 ? '처리하지 못했습니다.' : e.message });
}

// 업체별 품목 수 — 왼쪽 매각처 목록이 쓴다.
router.get('/vendors', async (req, res) => {
  try {
    const groups = await prisma.vendorItem.groupBy({ by: ['vendorId'], _count: { _all: true } });
    const vendors = await prisma.vendor.findMany({
      where: { id: { in: groups.map((g) => g.vendorId) } },
      select: { id: true, name: true },
    });
    const items = await prisma.vendorItem.findMany({ select: { vendorId: true, series: true } });
    const rows = vendors.map((v) => {
      const mine = items.filter((i) => i.vendorId === v.id);
      const kinds = [...new Set(mine.map((i) => i.series).filter(Boolean))];
      return {
        vendorId: v.id,
        vendorName: v.name,
        itemCount: mine.length,
        // 계열이 여럿이면 가장 많은 것 뒤에 「외」를 붙인다 — 「STS 외」처럼.
        seriesLabel: kinds.length > 1 ? `${kinds[0]} 외` : (kinds[0] ?? '-'),
      };
    });
    rows.sort((a, b) => b.itemCount - a.itemCount);
    res.json(rows);
  } catch (e) {
    fail(res, e);
  }
});

router.get('/', async (req, res) => {
  try {
    const { vendorId, q, includeInactive } = req.query;
    const rows = await prisma.vendorItem.findMany({
      where: {
        ...(vendorId ? { vendorId } : {}),
        ...(includeInactive === '1' ? {} : { isActive: true }),
        ...(q ? { vendorItemName: { contains: q, mode: 'insensitive' } } : {}),
      },
      include: { vendor: { select: { id: true, name: true } } },
      orderBy: [{ vendorId: 'asc' }, { vendorItemName: 'asc' }],
    });
    res.json(
      rows.map((r) => ({
        id: r.id,
        vendorId: r.vendorId,
        vendorName: r.vendor.name,
        vendorItemName: r.vendorItemName,
        series: r.series,
        repItemName: r.repItemName,
        itemCode: r.itemCode,
        definition: r.definition,
        isActive: r.isActive,
      })),
    );
  } catch (e) {
    fail(res, e);
  }
});

// 미매핑 — 원방 품목과 아직 잇지 않은 품목 수. 2단계 출고 단가 자동제안이 이것을 기다린다.
router.get('/unmapped', async (req, res) => {
  try {
    const [total, mapped] = await Promise.all([
      prisma.vendorItem.count(),
      prisma.vendorItem.count({ where: { NOT: { itemCode: null } } }),
    ]);
    res.json({ total, mapped, unmapped: total - mapped });
  } catch (e) {
    fail(res, e);
  }
});

router.post('/', async (req, res) => {
  try {
    const { vendorId, vendorItemName } = req.body;
    if (!vendorId || !vendorItemName) {
      throw Object.assign(new Error('업체와 품목명은 필수입니다.'), { status: 400 });
    }
    const dup = await prisma.vendorItem.findFirst({ where: { vendorId, vendorItemName } });
    if (dup) throw Object.assign(new Error('그 업체에 같은 이름의 품목이 이미 있습니다.'), { status: 400 });
    const row = await prisma.vendorItem.create({
      data: {
        vendorId,
        vendorItemName,
        series: req.body.series ?? null,
        repItemName: req.body.repItemName ?? vendorItemName,
        itemCode: req.body.itemCode ?? null,
        definition: req.body.definition ?? null,
        createdById: req.appUser?.id ?? null,
      },
    });
    res.status(201).json(row);
  } catch (e) {
    fail(res, e);
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { vendorItemName, series, repItemName, itemCode, definition, isActive } = req.body;
    const row = await prisma.vendorItem.update({
      where: { id: req.params.id },
      data: {
        ...(vendorItemName ? { vendorItemName } : {}),
        ...(series !== undefined ? { series } : {}),
        ...(repItemName !== undefined ? { repItemName } : {}),
        ...(itemCode !== undefined ? { itemCode: itemCode || null } : {}),
        ...(definition !== undefined ? { definition } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
    });
    res.json(row);
  } catch (e) {
    fail(res, e);
  }
});

// 단가가 한 건이라도 쌓인 품목은 지우지 않는다 — 이력이 끊긴다.
router.delete('/:id', async (req, res) => {
  try {
    const used = await prisma.vendorPrice.count({ where: { vendorItemId: req.params.id, deletedAt: null } });
    if (used) throw Object.assign(new Error(`단가 ${used}건이 쌓인 품목이라 지울 수 없습니다.`), { status: 400 });
    await prisma.vendorItem.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) {
    fail(res, e);
  }
});

// 이름이 같은 원방 품목을 한 번에 이어 준다(검토의견 ⑤ — 같은 이름은 자동, 다른 것만 손으로).
router.post('/automap', async (req, res) => {
  try {
    const items = await prisma.vendorItem.findMany({ where: { itemCode: null } });
    const masters = await prisma.itemMaster.findMany({ select: { itemCode: true, itemName: true } });
    const byName = new Map(masters.map((m) => [m.itemName.replace(/\s/g, ''), m.itemCode]));
    let count = 0;
    for (const item of items) {
      const hit = byName.get(item.vendorItemName.replace(/\s/g, ''));
      if (!hit) continue;
      await prisma.vendorItem.update({ where: { id: item.id }, data: { itemCode: hit } });
      count += 1;
    }
    res.json({ count });
  } catch (e) {
    fail(res, e);
  }
});

export default router;
