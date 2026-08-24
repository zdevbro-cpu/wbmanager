import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { toISO } from '../lib/date.js';

const router = Router();

// 자산 목록 — 유형·상태·분류·검색어 필터 (설계문서 4.관리자 2)
router.get('/', async (req, res) => {
  const { assetType, status, category, q, isCompany } = req.query;
  const assets = await prisma.asset.findMany({
    where: {
      ...(assetType ? { assetType } : {}),
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
      // 'true'는 회사자산만, 'false'는 외부만. 없으면 둘 다 본다.
      ...(isCompany === 'true' ? { isCompanyAsset: true } : isCompany === 'false' ? { isCompanyAsset: false } : {}),
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
      maintenances: {
        include: { vendor: true, attachments: true },
        orderBy: [{ completedAt: 'desc' }, { requestedAt: 'desc' }],
      },
      movements: { orderBy: { moveDate: 'desc' } },
    },
  });
  if (!asset) return res.status(404).json({ error: '자산을 찾을 수 없습니다.' });
  res.json(asset);
});

const num = (v) => (v === '' || v == null ? undefined : Number(v));

// 유형 선택에 따라 상세 폼이 분기되므로 vehicle/equipment는 해당 유형일 때만 만든다.
// 입출고 등록에서 목록에 없는 차량번호를 직접 적었을 때 쓰는 빠른 등록.
// 자산번호를 사람이 정할 일이 아니라서 차량번호에서 만들어 준다. 나머지는 자산 관리에서 채운다.
router.post('/quick-vehicle', async (req, res) => {
  const plateNo = String(req.body?.plateNo ?? '').trim();
  const vehicleType = req.body?.vehicleType ? String(req.body.vehicleType).trim() : null;
  if (!plateNo) return res.status(400).json({ error: '차량번호는 필수입니다.' });
  // 적다 만 값이 차량 목록에 남지 않도록 번호 꼴을 갖춘 것만 받는다.
  // 화면에서도 거르지만, 목록을 더럽히는 값은 여기서 한 번 더 막는다.
  if (!/^(?:[가-힣]{2})?\d{2,3}[가-힣]\d{4}$/.test(plateNo.replace(/[\s-]/g, ''))) {
    return res.status(400).json({ error: '차량번호 형식이 아닙니다.' });
  }

  const existing = await prisma.asset.findFirst({
    where: { assetType: 'VEHICLE', vehicle: { plateNo } },
    include: { vehicle: true },
  });
  if (existing) return res.json(existing);

  const assetNo = `V-${plateNo}`;
  const dup = await prisma.asset.findUnique({ where: { assetNo } });
  if (dup) return res.json(dup);

  const created = await prisma.asset.create({
    data: {
      assetNo,
      assetType: 'VEHICLE',
      name: plateNo,
      category: vehicleType,
      status: '가용',
      // 계근 등록에서 차량번호만 적어 만든 차량은 운송만 맡는 외부 차량으로 본다.
      // 회사 차량이면 자산 관리에서 구분을 바꾼다.
      isCompanyAsset: false,
      vehicle: { create: { plateNo, vehicleType } },
    },
    include: { vehicle: true },
  });
  res.status(201).json(created);
});

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
  const { status, disposedAt, disposeReason, location, ownerDept, managerEmpId, memo, isCompanyAsset } = req.body;
  const updated = await prisma.asset.update({
    where: { id: req.params.id },
    data: {
      ...(status !== undefined ? { status } : {}),
      ...(isCompanyAsset !== undefined ? { isCompanyAsset: Boolean(isCompanyAsset) } : {}),
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

// ── 계근 차량(외부) 정리 ──
// 계근 등록에서 차량번호만 적어 만들어진 차량이다. 자산 대장에 두지 않고 마스터에서 정리한다.

// 오타 정정 — 차량번호와 차종만 고친다.
router.patch('/:id/vehicle', async (req, res) => {
  const { plateNo, vehicleType } = req.body;
  const asset = await prisma.asset.findUnique({ where: { id: req.params.id }, select: { isCompanyAsset: true } });
  if (!asset) return res.status(404).json({ error: '자산을 찾을 수 없습니다.' });
  if (asset.isCompanyAsset) {
    return res.status(400).json({ error: '회사자산은 자산 관리에서 수정하세요.' });
  }
  const plate = plateNo == null ? undefined : String(plateNo).trim();
  if (plate === '') return res.status(400).json({ error: '차량번호는 비울 수 없습니다.' });

  const updated = await prisma.asset.update({
    where: { id: req.params.id },
    data: {
      ...(plate ? { assetNo: `V-${plate}`, name: plate } : {}),
      ...(vehicleType !== undefined ? { category: vehicleType || null } : {}),
      vehicle: {
        update: {
          ...(plate ? { plateNo: plate } : {}),
          ...(vehicleType !== undefined ? { vehicleType: vehicleType || null } : {}),
        },
      },
    },
    include: { vehicle: true },
  });
  res.json(updated);
});

// 회사가 인수한 차량은 자산 대장으로 올린다. 이때 정식 자산번호를 새로 매긴다.
router.post('/:id/promote', async (req, res) => {
  const asset = await prisma.asset.findUnique({ where: { id: req.params.id }, include: { vehicle: true } });
  if (!asset) return res.status(404).json({ error: '자산을 찾을 수 없습니다.' });
  if (asset.isCompanyAsset) return res.json(asset);

  const year = new Date().getFullYear();
  const prefix = `V-${year}-`;
  const rows = await prisma.asset.findMany({
    where: { assetNo: { startsWith: prefix } },
    select: { assetNo: true },
  });
  const last = rows.reduce((max, r) => {
    const n = Number(String(r.assetNo).slice(prefix.length));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);

  const updated = await prisma.asset.update({
    where: { id: req.params.id },
    data: { isCompanyAsset: true, assetNo: `${prefix}${String(last + 1).padStart(3, '0')}` },
    include: { vehicle: true },
  });
  res.json(updated);
});

// 오타로 생긴 차량번호를 지운다. 과거 계근 기록은 문자열로 남아 있어 영향받지 않는다.
router.delete('/:id', async (req, res) => {
  const asset = await prisma.asset.findUnique({
    where: { id: req.params.id },
    select: { isCompanyAsset: true, _count: { select: { maintenances: true } } },
  });
  if (!asset) return res.status(404).json({ error: '자산을 찾을 수 없습니다.' });
  if (asset.isCompanyAsset) {
    return res.status(400).json({ error: '회사자산은 삭제하지 않습니다. 상태를 매각·폐기로 바꾸세요.' });
  }
  await prisma.asset.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
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

// ── 정비 이력 ──
// 다음 예정일을 넣으면 asset_schedule 일정을 함께 만들어 알림 소스를 하나로 유지한다(설계문서 3.6).
router.post('/:id/maintenances', async (req, res) => {
  const { maintType, nextDueDate, requestedAt, startedAt, completedAt, cost, mileageAt, hoursAt, nextDueMileage } = req.body;
  if (!maintType) return res.status(400).json({ error: 'maintType은 필수입니다.' });

  // 정비는 회사자산만 관리한다. 운송만 맡는 외부 차량은 정비 이력을 남기지 않는다.
  const target = await prisma.asset.findUnique({ where: { id: req.params.id }, select: { isCompanyAsset: true } });
  if (!target) return res.status(404).json({ error: '자산을 찾을 수 없습니다.' });
  if (!target.isCompanyAsset) {
    return res.status(400).json({ error: '외부 자산은 정비 관리 대상이 아닙니다. 회사자산으로 바꾼 뒤 등록하세요.' });
  }

  const created = await prisma.$transaction(async (tx) => {
    const maintenance = await tx.assetMaintenance.create({
      data: {
        ...req.body,
        assetId: req.params.id,
        requestedAt: toISO(requestedAt),
        startedAt: toISO(startedAt),
        completedAt: toISO(completedAt),
        nextDueDate: toISO(nextDueDate),
        cost: num(cost),
        mileageAt: num(mileageAt),
        hoursAt: num(hoursAt),
        nextDueMileage: num(nextDueMileage),
      },
    });
    if (nextDueDate) {
      await tx.assetSchedule.create({
        data: {
          assetId: req.params.id,
          scheduleType: maintType === '법정검사' ? '정기검사' : '정기점검',
          dueDate: toISO(nextDueDate),
          memo: `${maintType} 후속`,
        },
      });
    }
    // 정비 시점 계기판은 자산의 현재 주행거리에도 반영한다(파생값 갱신).
    if (mileageAt) {
      await tx.assetVehicle.updateMany({ where: { assetId: req.params.id }, data: { currentMileage: num(mileageAt) } });
    }
    return maintenance;
  });

  res.status(201).json(created);
});

router.patch('/:id/maintenances/:maintId', async (req, res) => {
  const { status, completedAt, action, cost } = req.body;
  const updated = await prisma.assetMaintenance.update({
    where: { id: req.params.maintId },
    data: {
      ...(status !== undefined ? { status } : {}),
      ...(completedAt !== undefined ? { completedAt: toISO(completedAt) } : {}),
      ...(action !== undefined ? { action } : {}),
      ...(cost !== undefined ? { cost: num(cost) } : {}),
    },
  });
  res.json(updated);
});

router.delete('/:id/maintenances/:maintId', async (req, res) => {
  const deleted = await prisma.assetMaintenance.delete({ where: { id: req.params.maintId } });
  res.json(deleted);
});

// ── 이동 내역 ──
router.post('/:id/movements', async (req, res) => {
  const { moveDate, fromSite, toSite, memo } = req.body;
  if (!moveDate) return res.status(400).json({ error: 'moveDate는 필수입니다.' });

  const movement = await prisma.$transaction(async (tx) => {
    const created = await tx.assetMovement.create({
      data: { assetId: req.params.id, moveDate: toISO(moveDate), fromSite, toSite, memo },
    });
    // 최신 도착지를 자산의 현재 위치로 반영한다.
    if (toSite) await tx.asset.update({ where: { id: req.params.id }, data: { location: toSite } });
    return created;
  });

  res.status(201).json(movement);
});

router.delete('/:id/movements/:movementId', async (req, res) => {
  const deleted = await prisma.assetMovement.delete({ where: { id: req.params.movementId } });
  res.json(deleted);
});

export default router;
