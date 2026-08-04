import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { toISO } from '../lib/date.js';

const router = Router();

router.get('/', async (req, res) => {
  const { projectId } = req.query;
  const rows = await prisma.labor.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: { workDate: 'desc' },
  });
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { projectId, workDate } = req.body;
  if (!projectId || !workDate) return res.status(400).json({ error: 'projectId, workDate는 필수입니다.' });
  const row = await prisma.labor.create({
    data: { ...req.body, workDate: toISO(workDate) },
  });
  res.status(201).json(row);
});

export default router;
