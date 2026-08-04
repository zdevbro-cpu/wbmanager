import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { postLedgerEntry } from '../lib/ledger.js';
import { toISO } from '../lib/date.js';

const router = Router();

router.get('/', async (req, res) => {
  const { projectId } = req.query;
  const sortings = await prisma.sorting.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: { sortDate: 'desc' },
  });
  res.json(sortings);
});

// 반입된 물량을 품목별로 분류 확정 → 재고원장에 입고(+) 반영
router.post('/', async (req, res) => {
  const { projectId, itemCode, sortDate, sortWeight } = req.body;

  if (!projectId || !itemCode || !sortDate || sortWeight == null) {
    return res.status(400).json({ error: 'projectId, itemCode, sortDate, sortWeight는 필수입니다.' });
  }
  if (Number(sortWeight) <= 0) {
    return res.status(400).json({ error: 'sortWeight는 0보다 커야 합니다.' });
  }

  const sorting = await prisma.$transaction(async (tx) => {
    const created = await tx.sorting.create({
      data: { ...req.body, sortDate: toISO(sortDate) },
    });
    await postLedgerEntry(
      {
        projectId,
        itemCode,
        direction: 'IN',
        weight: sortWeight,
        ledgerDate: toISO(sortDate),
        refType: 'sorting',
        refId: created.id,
      },
      tx,
    );
    return created;
  });

  res.status(201).json(sorting);
});

export default router;
