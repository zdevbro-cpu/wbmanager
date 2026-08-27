import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { toISO } from '../lib/date.js';

const router = Router();

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const num = (v) => (v == null || v === '' ? 0 : Number(v));

// 'YYYY-MM-DD' 문자열로만 다룬다 — 시차로 하루가 밀리지 않게 한다.
const key = (d) => new Date(d).toISOString().slice(0, 10);
const daysOfMonth = (month) => {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
};

router.get('/', async (req, res) => {
  const { projectId } = req.query;
  const rows = await prisma.laborPlan.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: [{ startDate: 'asc' }],
  });
  res.json(rows);
});

// 계획과 실행을 하루 단위로 나란히 준다 — 화면은 이 값을 막대로만 그린다.
// 계획은 구간에 걸친 날마다 그 줄의 하루 공수를 더한다. 주말·휴일도 그대로 센다 —
// 현장은 주말에도 돌아가고, 쉬기로 했으면 계획을 그 구간에서 빼면 된다.
router.get('/chart', async (req, res) => {
  const { month, projectId } = req.query;
  if (!MONTH.test(month ?? '')) return res.status(400).json({ error: 'month는 YYYY-MM 형식입니다.' });

  const days = daysOfMonth(month);
  const first = days[0];
  const last = days[days.length - 1];

  const [plans, labors] = await Promise.all([
    prisma.laborPlan.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        startDate: { lte: new Date(`${last}T23:59:59.999Z`) },
        endDate: { gte: new Date(`${first}T00:00:00.000Z`) },
      },
    }),
    prisma.labor.findMany({
      where: { settleMonth: month, ...(projectId ? { projectId } : {}) },
      select: { workDate: true, workerType: true, totalManDays: true },
    }),
  ]);

  // 고용구분별로 계획·실행을 같은 날짜축에 담는다.
  const groups = new Map();
  const take = (type) => {
    if (!groups.has(type)) {
      groups.set(type, {
        employmentType: type,
        plan: Object.fromEntries(days.map((d) => [d, 0])),
        actual: Object.fromEntries(days.map((d) => [d, 0])),
      });
    }
    return groups.get(type);
  };

  for (const p of plans) {
    const g = take(p.employmentType ?? '미지정');
    const from = key(p.startDate);
    const to = key(p.endDate);
    for (const d of days) if (d >= from && d <= to) g.plan[d] += num(p.manDays);
  }
  for (const l of labors) {
    const g = take(l.workerType ?? '미지정');
    const d = key(l.workDate);
    if (g.actual[d] != null) g.actual[d] += num(l.totalManDays);
  }

  const rows = [...groups.values()].map((g) => ({
    ...g,
    planTotal: days.reduce((s, d) => s + g.plan[d], 0),
    actualTotal: days.reduce((s, d) => s + g.actual[d], 0),
  }));

  res.json({ month, days, rows });
});

router.post('/', async (req, res) => {
  const { projectId, startDate, endDate, manDays } = req.body ?? {};
  if (!projectId || !startDate || !endDate) {
    return res.status(400).json({ error: '프로젝트와 기간은 필수입니다.' });
  }
  if (toISO(endDate) < toISO(startDate)) {
    return res.status(400).json({ error: '종료일이 시작일보다 빠를 수 없습니다.' });
  }
  if (!(Number(manDays) > 0)) return res.status(400).json({ error: '하루 공수는 0보다 커야 합니다.' });

  const row = await prisma.laborPlan.create({
    data: {
      projectId,
      employmentType: req.body.employmentType || null,
      startDate: toISO(startDate),
      endDate: toISO(endDate),
      manDays: Number(manDays),
      unitCost: req.body.unitCost ? Number(req.body.unitCost) : null,
      memo: req.body.memo || null,
    },
  });
  res.status(201).json(row);
});

router.patch('/:id', async (req, res) => {
  const b = req.body ?? {};
  const row = await prisma.laborPlan.update({
    where: { id: req.params.id },
    data: {
      ...(b.projectId !== undefined ? { projectId: b.projectId } : {}),
      ...(b.employmentType !== undefined ? { employmentType: b.employmentType || null } : {}),
      ...(b.startDate !== undefined ? { startDate: toISO(b.startDate) } : {}),
      ...(b.endDate !== undefined ? { endDate: toISO(b.endDate) } : {}),
      ...(b.manDays !== undefined ? { manDays: Number(b.manDays) } : {}),
      ...(b.unitCost !== undefined ? { unitCost: b.unitCost ? Number(b.unitCost) : null } : {}),
      ...(b.memo !== undefined ? { memo: b.memo || null } : {}),
    },
  });
  res.json(row);
});

router.delete('/:id', async (req, res) => {
  await prisma.laborPlan.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
