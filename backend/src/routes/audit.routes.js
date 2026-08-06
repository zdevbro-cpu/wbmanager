import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// 접속·변경 이력 조회 — 관리자만 본다.
router.get('/', requireAdmin, async (req, res) => {
  const { action, appUserId, ip, from, to, q } = req.query;
  const range = {};
  if (from) range.gte = new Date(from);
  if (to) range.lte = new Date(`${to}T23:59:59`);

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(action ? { action } : {}),
      ...(appUserId ? { appUserId } : {}),
      ...(ip ? { ip } : {}),
      ...(Object.keys(range).length ? { createdAt: range } : {}),
      ...(q
        ? {
            OR: [
              { path: { contains: q, mode: 'insensitive' } },
              { summary: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: { appUser: { select: { name: true, email: true, role: true } } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  res.json(logs);
});

// 접속 IP 요약 — 사무실·집 외 접속을 한눈에 본다.
router.get('/ip-summary', requireAdmin, async (req, res) => {
  const days = Number(req.query.days ?? 30);
  const since = new Date(Date.now() - days * 86400000);

  const grouped = await prisma.auditLog.groupBy({
    by: ['ip'],
    where: { createdAt: { gte: since }, ip: { not: null } },
    _count: { _all: true },
    _min: { createdAt: true },
    _max: { createdAt: true },
  });

  const rows = await Promise.all(
    grouped.map(async (g) => {
      const users = await prisma.auditLog.findMany({
        where: { ip: g.ip, createdAt: { gte: since } },
        select: { email: true },
        distinct: ['email'],
        take: 10,
      });
      return {
        ip: g.ip,
        count: g._count._all,
        firstAt: g._min.createdAt,
        lastAt: g._max.createdAt,
        users: users.map((u) => u.email).filter(Boolean),
      };
    }),
  );

  res.json(rows.sort((a, b) => b.count - a.count));
});

export default router;
