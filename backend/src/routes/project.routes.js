import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { toISO } from '../lib/date.js';

const router = Router();

router.get('/', async (req, res) => {
  const projects = await prisma.project.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(projects);
});

router.post('/', async (req, res) => {
  const { roundName } = req.body;
  if (!roundName) return res.status(400).json({ error: 'roundName은 필수입니다.' });

  const project = await prisma.project.create({
    data: {
      ...req.body,
      startDate: toISO(req.body.startDate),
      endDate: toISO(req.body.endDate),
    },
  });
  res.status(201).json(project);
});

// 차수·기간·매입가·상태 수정
router.patch('/:id', async (req, res) => {
  const { roundName, buyerId, purchasePrice, startDate, endDate, status } = req.body;
  const updated = await prisma.project.update({
    where: { id: req.params.id },
    data: {
      ...(roundName !== undefined ? { roundName } : {}),
      ...(buyerId !== undefined ? { buyerId: buyerId || null } : {}),
      ...(purchasePrice !== undefined ? { purchasePrice: purchasePrice === '' ? null : Number(purchasePrice) } : {}),
      ...(startDate !== undefined ? { startDate: toISO(startDate) } : {}),
      ...(endDate !== undefined ? { endDate: toISO(endDate) } : {}),
      ...(status !== undefined ? { status } : {}),
    },
  });
  res.json(updated);
});

router.get('/:id', async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: 'not found' });
  res.json(project);
});

export default router;
