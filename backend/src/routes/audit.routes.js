import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// 접속·변경 이력 조회 — 관리자만 본다.
router.get('/', requireAdmin, async (req, res) => {
  const { action, appUserId, ip, from, to, q } = req.query;
  const range = {};
  // 조회 기간은 한국표준시 기준으로 해석한다.
  // 오프셋을 명시하지 않으면 시작일은 UTC, 종료일은 서버 로컬로 해석돼 기준이 어긋난다.
  if (from) range.gte = new Date(`${from}T00:00:00+09:00`);
  if (to) range.lte = new Date(`${to}T23:59:59.999+09:00`);

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

// 최근 변경 피드 — 로그인한 사람이면 누구나 본다.
// "어제 누가 무엇을 등록·수정했는지"는 관리자만 알 일이 아니라 같이 일하는 사람이 알아야 하는 일이다.
// 감사 화면과 달리 접속 IP·실패한 시도·로그인 기록은 내보내지 않는다.
router.get('/recent', async (req, res) => {
  const days = Math.min(Number(req.query.days) || 7, 30);
  const since = new Date(Date.now() - days * 86400000);

  const logs = await prisma.auditLog.findMany({
    where: {
      createdAt: { gte: since },
      action: { in: ['create', 'update', 'delete'] },
      // 성공한 변경만 보여 준다. 실패한 시도는 감사 영역이다.
      statusCode: { gte: 200, lt: 300 },
    },
    select: {
      id: true,
      action: true,
      path: true,
      summary: true,
      createdAt: true,
      appUser: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  res.json(
    logs.map((l) => ({
      id: l.id,
      action: l.action,
      // 경로에서 무엇을 다뤘는지만 남긴다(예: /api/inbounds/123 → inbounds).
      target: (l.path ?? '').replace(/^\/api\//, '').split(/[/?]/)[0] || '',
      summary: l.summary,
      who: l.appUser?.name ?? l.appUser?.email ?? '알 수 없음',
      createdAt: l.createdAt,
    })),
  );
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
