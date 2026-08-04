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
