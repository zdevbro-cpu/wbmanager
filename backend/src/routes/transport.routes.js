import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { toISO } from '../lib/date.js';
import { rememberCodes } from '../lib/rememberCodes.js';

const router = Router();

// 운반비가 어디에 속하는지. 「프로젝트」만 그 현장 손익에 들어간다(회의 2026-10-14 4번).
const BELONGS = ['프로젝트', '본사', '창고이동', '기타'];

router.get('/', async (req, res) => {
  const { projectId, belongTo } = req.query;
  const rows = await prisma.transport.findMany({
    where: {
      ...(projectId ? { projectId } : {}),
      ...(belongTo ? { belongTo } : {}),
    },
    include: { project: { select: { id: true, roundName: true } } },
    orderBy: { transportDate: 'desc' },
  });
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { projectId, transportDate } = req.body;
  const belongTo = req.body.belongTo || '프로젝트';
  if (!BELONGS.includes(belongTo)) {
    return res.status(400).json({ error: `귀속은 ${BELONGS.join(' · ')} 중에서 고르세요.` });
  }
  if (!transportDate) return res.status(400).json({ error: 'transportDate는 필수입니다.' });
  // 현장에 딸린 운반만 프로젝트를 요구한다. 본사·창고이동·기타는 현장이 없다.
  if (belongTo === '프로젝트' && !projectId) {
    return res.status(400).json({ error: '귀속이 프로젝트면 현장을 고르세요.' });
  }
  const row = await prisma.transport.create({
    data: {
      ...req.body,
      belongTo,
      projectId: belongTo === '프로젝트' ? projectId : null,
      transportDate: toISO(transportDate),
    },
  });
  await rememberCodes([
    ['차종', req.body.vehicleType],
    ['상차지', req.body.origin],
    ['하차지', req.body.destination],
  ]);
  res.status(201).json(row);
});

router.patch('/:id', async (req, res) => {
  const body = { ...req.body };
  delete body.id;
  delete body.project;
  if (body.belongTo != null) {
    if (!BELONGS.includes(body.belongTo)) {
      return res.status(400).json({ error: `귀속은 ${BELONGS.join(' · ')} 중에서 고르세요.` });
    }
    // 현장에서 본사로 옮기면 현장을 떼고, 본사에서 현장으로 돌리면 현장을 받아야 한다.
    if (body.belongTo !== '프로젝트') body.projectId = null;
    else if (!body.projectId) {
      const before = await prisma.transport.findUnique({ where: { id: req.params.id }, select: { projectId: true } });
      if (!before?.projectId) return res.status(400).json({ error: '귀속이 프로젝트면 현장을 고르세요.' });
    }
  }
  const row = await prisma.transport.update({
    where: { id: req.params.id },
    data: { ...body, ...(body.transportDate ? { transportDate: toISO(body.transportDate) } : {}) },
  });
  await rememberCodes([
    ['차종', req.body.vehicleType],
    ['상차지', req.body.origin],
    ['하차지', req.body.destination],
  ]);
  res.json(row);
});

router.delete('/:id', async (req, res) => {
  await prisma.transport.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
