import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { dayOf, getSettings, lmeCalc } from '../lib/pricing.js';

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
