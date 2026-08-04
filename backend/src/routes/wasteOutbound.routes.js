import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { postLedgerEntry } from '../lib/ledger.js';
import { toISO } from '../lib/date.js';

const router = Router();

router.get('/', async (req, res) => {
  const { projectId, unreported } = req.query;
  const wasteOutbounds = await prisma.wasteOutbound.findMany({
    where: {
      ...(projectId ? { projectId } : {}),
      // 미신고/미기재 폐기물 건만 필터 (S-FPMCPT)
      ...(unreported === 'true' ? { OR: [{ olbaroReported: false }, { handoverDate: null }] } : {}),
    },
    include: { project: true, buyer: true },
    orderBy: { outboundDate: 'desc' },
  });
  res.json(wasteOutbounds);
});

router.post('/', async (req, res) => {
  const { projectId, itemCode, outboundDate, weight } = req.body;

  if (!projectId || !outboundDate || weight == null) {
    return res.status(400).json({ error: 'projectId, outboundDate, weight는 필수입니다.' });
  }
  if (Number(weight) <= 0) {
    return res.status(400).json({ error: 'weight는 0보다 커야 합니다.' });
  }

  const wasteOutbound = await prisma.$transaction(async (tx) => {
    const created = await tx.wasteOutbound.create({
      data: { ...req.body, outboundDate: toISO(outboundDate) },
    });
    if (itemCode) {
      await postLedgerEntry(
        {
          projectId,
          itemCode,
          direction: 'OUT',
          weight,
          ledgerDate: toISO(outboundDate),
          refType: 'waste_outbound',
          refId: created.id,
        },
        tx,
      );
    }
    return created;
  });

  res.status(201).json(wasteOutbound);
});

// 올바로 신고 상태/인계일/메모 수정 (F-FZOGXB)
router.patch('/:id', async (req, res) => {
  const { olbaroReported, handoverDate, olbaroMemo } = req.body;
  const updated = await prisma.wasteOutbound.update({
    where: { id: req.params.id },
    data: {
      ...(olbaroReported !== undefined ? { olbaroReported } : {}),
      ...(handoverDate !== undefined ? { handoverDate: toISO(handoverDate) } : {}),
      ...(olbaroMemo !== undefined ? { olbaroMemo } : {}),
    },
  });
  res.json(updated);
});

export default router;
