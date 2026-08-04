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

router.get('/:id', async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: 'not found' });
  res.json(project);
});

export default router;
