import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

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
  const { grossWeight, tareWeight } = req.body;
  const inbound = await prisma.inbound.create({
    data: {
      ...req.body,
      netWeight: grossWeight - tareWeight,
    },
  });
  res.status(201).json(inbound);
});

export default router;
