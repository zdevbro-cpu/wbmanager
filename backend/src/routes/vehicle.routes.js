import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { toISO } from '../lib/date.js';

const router = Router();

router.get('/', async (req, res) => {
  const vehicles = await prisma.vehicle.findMany({ orderBy: { vehicleNo: 'asc' } });
  res.json(vehicles);
});

router.post('/', async (req, res) => {
  const { vehicleNo } = req.body;
  if (!vehicleNo) return res.status(400).json({ error: 'vehicleNo는 필수입니다.' });
  const vehicle = await prisma.vehicle.create({
    data: { ...req.body, inspectionExpiry: toISO(req.body.inspectionExpiry) },
  });
  res.status(201).json(vehicle);
});

router.patch('/:id', async (req, res) => {
  const { inspectionExpiry, currentSite, vehicleType } = req.body;
  const vehicle = await prisma.vehicle.update({
    where: { id: req.params.id },
    data: {
      ...(inspectionExpiry !== undefined ? { inspectionExpiry: toISO(inspectionExpiry) } : {}),
      ...(currentSite !== undefined ? { currentSite } : {}),
      ...(vehicleType !== undefined ? { vehicleType } : {}),
    },
  });
  res.json(vehicle);
});

router.post('/:id/movements', async (req, res) => {
  const { moveDate, fromSite, toSite } = req.body;
  if (!moveDate) return res.status(400).json({ error: 'moveDate는 필수입니다.' });

  const movement = await prisma.$transaction(async (tx) => {
    const created = await tx.vehicleMovement.create({
      data: { vehicleId: req.params.id, moveDate: toISO(moveDate), fromSite, toSite },
    });
    if (toSite) {
      await tx.vehicle.update({ where: { id: req.params.id }, data: { currentSite: toSite } });
    }
    return created;
  });
  res.status(201).json(movement);
});

router.get('/:id/movements', async (req, res) => {
  const movements = await prisma.vehicleMovement.findMany({
    where: { vehicleId: req.params.id },
    orderBy: { moveDate: 'desc' },
  });
  res.json(movements);
});

router.post('/:id/maintenances', async (req, res) => {
  const { maintenanceDate } = req.body;
  if (!maintenanceDate) return res.status(400).json({ error: 'maintenanceDate는 필수입니다.' });
  const maintenance = await prisma.vehicleMaintenance.create({
    data: { ...req.body, vehicleId: req.params.id, maintenanceDate: toISO(maintenanceDate) },
  });
  res.status(201).json(maintenance);
});

router.get('/:id/maintenances', async (req, res) => {
  const maintenances = await prisma.vehicleMaintenance.findMany({
    where: { vehicleId: req.params.id },
    include: { attachments: true },
    orderBy: { maintenanceDate: 'desc' },
  });
  res.json(maintenances);
});

export default router;
