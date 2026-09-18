import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma.js';
import { dayOf, getSettings, summarize, upsertPrice } from '../lib/pricing.js';
import { applyImport, parseWorkbook, planImport } from '../lib/priceImport.js';

// 단가관리 — 최신단가·조회·입력. 엑셀 「최신단가」·「단가조회」·「단가이력」을 대신한다.
// 접근 권한은 아직 걸지 않는다. 메뉴별 권한이 확정되면 이 라우터 한 줄에 미들웨어를 더한다.
const router = Router();

function fail(res, e) {
  const status = e.status ?? 500;
  if (status === 500) console.error('[price]', e.message);
  res.status(status).json({ error: status === 500 ? '처리하지 못했습니다.' : e.message });
}

const bad = (msg) => Object.assign(new Error(msg), { status: 400 });

// 최신단가 현황(PRC-01) — 업체×품목마다 가장 최근 단가 한 줄.
// 엑셀은 배열수식 수백 개로 만들던 화면이다. 여기서는 한 번 읽어 한 번에 계산한다.
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
