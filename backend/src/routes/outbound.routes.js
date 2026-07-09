import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

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
  const outbound = await prisma.outboundSale.create({ data: req.body });
  res.status(201).json(outbound);
});

export default router;
