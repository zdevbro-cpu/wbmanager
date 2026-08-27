import { Router } from 'express';
import { firebaseAuth } from '../lib/firebaseAdmin.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { recordLogin } from '../middleware/audit.js';

const router = Router();

// Firebase 계정 생성 후, 내부 승인 대기 사용자로 등록 (최초 1명은 자동 관리자 승인)
router.post('/register', async (req, res) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });

  let decoded;
  try {
    decoded = await firebaseAuth.verifyIdToken(token);
  } catch {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }

  const existing = await prisma.appUser.findUnique({ where: { firebaseUid: decoded.uid } });
  if (existing) return res.json(existing);

  const userCount = await prisma.appUser.count();
  const isFirstUser = userCount === 0;

  const appUser = await prisma.appUser.create({
    data: {
      firebaseUid: decoded.uid,
      email: decoded.email ?? '',
      name: req.body?.name,
      phone: req.body?.phone || null,
      role: isFirstUser ? 'admin' : 'worker',
      status: isFirstUser ? 'approved' : 'pending',
      approvedAt: isFirstUser ? new Date() : null,
    },
  });
  res.status(201).json(appUser);
});

// 내 승인 상태 확인 (승인 전에도 호출 가능)
router.get('/me', async (req, res) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });

  let decoded;
  try {
    decoded = await firebaseAuth.verifyIdToken(token);
  } catch {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }

  const appUser = await prisma.appUser.findUnique({ where: { firebaseUid: decoded.uid } });
  if (!appUser) return res.status(404).json({ error: '가입 신청이 필요합니다.' });

  // 접속 이력 — 화면을 옮길 때마다 호출되므로 기록은 30분 간격으로만 남는다.
  if (appUser.status === 'approved') {
    recordLogin(appUser, req).catch((err) => console.error('[audit] 로그인 기록 실패:', err.message));
  }

  res.json(appUser);
});

// 관리자: 전체 사용자 목록 (대기중 포함)
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  const users = await prisma.appUser.findMany({
    orderBy: { createdAt: 'desc' },
    include: { employee: { select: { id: true, name: true } } },
  });
  res.json(users);
});

// 관리자: 승인/거절
router.patch('/users/:id/status', requireAuth, requireAdmin, async (req, res) => {
  const { status, employeeId, employmentType } = req.body;
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'status는 approved/rejected/pending 중 하나여야 합니다.' });
  }
  const user = await prisma.appUser.update({
    where: { id: req.params.id },
    data: { status, approvedAt: status === 'approved' ? new Date() : null },
  });

  // 승인만 해서는 그 계정이 누구인지 알 수 없어, 현장에서 출퇴근을 찍으면
  // "관리자에게 연결을 요청하세요"만 뜬다. 승인과 동시에 사람을 잇는다.
  // 승인하는 사람이 고른 임직원·고용 구분을 그대로 쓴다.
  const linked =
    status === 'approved' && !user.employeeId ? await linkEmployee(user, { employeeId, employmentType }) : null;
  res.json(linked ?? user);
});

// 같은 이름의 임직원이 있으면 그 사람으로, 없으면 계정 정보로 한 명 만들어 잇는다.
// 승인은 "이 사람을 들이겠다"는 결정이므로, 임직원 기록이 없다는 이유로 막지 않는다.
// 고용 구분은 기본값으로 들어가니 임직원 관리에서 확인해 고친다.
async function linkEmployee(user, opts = {}) {
  // 승인 화면에서 사람을 고른 경우 — 그 사람으로 잇는다. 구분을 함께 골랐으면 그것도 반영한다.
  if (opts.employeeId) {
    const picked = await prisma.employee.findUnique({ where: { id: opts.employeeId } });
    if (!picked) return null;
    if (opts.employmentType && opts.employmentType !== picked.employmentType) {
      await prisma.employee.update({ where: { id: picked.id }, data: { employmentType: opts.employmentType } });
    }
    return prisma.appUser.update({ where: { id: user.id }, data: { employeeId: picked.id } });
  }

  const name = (user.name ?? '').trim();
  if (!name) return null;

  const found = await prisma.employee.findFirst({ where: { name } });
  if (found) {
    if (opts.employmentType && opts.employmentType !== found.employmentType) {
      await prisma.employee.update({ where: { id: found.id }, data: { employmentType: opts.employmentType } });
    }
    return prisma.appUser.update({ where: { id: user.id }, data: { employeeId: found.id } });
  }

  const employee = await prisma.employee.create({
    data: {
      name,
      phone: user.phone ?? null,
      empCode: await nextEmpCode(),
      // 승인하는 사람이 고른 구분. 고르지 않았으면 기본값이 들어간다.
      ...(opts.employmentType ? { employmentType: opts.employmentType } : {}),
    },
  });

  return prisma.appUser.update({ where: { id: user.id }, data: { employeeId: employee.id } });
}

// 사번 채번 — 임직원 관리와 같은 규칙(EMP-{연도}-{3자리})을 쓴다.
async function nextEmpCode() {
  const prefix = `EMP-${new Date().getFullYear()}-`;
  const last = await prisma.employee.findFirst({
    where: { empCode: { startsWith: prefix } },
    orderBy: { empCode: 'desc' },
    select: { empCode: true },
  });
  const seq = last ? Number(last.empCode.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

// 관리자: 역할 변경
// 계정이 누구인지 — 모바일 출퇴근은 이 연결을 보고 찍는 사람을 정한다.
router.patch('/users/:id/employee', requireAuth, requireAdmin, async (req, res) => {
  const { employeeId } = req.body;
  if (employeeId) {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ error: '임직원을 찾을 수 없습니다.' });
  }
  const user = await prisma.appUser.update({
    where: { id: req.params.id },
    data: { employeeId: employeeId || null },
  });
  res.json(user);
});

// 이미 승인된 계정에 임직원이 없을 때, 관리자가 한 번 눌러 잇는다.
router.post('/users/:id/employee', requireAuth, requireAdmin, async (req, res) => {
  const user = await prisma.appUser.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: '계정을 찾을 수 없습니다.' });
  if (user.employeeId) return res.json(user);

  const linked = await linkEmployee(user, { employeeId: req.body?.employeeId, employmentType: req.body?.employmentType });
  if (!linked) return res.status(400).json({ error: '계정에 이름이 없어 임직원을 만들 수 없습니다.' });
  res.json(linked);
});

router.patch('/users/:id/role', requireAuth, requireAdmin, async (req, res) => {
  const { role } = req.body;
  if (!['admin', 'worker'].includes(role)) {
    return res.status(400).json({ error: 'role은 admin/worker 중 하나여야 합니다.' });
  }
  const user = await prisma.appUser.update({ where: { id: req.params.id }, data: { role } });
  res.json(user);
});

export default router;
