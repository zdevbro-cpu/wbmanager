import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { dayOf, getSettings, lmeCalc, upsertPrice } from '../lib/pricing.js';

// LME 계산기(PRC-05) — 동 시세와 팔 때 환율로 A동·상동·중동 참고단가를 낸다.
// 계산값은 저장하지 않는다. 기준값(97% · 19,000원 · 차감액)이 바뀌면 지난 기록도 새 기준으로 다시 보인다.
const router = Router();

function fail(res, e) {
  const status = e.status ?? 500;
  if (status === 500) console.error('[market-rate]', e.message);
  res.status(status).json({ error: status === 500 ? '처리하지 못했습니다.' : e.message });
}

const bad = (msg) => Object.assign(new Error(msg), { status: 400 });

router.get('/', async (req, res) => {
  try {
    const s = await getSettings();
    const rows = await prisma.marketRate.findMany({ orderBy: { rateDate: 'desc' }, take: 60 });
    res.json({
      settings: s,
      rows: rows.map((r) => ({
        id: r.id,
        rateDate: dayOf(r.rateDate),
        code: r.code,
        value: Number(r.value),
        fxRate: Number(r.fxRate),
        memo: r.memo,
        ...lmeCalc({ value: r.value, fxRate: r.fxRate }, s),
      })),
    });
  } catch (e) {
    fail(res, e);
  }
});

// 계산만 — 저장하기 전에 화면에서 숫자를 확인한다.
router.get('/calc', async (req, res) => {
  try {
    const { value, fxRate } = req.query;
    if (!value || !fxRate) throw bad('시세와 환율을 적어 주세요.');
    const s = await getSettings();
    res.json(lmeCalc({ value, fxRate }, s));
  } catch (e) {
    fail(res, e);
  }
});


// LME 계산값을 쓰는 품목 — 이름이 A동·상동·중동인 업체품목을 찾아 준다.
// 엑셀에서는 계산 결과를 손으로 복사해 단가이력에 붙였다. 그 단계를 없앤다.
const LME_ITEMS = ['A동', '상동', '중동'];

router.get('/targets', async (req, res) => {
  try {
    const items = await prisma.vendorItem.findMany({
      where: { vendorItemName: { in: LME_ITEMS }, isActive: true },
      include: { vendor: { select: { id: true, name: true } } },
    });
    const byVendor = new Map();
    for (const it of items) {
      if (!byVendor.has(it.vendorId)) {
        byVendor.set(it.vendorId, { vendorId: it.vendorId, vendorName: it.vendor.name, items: [] });
      }
      byVendor.get(it.vendorId).items.push({ id: it.id, vendorItemName: it.vendorItemName });
    }
    res.json([...byVendor.values()]);
  } catch (e) {
    fail(res, e);
  }
});

// 계산값을 참고단가로 반영한다 — A동·상동·중동 세 줄이 그 기준일로 쌓인다.
router.post('/apply', async (req, res) => {
  try {
    const { rateDate, value, fxRate, vendorId } = req.body;
    if (!rateDate) throw bad('기준일을 고르세요.');
    if (!value || !fxRate) throw bad('시세와 환율을 적어 주세요.');
    if (!vendorId) throw bad('반영할 업체를 고르세요.');
    const s = await getSettings();
    const calc = lmeCalc({ value, fxRate }, s);
    const priceOf = { 'A동': calc.aDong, '상동': calc.sangDong, '중동': calc.jungDong };

    const items = await prisma.vendorItem.findMany({
      where: { vendorId, vendorItemName: { in: LME_ITEMS }, isActive: true },
    });
    if (!items.length) {
      throw bad('그 업체에 A동·상동·중동 품목이 없습니다. 업체품목에 먼저 등록해 주세요.');
    }
    const applied = [];
    for (const item of items) {
      await upsertPrice(
        {
          vendorItemId: item.id,
          effectiveDate: rateDate,
          price: priceOf[item.vendorItemName],
          priceType: '참고',
          source: '시세',
          memo: 'LME 기준',
        },
        req.appUser?.id,
      );
      applied.push({ vendorItemName: item.vendorItemName, price: priceOf[item.vendorItemName] });
    }
    res.status(201).json({ applied, calc });
  } catch (e) {
    fail(res, e);
  }
});

// 누적기록에 저장. 같은 날 같은 시세를 다시 적으면 그 줄을 고친다.
router.post('/', async (req, res) => {
  try {
    const { rateDate, value, fxRate, memo, code = 'LME_CU' } = req.body;
    if (!rateDate) throw bad('기준일을 고르세요.');
    if (!value || !fxRate) throw bad('시세와 환율을 적어 주세요.');
    const day = new Date(`${dayOf(rateDate)}T00:00:00.000Z`);
    const row = await prisma.marketRate.upsert({
      where: { rateDate_code: { rateDate: day, code } },
      create: {
        rateDate: day,
        code,
        value: Number(value),
        fxRate: Number(fxRate),
        memo: memo ?? 'LME 기준',
        createdById: req.appUser?.id ?? null,
      },
      update: { value: Number(value), fxRate: Number(fxRate), memo: memo ?? 'LME 기준' },
    });
    const s = await getSettings();
    res.status(201).json({ id: row.id, rateDate: dayOf(row.rateDate), ...lmeCalc(row, s) });
  } catch (e) {
    fail(res, e);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.marketRate.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) {
    fail(res, e);
  }
});

export default router;
