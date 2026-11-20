import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma.js';
import { toISO, kstDayString } from '../lib/date.js';
import { dayOf, getSettings, summarize, upsertPrice } from '../lib/pricing.js';
import { applyImport, parseWorkbook, planImport } from '../lib/priceImport.js';

// 단가관리 — 최신단가·조회·입력. 엑셀 「최신단가」·「단가조회」·「단가이력」을 대신한다.
// 접근 권한은 아직 걸지 않는다. 메뉴별 권한이 확정되면 이 라우터 한 줄에 미들웨어를 더한다.
const router = Router();

function fail(res, e) {
  // 같은 날 · 같은 품목 · 같은 구분은 한 건만 산다. 그 제약에 걸린 것이면 까닭을 그대로 알려 준다.
  if (e.code === 'P2002') {
    return res.status(400).json({ error: '그 날짜에 같은 구분의 단가가 이미 있습니다. 그 줄을 고쳐 주세요.' });
  }
  const status = e.status ?? 500;
  if (status === 500) console.error('[price]', e.message);
  res.status(status).json({ error: status === 500 ? '처리하지 못했습니다.' : e.message });
}

const bad = (msg) => Object.assign(new Error(msg), { status: 400 });

// 최신단가 현황(PRC-01) — 업체×품목마다 가장 최근 단가 한 줄.
// 엑셀은 배열수식 수백 개로 만들던 화면이다. 여기서는 한 번 읽어 한 번에 계산한다.
// 출고 실적에서 단가를 확정해 단가 내역으로 올린다 (요청 2026-11-13).
//
// 출고를 적고 입금까지 받은 건은 단가가 확정된 것이므로, 그 값을 단가 내역에
// 그대로 넣는다. 같은 날짜·같은 업체·같은 품목이 겹치면 나중에 넣은 것을 남긴다.
// 올리기 전에 무엇이 들어가고 무엇이 빠지는지 먼저 보여 준다.
async function collectConfirmable({ from, to, projectId }) {
  const range = {};
  if (from) range.gte = toISO(from);
  if (to) range.lte = toISO(`${to} 23:59:59`);

  const rows = await prisma.outboundSale.findMany({
    where: {
      deletedAt: null,
      isPaid: true, // 입금이 끝난 건만 확정으로 본다
      NOT: { unitPrice: null },
      ...(projectId ? { projectId } : {}),
      ...(Object.keys(range).length ? { outboundDate: range } : {}),
    },
    include: { buyer: { select: { id: true, name: true } }, item: { select: { itemCode: true, itemName: true } } },
    orderBy: [{ outboundDate: 'asc' }, { createdAt: 'asc' }],
  });

  // 같은 날짜·업체·품목은 하나로 — 나중 것이 이긴다.
  const picked = new Map();
  const dropped = [];
  for (const r of rows) {
    if (!r.buyerId || !r.itemCode || Number(r.unitPrice) <= 0) {
      dropped.push({ id: r.id, 사유: !r.buyerId ? '거래처 없음' : !r.itemCode ? '품목 없음' : '단가 0' });
      continue;
    }
    const day = kstDayString(r.outboundDate);
    const key = `${r.buyerId}::${r.itemCode}::${day}`;
    if (picked.has(key)) dropped.push({ id: picked.get(key).id, 사유: '같은 날짜·업체·품목 중복 (나중 것을 남김)' });
    picked.set(key, {
      id: r.id,
      key,
      vendorId: r.buyerId,
      vendorName: r.buyer?.name ?? null,
      itemCode: r.itemCode,
      itemName: r.item?.itemName ?? null,
      day,
      price: Number(r.unitPrice),
    });
  }
  return { rows: [...picked.values()], dropped };
}

router.get('/confirmable', async (req, res) => {
  const { rows, dropped } = await collectConfirmable(req.query);
  res.json({ rows, dropped, 올릴것: rows.length, 뺀것: dropped.length });
});

router.post('/confirm', async (req, res) => {
  try {
    const { rows } = await collectConfirmable(req.body ?? {});
    const only = Array.isArray(req.body?.keys) ? new Set(req.body.keys) : null;
    const target = only ? rows.filter((r) => only.has(r.key)) : rows;

    let added = 0;
    let updated = 0;
    for (const r of target) {
      // 거래처 품목이 없으면 만들어 둔다 — 단가는 거래처 품목에 붙는다.
      let vi = await prisma.vendorItem.findFirst({ where: { vendorId: r.vendorId, itemCode: r.itemCode } });
      if (!vi) {
        vi = await prisma.vendorItem.create({
          data: { vendorId: r.vendorId, itemCode: r.itemCode, vendorItemName: r.itemName ?? r.itemCode },
        });
      }
      const existing = await prisma.vendorPrice.findFirst({
        where: { vendorItemId: vi.id, priceType: '실제', effectiveDate: toISO(r.day), deletedAt: null },
      });
      if (existing) {
        await prisma.vendorPrice.update({ where: { id: existing.id }, data: { price: r.price } });
        updated += 1;
      } else {
        await prisma.vendorPrice.create({
          data: { vendorItemId: vi.id, priceType: '실제', price: r.price, effectiveDate: toISO(r.day) },
        });
        added += 1;
      }
    }
    res.json({ ok: true, 추가: added, 수정: updated });
  } catch (e) {
    console.error('[price/confirm]', e.message);
    res.status(500).json({ error: '단가를 올리지 못했습니다.' });
  }
});

// 거래처와 품목을 고르면 그 조합의 가장 최근 단가를 돌려준다(요청 2026-11-13).
// 출고를 적을 때 제품명을 고르면 이 값을 끌어와 채운다 — 다르면 고쳐 쓰면 된다.
// 「실제」 단가를 먼저 보고, 없으면 「참고」라도 준다. 어느 쪽인지 함께 알려 준다.
router.get('/recent', async (req, res) => {
  const { vendorId, itemCode } = req.query;
  if (!vendorId || !itemCode) {
    return res.status(400).json({ error: 'vendorId와 itemCode가 필요합니다.' });
  }

  const pick = async (priceType) =>
    prisma.vendorPrice.findFirst({
      where: {
        deletedAt: null,
        ...(priceType ? { priceType } : {}),
        vendorItem: { vendorId, itemCode },
      },
      orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
      include: { vendorItem: { select: { vendorItemName: true } } },
    });

  const row = (await pick('실제')) ?? (await pick(null));
  if (!row) return res.json({ found: false });

  res.json({
    found: true,
    price: Number(row.price),
    priceType: row.priceType,
    effectiveDate: row.effectiveDate,
    vendorItemName: row.vendorItem?.vendorItemName ?? null,
  });
});

router.get('/latest', async (req, res) => {
  try {
    const { series, vendorId, priceType, q } = req.query;
    const asOf = req.query.asOf ? dayOf(req.query.asOf) : dayOf(new Date());
    const s = await getSettings();

    const items = await prisma.vendorItem.findMany({
      where: {
        ...(series ? { series } : {}),
        ...(vendorId ? { vendorId } : {}),
        ...(q
          ? {
              OR: [
                { vendorItemName: { contains: q, mode: 'insensitive' } },
                { vendor: { name: { contains: q, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: { vendor: { select: { id: true, name: true } } },
    });

    const prices = await prisma.vendorPrice.findMany({
      where: { deletedAt: null, effectiveDate: { lte: new Date(`${asOf}T23:59:59.999Z`) } },
      orderBy: { effectiveDate: 'asc' },
    });
    const byItem = new Map();
    for (const p of prices) {
      if (!byItem.has(p.vendorItemId)) byItem.set(p.vendorItemId, []);
      byItem.get(p.vendorItemId).push(p);
    }

    let rows = items.map((item) => {
      const sum = summarize(byItem.get(item.id) ?? [], asOf, s);
      return {
        vendorItemId: item.id,
        vendorId: item.vendorId,
        vendorName: item.vendor.name,
        vendorItemName: item.vendorItemName,
        series: item.series,
        repItemName: item.repItemName,
        itemCode: item.itemCode,
        price: sum?.latest.price ?? null,
        isFree: sum?.latest.isFree ?? false,
        priceType: sum?.latest.priceType ?? null,
        effectiveDate: sum?.latest.date ?? null,
        prevPrice: sum?.prev?.price ?? null,
        delta: sum?.delta ?? null,
        deltaRate: sum?.deltaRate ?? null,
        lastRealDate: sum?.lastRealDate ?? null,
        warn: sum?.warn ?? { days: null, level: 'none', label: '거래 없음' },
      };
    });
    if (priceType) rows = rows.filter((r) => r.priceType === priceType);
    rows.sort((a, b) =>
      a.vendorName === b.vendorName
        ? a.vendorItemName.localeCompare(b.vendorItemName, 'ko')
        : a.vendorName.localeCompare(b.vendorName, 'ko'),
    );

    // 위쪽 요약 카드 — 화면에서 다시 세지 않도록 서버가 함께 준다.
    const [vendorCount, itemCount, priceCounts, lastNotice] = await Promise.all([
      prisma.vendorItem.groupBy({ by: ['vendorId'] }).then((g) => g.length),
      prisma.vendorItem.count(),
      prisma.vendorPrice.groupBy({ by: ['priceType'], where: { deletedAt: null }, _count: { _all: true } }),
      prisma.priceNotice.findFirst({ orderBy: { noticeDate: 'desc' }, include: { vendor: { select: { name: true } } } }),
    ]);
    const summary = {
      vendorCount,
      itemCount,
      priceCount: priceCounts.reduce((n, g) => n + g._count._all, 0),
      realCount: priceCounts.find((g) => g.priceType === '실제')?._count._all ?? 0,
      refCount: priceCounts.find((g) => g.priceType === '참고')?._count._all ?? 0,
      checkCount: rows.filter((r) => r.warn.level === 'check').length,
      staleCount: rows.filter((r) => r.warn.level === 'stale').length,
      noPriceCount: rows.filter((r) => r.warn.level === 'none').length,
      lastNotice: lastNotice
        ? {
            noticeDate: dayOf(lastNotice.noticeDate),
            vendorName: lastNotice.vendor.name,
            series: lastNotice.series,
            scope: lastNotice.scope,
            adjustAmount: Number(lastNotice.adjustAmount),
            content: lastNotice.content,
          }
        : null,
      asOf,
    };
    res.json({ rows, summary, settings: s });
  } catch (e) {
    fail(res, e);
  }
});

// 한 품목의 요약(PRC-02) — 최근·직전·흐름·3회 평균·참고단가·자료상태·경고와 추이 점.
router.get('/summary', async (req, res) => {
  try {
    const { vendorItemId } = req.query;
    if (!vendorItemId) throw bad('품목을 고르세요.');
    const asOf = req.query.asOf ? dayOf(req.query.asOf) : dayOf(new Date());
    const s = await getSettings();
    const item = await prisma.vendorItem.findUnique({
      where: { id: vendorItemId },
      include: { vendor: { select: { id: true, name: true } } },
    });
    if (!item) throw Object.assign(new Error('없는 품목입니다.'), { status: 404 });

    const rows = await prisma.vendorPrice.findMany({
      where: { vendorItemId, deletedAt: null },
      orderBy: { effectiveDate: 'asc' },
    });
    const sum = summarize(rows, asOf, s);
    res.json({
      item: {
        id: item.id,
        vendorId: item.vendorId,
        vendorName: item.vendor.name,
        vendorItemName: item.vendorItemName,
        series: item.series,
        repItemName: item.repItemName,
        definition: item.definition,
      },
      asOf,
      summary: sum,
      totalCount: rows.length,
    });
  } catch (e) {
    fail(res, e);
  }
});

// 이력 — 기본은 최근 10회, limit=0이면 전체.
router.get('/history', async (req, res) => {
  try {
    const { vendorItemId } = req.query;
    if (!vendorItemId) throw bad('품목을 고르세요.');
    const limit = req.query.limit === undefined ? 10 : Number(req.query.limit);
    const rows = await prisma.vendorPrice.findMany({
      where: { vendorItemId, deletedAt: null },
      orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
      ...(limit > 0 ? { take: limit } : {}),
    });
    res.json(
      rows.map((r) => ({
        id: r.id,
        effectiveDate: dayOf(r.effectiveDate),
        price: Number(r.price),
        priceType: r.priceType,
        isFree: r.isFree,
        source: r.source,
        memo: r.memo,
      })),
    );
  } catch (e) {
    fail(res, e);
  }
});

// 입력 화면(PRC-03) — 업체를 고르면 그 업체 품목이 현재 단가와 함께 줄지어 나온다.
router.get('/entry-rows', async (req, res) => {
  try {
    const { vendorId } = req.query;
    if (!vendorId) throw bad('업체를 고르세요.');
    const asOf = req.query.asOf ? dayOf(req.query.asOf) : dayOf(new Date());
    const s = await getSettings();
    const items = await prisma.vendorItem.findMany({
      where: { vendorId, isActive: true },
      orderBy: { vendorItemName: 'asc' },
    });
    const prices = await prisma.vendorPrice.findMany({
      where: { vendorItemId: { in: items.map((i) => i.id) }, deletedAt: null },
      orderBy: { effectiveDate: 'asc' },
    });
    res.json(
      items.map((item) => {
        const sum = summarize(
          prices.filter((p) => p.vendorItemId === item.id),
          asOf,
          s,
        );
        return {
          vendorItemId: item.id,
          vendorItemName: item.vendorItemName,
          series: item.series,
          price: sum?.latest.price ?? null,
          isFree: sum?.latest.isFree ?? false,
          priceType: sum?.latest.priceType ?? null,
          effectiveDate: sum?.latest.date ?? null,
        };
      }),
    );
  } catch (e) {
    fail(res, e);
  }
});

// 계산 상수 — 97% · 19,000원 · 45/90일. 배포 없이 고친다.
router.get('/settings', async (req, res) => {
  try {
    res.json(await getSettings());
  } catch (e) {
    fail(res, e);
  }
});

router.patch('/settings', async (req, res) => {
  try {
    const entries = Object.entries(req.body ?? {});
    for (const [key, value] of entries) {
      await prisma.priceSetting.upsert({
        where: { key },
        create: { key, value: String(value) },
        update: { value: String(value) },
      });
    }
    res.json(await getSettings());
  } catch (e) {
    fail(res, e);
  }
});

// 계열 목록 — 화면 필터가 쓴다. 공통코드에 없어도 실제 등록된 계열을 그대로 보여 준다.
router.get('/series', async (req, res) => {
  try {
    const rows = await prisma.vendorItem.groupBy({ by: ['series'], _count: { _all: true } });
    res.json(
      rows
        .filter((r) => r.series)
        .map((r) => ({ series: r.series, count: r._count._all }))
        .sort((a, b) => b.count - a.count),
    );
  } catch (e) {
    fail(res, e);
  }
});


// 엑셀 이관 — 담당자가 올린 「단가관리」 원본을 읽는다.
// 미리보기는 아무것도 저장하지 않는다. 확인 후 이관에서만 저장한다.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.post('/import/preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw bad('엑셀 파일을 골라 주세요.');
    const parsed = await parseWorkbook(req.file.buffer);
    const plan = await planImport(parsed);
    const { rows, ...rest } = plan;
    res.json({ ...rest, fileName: req.file.originalname, rowCount: rows.length });
  } catch (e) {
    fail(res, e);
  }
});

router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw bad('엑셀 파일을 골라 주세요.');
    const parsed = await parseWorkbook(req.file.buffer);
    const result = await applyImport(parsed, req.appUser?.id);
    res.status(201).json(result);
  } catch (e) {
    fail(res, e);
  }
});

// 한 건 저장. 같은 날 · 같은 구분이 이미 있으면 새로 쌓지 않고 그 줄을 고친다.
router.post('/', async (req, res) => {
  try {
    const row = await upsertPrice(req.body, req.appUser?.id);
    res.status(201).json(row);
  } catch (e) {
    fail(res, e);
  }
});

// 업체별 일괄 저장 — 바뀐 품목만 골라 보낸다. 빈 칸은 화면에서 이미 걸러 온다.
router.post('/bulk', async (req, res) => {
  try {
    const list = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!list.length) throw bad('저장할 단가가 없습니다.');
    const saved = [];
    for (const r of list) saved.push(await upsertPrice(r, req.appUser?.id));
    res.status(201).json({ count: saved.length });
  } catch (e) {
    fail(res, e);
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { price, priceType, isFree, memo, effectiveDate } = req.body;
    const row = await prisma.vendorPrice.update({
      where: { id: req.params.id },
      data: {
        ...(price !== undefined ? { price: Number(price) } : {}),
        ...(priceType ? { priceType } : {}),
        ...(isFree !== undefined ? { isFree: Boolean(isFree) } : {}),
        ...(memo !== undefined ? { memo } : {}),
        ...(effectiveDate ? { effectiveDate: new Date(`${dayOf(effectiveDate)}T00:00:00.000Z`) } : {}),
      },
    });
    res.json(row);
  } catch (e) {
    fail(res, e);
  }
});

// 지우기는 흔적을 남긴다 — 무엇이 지워졌는지 되짚을 수 있어야 한다.
router.delete('/:id', async (req, res) => {
  try {
    await prisma.vendorPrice.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    res.status(204).end();
  } catch (e) {
    fail(res, e);
  }
});

export default router;
