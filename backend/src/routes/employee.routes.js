import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { toISO } from '../lib/date.js';

const router = Router();

router.get('/', async (req, res) => {
  const employees = await prisma.employee.findMany({ orderBy: { name: 'asc' } });
  res.json(employees);
});

router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name은 필수입니다.' });
  const employee = await prisma.employee.create({
    data: { ...req.body, hireDate: toISO(req.body.hireDate) },
  });
  res.status(201).json(employee);
});

router.post('/:id/certifications', async (req, res) => {
  const { certName } = req.body;
  if (!certName) return res.status(400).json({ error: 'certName은 필수입니다.' });
  const cert = await prisma.employeeCertification.create({
    data: {
      ...req.body,
      employeeId: req.params.id,
      acquiredDate: toISO(req.body.acquiredDate),
      expiryDate: toISO(req.body.expiryDate),
    },
  });
  res.status(201).json(cert);
});

router.get('/:id/certifications', async (req, res) => {
  const certs = await prisma.employeeCertification.findMany({
    where: { employeeId: req.params.id },
    orderBy: { expiryDate: 'asc' },
  });
  res.json(certs);
});

router.post('/:id/trainings', async (req, res) => {
  const { trainingName } = req.body;
  if (!trainingName) return res.status(400).json({ error: 'trainingName은 필수입니다.' });
  const training = await prisma.employeeTraining.create({
    data: { ...req.body, employeeId: req.params.id, trainingDate: toISO(req.body.trainingDate) },
  });
  res.status(201).json(training);
});

router.get('/:id/trainings', async (req, res) => {
  const trainings = await prisma.employeeTraining.findMany({
    where: { employeeId: req.params.id },
    orderBy: { trainingDate: 'desc' },
  });
  res.json(trainings);
});

export default router;
