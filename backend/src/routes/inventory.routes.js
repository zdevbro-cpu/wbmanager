import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { getInventorySnapshot, getInventoryEntries, getInventoryValuation } from '../lib/inventory.js';
import { toISO } from '../lib/date.js';

const router = Router();

router.get('/snapshot', async (req, res) => {
  const { projectId, itemCode } = req.query;
  const rows = await getInventorySnapshot({ projectId, itemCode });
  res.json(rows);
});

// 재고 변동 원장 드릴다운 (S-HPWLTV)
router.get('/snapshot/:projectId/:itemCode/entries', async (req, res) => {
  const { projectId, itemCode } = req.params;
  const entries = await getInventoryEntries(projectId, itemCode);
  res.json(entries);
});

// 묶음(품목 분류)별 평균단가 — 보고 고친다(요청 2026-11-13).
// 품목마다 단가를 넣기 어려워, 묶음 하나로 그 안의 품목을 모두 평가하는 길이다.
router.get('/group-prices', async (_req, res) => {
  const rows = await prisma.itemGroupPrice.findMany({ orderBy: { category: 'asc' } });
  res.json(rows.map((r) => ({ ...r, price: Number(r.price) })));
});

router.put('/group-prices/:category', async (req, res) => {
  const price = Number(req.body?.price);
  if (!Number.isFinite(price) || price < 0) {
    return res.status(400).json({ error: '단가는 0 이상의 숫자로 적어 주세요.' });
  }
  const row = await prisma.itemGroupPrice.upsert({
    where: { category: req.params.category },
    update: { price, memo: req.body?.memo ?? null },
    create: { category: req.params.category, price, memo: req.body?.memo ?? null },
  });
  res.json({ ...row, price: Number(row.price) });
});

// 품목 기준단가를 재고평가 화면에서 바로 고친다 —
// 「보이는 데이터에서 기준단가를 누르면 쓰는 란이 뜨면 좋겠다」는 말씀에 따른 것이다.
router.put('/item-price/:itemCode', async (req, res) => {
  const raw = req.body?.basePrice;
  const price = raw === null || raw === '' ? null : Number(raw);
  if (price !== null && (!Number.isFinite(price) || price < 0)) {
    return res.status(400).json({ error: '단가는 0 이상의 숫자로 적어 주세요.' });
  }
  try {
    const row = await prisma.itemMaster.update({
      where: { itemCode: req.params.itemCode },
      data: { basePrice: price },
      select: { itemCode: true, itemName: true, basePrice: true },
    });
    res.json({ ...row, basePrice: row.basePrice == null ? null : Number(row.basePrice) });
  } catch {
    res.status(404).json({ error: '품목을 찾지 못했습니다.' });
  }
});

router.get('/valuation', async (req, res) => {
  const { projectId, asOf } = req.query;
  const result = await getInventoryValuation({ projectId, asOf });
  res.json(result);
});

// 품목 단가 등록 (전체 적용 또는 특정 차수 적용) — S-YZTHIZ
router.post('/prices', async (req, res) => {
  const { itemCode, price, projectId, effectiveDate } = req.body;
  if (!itemCode || price == null || !effectiveDate) {
    return res.status(400).json({ error: 'itemCode, price, effectiveDate는 필수입니다.' });
  }
  const entry = await prisma.itemPriceHistory.create({
    data: { itemCode, price, projectId: projectId || null, effectiveDate: toISO(effectiveDate) },
  });
  res.status(201).json(entry);
});

router.get('/prices', async (req, res) => {
  const { itemCode } = req.query;
  const rows = await prisma.itemPriceHistory.findMany({
    where: itemCode ? { itemCode } : undefined,
    include: { project: true },
    orderBy: { effectiveDate: 'desc' },
  });
  res.json(rows);
});

export default router;
