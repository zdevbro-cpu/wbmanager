import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { toISO } from '../lib/date.js';

const router = Router();

router.get('/', async (req, res) => {
  const { projectId } = req.query;
  const rows = await prisma.transport.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: { transportDate: 'desc' },
  });
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { projectId, transportDate } = req.body;
  if (!projectId || !transportDate) return res.status(400).json({ error: 'projectId, transportDate는 필수입니다.' });
  const row = await prisma.transport.create({
    data: { ...req.body, transportDate: toISO(transportDate) },
  });
  res.status(201).json(row);
});

export default router;
