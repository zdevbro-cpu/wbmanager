import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { postLedgerEntry } from '../lib/ledger.js';
import { toISO } from '../lib/date.js';

const router = Router();

router.get('/', async (req, res) => {
  const { projectId } = req.query;
  const outbounds = await prisma.outboundSale.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: { outboundDate: 'desc' },
  });
  res.json(outbounds);
});

router.post('/', async (req, res) => {
  const { projectId, itemCode, outboundDate, grossWeight, tareWeight, lossWeight, settledWeight: settledWeightInput } = req.body;

  if (!projectId || !itemCode || !outboundDate) {
    return res.status(400).json({ error: 'projectId, itemCode, outboundDate는 필수입니다.' });
  }

  let settledWeight = settledWeightInput;
  if (settledWeight == null) {
    if (grossWeight == null || tareWeight == null) {
      return res.status(400).json({ error: 'settledWeight 또는 (grossWeight, tareWeight)가 필요합니다.' });
    }
    settledWeight = Number(grossWeight) - Number(tareWeight) - Number(lossWeight ?? 0);
  }
  if (Number(settledWeight) < 0) {
    return res.status(400).json({ error: '정산중량은 0 이상이어야 합니다.' });
  }

  const outbound = await prisma.$transaction(async (tx) => {
    const created = await tx.outboundSale.create({
      data: { ...req.body, settledWeight, outboundDate: toISO(outboundDate) },
    });
    await postLedgerEntry(
      {
        projectId,
        itemCode,
        direction: 'OUT',
        weight: settledWeight,
        ledgerDate: toISO(outboundDate),
        refType: 'outbound_sale',
        refId: created.id,
      },
      tx,
    );
    return created;
  });

  res.status(201).json(outbound);
});

export default router;
