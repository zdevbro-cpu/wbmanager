import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { toISO } from '../lib/date.js';

const router = Router();

const num = (v) => (v === '' || v == null ? undefined : Number(v));

// 프로젝트 코드 자동 채번 — P-{연도}-{3자리}
async function nextProjectCode(tx, startDate) {
  const year = String(new Date(startDate ?? Date.now()).getFullYear());
  const prefix = `P-${year}-`;
  const last = await tx.project.findFirst({
    where: { projectCode: { startsWith: prefix } },
    orderBy: { projectCode: 'desc' },
    select: { projectCode: true },
  });
  const seq = last ? Number(last.projectCode.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

router.get('/', async (req, res) => {
  const projects = await prisma.project.findMany({
    include: { buyer: true, orderer: true, contractor: true, manager: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(projects);
});

router.post('/', async (req, res) => {
  const { roundName } = req.body;
  if (!roundName) return res.status(400).json({ error: 'roundName은 필수입니다.' });

  const project = await prisma.$transaction(async (tx) =>
    tx.project.create({
      data: {
        ...req.body,
        projectCode: req.body.projectCode || (await nextProjectCode(tx, req.body.startDate)),
        contractAmount: num(req.body.contractAmount),
        purchasePrice: num(req.body.purchasePrice),
        contractWeight: num(req.body.contractWeight),
        deposit: num(req.body.deposit),
        advancePayment: num(req.body.advancePayment),
        startDate: toISO(req.body.startDate),
        endDate: toISO(req.body.endDate),
      },
    }),
  );
  res.status(201).json(project);
});

// 계약 정보·담당자·상태 수정
router.patch('/:id', async (req, res) => {
  const b = req.body;
  const set = (key, value) => (b[key] !== undefined ? { [key]: value } : {});

  const updated = await prisma.project.update({
    where: { id: req.params.id },
    data: {
      ...set('roundName', b.roundName),
      ...set('roundNo', b.roundNo || null),
      ...set('ordererId', b.ordererId || null),
      ...set('contractorId', b.contractorId || null),
      ...set('siteName', b.siteName || null),
      ...set('region', b.region || null),
      ...set('buyerId', b.buyerId || null),
      ...set('contractAmount', num(b.contractAmount) ?? null),
      ...set('purchasePrice', num(b.purchasePrice) ?? null),
      ...set('contractWeight', num(b.contractWeight) ?? null),
      ...set('vatIncluded', b.vatIncluded),
      ...set('deposit', num(b.deposit) ?? null),
      ...set('advancePayment', num(b.advancePayment) ?? null),
      ...set('settlementCycle', b.settlementCycle || null),
      ...set('managerEmpId', b.managerEmpId || null),
      ...set('dischargerName', b.dischargerName || null),
      ...set('memo', b.memo || null),
      ...set('startDate', toISO(b.startDate)),
      ...set('endDate', toISO(b.endDate)),
      ...set('status', b.status),
    },
  });
  res.json(updated);
});

router.get('/:id', async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: { buyer: true, orderer: true, contractor: true, manager: true },
  });
  if (!project) return res.status(404).json({ error: 'not found' });
  res.json(project);
});

export default router;
