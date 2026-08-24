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

router.patch('/:id', async (req, res) => {
  const body = { ...req.body };
  delete body.id;
  delete body.project;
  const row = await prisma.transport.update({
    where: { id: req.params.id },
    data: { ...body, ...(body.transportDate ? { transportDate: toISO(body.transportDate) } : {}) },
  });
  res.json(row);
});

router.delete('/:id', async (req, res) => {
  await prisma.transport.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
