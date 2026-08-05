import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

// 폐기물 미신고/미기재 건 알림 목록 (S-FPMCPT)
router.get('/waste-unreported', async (req, res) => {
  const { projectId } = req.query;
  const rows = await prisma.wasteOutbound.findMany({
    where: {
      ...(projectId ? { projectId } : {}),
      OR: [{ olbaroReported: false }, { handoverDate: null }],
    },
    include: { project: true, buyer: true, item: true },
    orderBy: { outboundDate: 'desc' },
  });
  res.json(rows);
});

function daysUntil(date) {
  const ms = new Date(date).getTime() - Date.now();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// 차량검사/자격증 만료 임박·초과 알림 (S-EXJICM)
router.get('/expiring', async (req, res) => {
  const threshold = Number(req.query.days ?? 30);

  const [vehicles, certs, trainings, assetSchedules] = await Promise.all([
    prisma.vehicle.findMany({ where: { inspectionExpiry: { not: null } } }),
    prisma.employeeCertification.findMany({
      where: { expiryDate: { not: null } },
      include: { employee: true },
    }),
    // 의무·보수 교육의 다음 예정일도 같은 기준으로 알린다.
    prisma.employeeTraining.findMany({
      where: { nextDueDate: { not: null } },
      include: { employee: true },
    }),
    // 자산 일정(보험만료/정기검사/점검/교정/리스만료) — 설계문서상 알림 소스는 asset_schedule 하나로 통합
    prisma.assetSchedule.findMany({ where: { status: { not: '완료' } }, include: { asset: true } }),
  ]);

  const items = [
    ...vehicles.map((v) => ({
      type: 'vehicle_inspection',
      targetId: v.id,
      targetName: v.vehicleNo,
      expiryDate: v.inspectionExpiry,
      daysLeft: daysUntil(v.inspectionExpiry),
    })),
    ...certs.map((c) => ({
      type: 'certification',
      targetId: c.id,
      targetName: `${c.employee?.name ?? ''} - ${c.certName}`,
      expiryDate: c.expiryDate,
      daysLeft: daysUntil(c.expiryDate),
    })),
    ...trainings.map((t) => ({
      type: 'training',
      targetId: t.id,
      targetName: `${t.employee?.name ?? ''} - ${t.trainingName}${t.trainingType ? ` (${t.trainingType}교육)` : ''}`,
      expiryDate: t.nextDueDate,
      daysLeft: daysUntil(t.nextDueDate),
    })),
    ...assetSchedules.map((s) => ({
      type: 'asset_schedule',
      targetId: s.id,
      targetName: `${s.asset?.assetNo ?? ''} ${s.asset?.name ?? ''} - ${s.scheduleType}`,
      expiryDate: s.dueDate,
      daysLeft: daysUntil(s.dueDate),
    })),
  ]
    .filter((i) => i.daysLeft <= threshold)
    .map((i) => ({ ...i, status: i.daysLeft < 0 ? 'overdue' : 'imminent' }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  res.json({
    threshold,
    overdue: items.filter((i) => i.status === 'overdue'),
    imminent: items.filter((i) => i.status === 'imminent'),
  });
});

export default router;
