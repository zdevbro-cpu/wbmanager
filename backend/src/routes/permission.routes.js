import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// 메뉴별 권한 (리뷰회의 1-7 · 5-18)
//
// 「사용권한 체크목록」 본표를 담아 두고 화면에서 고친다. 규칙이 바뀔 때마다 배포하지 않기 위해서다.
// 표가 비어 있으면 지금과 똑같이 동작한다 — 값이 없다고 화면이 막히면 안 된다.

export const ROLE_KEYS = ['admin', 'operator', 'staff', 'viewer', 'field'];
export const ROLE_LABEL = {
  admin: '시스템 관리자',
  operator: '시스템 운영자',
  staff: '직원',
  viewer: '조회 전용',
  field: '현장 인력',
};

// 전체 표 — 권한 화면이 읽는다.
router.get('/', async (req, res) => {
  const [screens, rows] = await Promise.all([
    prisma.permissionScreen.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.permission.findMany(),
  ]);
  res.json({
    roles: ROLE_KEYS.map((key) => ({ key, label: ROLE_LABEL[key] })),
    screens,
    permissions: rows,
  });
});

// 내 권한 — 화면이 메뉴와 단추를 가릴 때 쓴다.
// 계층이 정해지지 않은 계정은 지금까지처럼 다 보인다(관리자는 늘 전부).
router.get('/me', async (req, res) => {
  const user = req.appUser
    ? await prisma.appUser.findUnique({ where: { id: req.appUser.id }, select: { role: true, roleKey: true } })
    : null;
  const roleKey = user?.roleKey ?? (user?.role === 'admin' ? 'admin' : null);

  if (!roleKey) return res.json({ roleKey: null, unrestricted: true, permissions: {} });

  const rows = await prisma.permission.findMany({ where: { roleKey } });
  const permissions = {};
  for (const r of rows) {
    permissions[r.screenKey] = { c: r.canCreate, r: r.canRead, u: r.canUpdate, d: r.canDelete };
  }
  // 아직 한 줄도 없으면 막지 않는다.
  res.json({ roleKey, unrestricted: rows.length === 0, permissions });
});

// 표 고치기 — 관리자만. 보낸 줄만 바꾸고 나머지는 그대로 둔다.
router.put('/', requireAdmin, async (req, res) => {
  const changes = Array.isArray(req.body?.changes) ? req.body.changes : [];
  if (!changes.length) return res.status(400).json({ error: '바꿀 내용이 없습니다.' });

  const bad = changes.find((c) => !ROLE_KEYS.includes(c.roleKey) || !c.screenKey);
  if (bad) return res.status(400).json({ error: '계층 또는 화면 값이 올바르지 않습니다.' });

  const screens = await prisma.permissionScreen.findMany({ select: { key: true } });
  const known = new Set(screens.map((s) => s.key));
  const unknown = changes.find((c) => !known.has(c.screenKey));
  if (unknown) return res.status(400).json({ error: `없는 화면입니다: ${unknown.screenKey}` });

  await prisma.$transaction(
    changes.map((c) =>
      prisma.permission.upsert({
        where: { roleKey_screenKey: { roleKey: c.roleKey, screenKey: c.screenKey } },
        update: { canCreate: !!c.c, canRead: !!c.r, canUpdate: !!c.u, canDelete: !!c.d },
        create: {
          roleKey: c.roleKey,
          screenKey: c.screenKey,
          canCreate: !!c.c,
          canRead: !!c.r,
          canUpdate: !!c.u,
          canDelete: !!c.d,
        },
      }),
    ),
  );
  res.json({ count: changes.length });
});

export default router;
