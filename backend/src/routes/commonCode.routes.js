import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

// 전체 목록(그룹별 정렬) 또는 ?group=차종 으로 단일 그룹 조회
router.get('/', async (req, res) => {
  const { group, includeInactive } = req.query;
  const codes = await prisma.commonCode.findMany({
    where: {
      ...(group ? { group } : {}),
      ...(includeInactive === 'true' ? {} : { isActive: true }),
    },
    orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }],
  });
  res.json(codes);
});

router.post('/', async (req, res) => {
  const { group, label } = req.body;
  if (!group || !label) return res.status(400).json({ error: 'group, label은 필수입니다.' });

  const exists = await prisma.commonCode.findUnique({ where: { group_label: { group, label } } });
  if (exists) return res.status(409).json({ error: '이미 등록된 항목입니다.' });

  const last = await prisma.commonCode.findFirst({ where: { group }, orderBy: { sortOrder: 'desc' } });
  const created = await prisma.commonCode.create({
    data: { group, label, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });
  res.status(201).json(created);
});

// 이름 변경 / 순서 변경 / 사용여부 토글
router.patch('/:id', async (req, res) => {
  const { label, sortOrder, isActive } = req.body;
  const updated = await prisma.commonCode.update({
    where: { id: req.params.id },
    data: {
      ...(label !== undefined ? { label } : {}),
      ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
  });
  res.json(updated);
});

// 같은 그룹 안에서 위/아래 항목과 순서를 맞바꾼다.
router.patch('/:id/move', async (req, res) => {
  const { direction } = req.body; // 'up' | 'down'
  const current = await prisma.commonCode.findUnique({ where: { id: req.params.id } });
  if (!current) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });

  const neighbor = await prisma.commonCode.findFirst({
    where: {
      group: current.group,
      sortOrder: direction === 'up' ? { lt: current.sortOrder } : { gt: current.sortOrder },
    },
    orderBy: { sortOrder: direction === 'up' ? 'desc' : 'asc' },
  });
  if (!neighbor) return res.json(current);

  await prisma.$transaction([
    prisma.commonCode.update({ where: { id: current.id }, data: { sortOrder: neighbor.sortOrder } }),
    prisma.commonCode.update({ where: { id: neighbor.id }, data: { sortOrder: current.sortOrder } }),
  ]);
  res.json({ ...current, sortOrder: neighbor.sortOrder });
});

router.delete('/:id', async (req, res) => {
  const deleted = await prisma.commonCode.delete({ where: { id: req.params.id } });
  res.json(deleted);
});

export default router;
