import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { toISO } from '../lib/date.js';

const router = Router();

router.get('/', async (req, res) => {
  const { projectId } = req.query;
  const inbounds = await prisma.inbound.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: { inboundDate: 'desc' },
  });
  res.json(inbounds);
});

router.post('/', async (req, res) => {
  const { projectId, inboundDate, grossWeight, tareWeight } = req.body;

  if (!projectId || !inboundDate || grossWeight == null || tareWeight == null) {
    return res.status(400).json({ error: 'projectId, inboundDate, grossWeight, tareWeight는 필수입니다.' });
  }
  if (Number(grossWeight) < 0 || Number(tareWeight) < 0) {
    return res.status(400).json({ error: '중량은 0 이상이어야 합니다.' });
  }
  if (Number(grossWeight) < Number(tareWeight)) {
    return res.status(400).json({ error: '만차중량은 공차중량보다 작을 수 없습니다.' });
  }

  const netWeight = Number(grossWeight) - Number(tareWeight);

  const inbound = await prisma.inbound.create({
    data: { ...req.body, netWeight, inboundDate: toISO(inboundDate) },
  });
  res.status(201).json(inbound);
});

export default router;
