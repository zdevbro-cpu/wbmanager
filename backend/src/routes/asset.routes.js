import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { toISO } from '../lib/date.js';

const router = Router();

// 자산 목록 — 유형·상태·분류·검색어 필터 (설계문서 4.관리자 2)
router.get('/', async (req, res) => {
  const { assetType, status, category, q } = req.query;
  const assets = await prisma.asset.findMany({
    where: {
      ...(assetType ? { assetType } : {}),
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
      ...(q
        ? {
            OR: [
              { assetNo: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
              { modelName: { contains: q, mode: 'insensitive' } },
              { serialNo: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: { vehicle: true, equipment: true, manager: true, schedules: true, attachments: true },
    orderBy: { assetNo: 'asc' },
  });
  res.json(assets);
});

router.get('/:id', async (req, res) => {
  const asset = await prisma.asset.findUnique({
    where: { id: req.params.id },
    include: {
      vehicle: true,
      equipment: true,
      manager: true,
      attachments: true,
      schedules: { orderBy: { dueDate: 'asc' } },
    },
  });
  if (!asset) return res.status(404).json({ error: '자산을 찾을 수 없습니다.' });
  res.json(asset);
});

const num = (v) => (v === '' || v == null ? undefined : Number(v));

// 유형 선택에 따라 상세 폼이 분기되므로 vehicle/equipment는 해당 유형일 때만 만든다.
router.post('/', async (req, res) => {
  const { assetNo, assetType, name, vehicle, equipment, schedules, ...rest } = req.body;

  if (!assetNo || !assetType || !name) {
    return res.status(400).json({ error: 'assetNo, assetType, name은 필수입니다.' });
  }
  if (!['VEHICLE', 'EQUIPMENT'].includes(assetType)) {
    return res.status(400).json({ error: 'assetType은 VEHICLE 또는 EQUIPMENT여야 합니다.' });
  }

  const exists = await prisma.asset.findUnique({ where: { assetNo } });
  if (exists) return res.status(409).json({ error: '이미 등록된 자산번호입니다.' });

  const created = await prisma.asset.create({
    data: {
      ...rest,
      assetNo,
      assetType,
      name,
      acquiredAt: toISO(rest.acquiredAt),
      acquireCost: num(rest.acquireCost),
      usefulLifeMonth: num(rest.usefulLifeMonth),
      ...(assetType === 'VEHICLE' && vehicle
        ? {
            vehicle: {
              create: {
                ...vehicle,
                currentMileage: num(vehicle.currentMileage),
                insuranceEnd: toISO(vehicle.insuranceEnd),
                inspectionNext: toISO(vehicle.inspectionNext),
                leaseEnd: toISO(vehicle.leaseEnd),
              },
            },
          }
        : {}),
      ...(assetType === 'EQUIPMENT' && equipment
        ? {
            equipment: {
              create: {
                ...equipment,
                inspectionCycleMonth: num(equipment.inspectionCycleMonth),
                quantity: num(equipment.quantity),
                inspectionNext: toISO(equipment.inspectionNext),
                calibrationNext: toISO(equipment.calibrationNext),
                warrantyEnd: toISO(equipment.warrantyEnd),
              },
            },
          }
        : {}),
      ...(schedules?.length
        ? {
            schedules: {
              create: schedules
                .filter((s) => s?.scheduleType && s?.dueDate)
                .map((s) => ({
                  scheduleType: s.scheduleType,
                  dueDate: toISO(s.dueDate),
                  alertDaysBefore: num(s.alertDaysBefore) ?? 30,
                  memo: s.memo || undefined,
                })),
            },
          }
        : {}),
    },
    include: { vehicle: true, equipment: true, schedules: true },
  });

  res.status(201).json(created);
});

// 상태 변경 등 부분 수정. 자산은 삭제하지 않고 상태(폐기/매각)로만 종료한다.
router.patch('/:id', async (req, res) => {
  const { status, disposedAt, disposeReason, location, ownerDept, managerEmpId, memo } = req.body;
  const updated = await prisma.asset.update({
    where: { id: req.params.id },
    data: {
      ...(status !== undefined ? { status } : {}),
      ...(disposedAt !== undefined ? { disposedAt: toISO(disposedAt) } : {}),
      ...(disposeReason !== undefined ? { disposeReason } : {}),
      ...(location !== undefined ? { location } : {}),
      ...(ownerDept !== undefined ? { ownerDept } : {}),
      ...(managerEmpId !== undefined ? { managerEmpId: managerEmpId || null } : {}),
      ...(memo !== undefined ? { memo } : {}),
    },
  });
  res.json(updated);
});

// ── 일정(보험만료/정기검사/점검/교정/리스만료) ──
router.post('/:id/schedules', async (req, res) => {
  const { scheduleType, dueDate, alertDaysBefore, memo } = req.body;
  if (!scheduleType || !dueDate) {
    return res.status(400).json({ error: 'scheduleType, dueDate는 필수입니다.' });
  }
  const schedule = await prisma.assetSchedule.create({
    data: {
      assetId: req.params.id,
      scheduleType,
      dueDate: toISO(dueDate),
      alertDaysBefore: num(alertDaysBefore) ?? 30,
      memo: memo || undefined,
    },
  });
  res.status(201).json(schedule);
});

router.patch('/:id/schedules/:scheduleId', async (req, res) => {
  const { status, completedAt, dueDate, memo } = req.body;
  const updated = await prisma.assetSchedule.update({
    where: { id: req.params.scheduleId },
    data: {
      ...(status !== undefined ? { status } : {}),
      ...(completedAt !== undefined ? { completedAt: toISO(completedAt) } : {}),
      ...(dueDate !== undefined ? { dueDate: toISO(dueDate) } : {}),
      ...(memo !== undefined ? { memo } : {}),
    },
  });
  res.json(updated);
});

router.delete('/:id/schedules/:scheduleId', async (req, res) => {
  const deleted = await prisma.assetSchedule.delete({ where: { id: req.params.scheduleId } });
  res.json(deleted);
});

export default router;
