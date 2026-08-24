import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

// 외부 운전자 — 계근 등록 화면에서 이름을 찾고, 없으면 그 자리에서 등록한다.
router.get('/', async (req, res) => {
  const drivers = await prisma.externalDriver.findMany({ orderBy: { name: 'asc' } });
  res.json(drivers);
});

// 같은 이름이 이미 있으면 연락처만 채워 준다 — 같은 기사가 두 줄로 갈라지지 않게 한다.
router.post('/', async (req, res) => {
  const name = (req.body.name ?? '').trim();
  const phone = (req.body.phone ?? '').trim() || null;
  const memo = (req.body.memo ?? '').trim() || null;
  if (!name) return res.status(400).json({ error: '이름은 필수입니다.' });

  const existing = await prisma.externalDriver.findUnique({ where: { name } });
  if (existing) {
    const updated = await prisma.externalDriver.update({
      where: { name },
      data: { phone: phone ?? existing.phone, memo: memo ?? existing.memo },
    });
    return res.json(updated);
  }

  const driver = await prisma.externalDriver.create({ data: { name, phone, memo } });
  res.status(201).json(driver);
});

router.patch('/:id', async (req, res) => {
  const { name, phone, memo } = req.body;
  const updated = await prisma.externalDriver.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined ? { name: String(name).trim() } : {}),
      ...(phone !== undefined ? { phone: String(phone).trim() || null } : {}),
      ...(memo !== undefined ? { memo: String(memo).trim() || null } : {}),
    },
  });
  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  await prisma.externalDriver.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
