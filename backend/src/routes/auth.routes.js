import { Router } from 'express';
import { firebaseAuth } from '../lib/firebaseAdmin.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

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
  res.json(appUser);
});

// 관리자: 전체 사용자 목록 (대기중 포함)
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  const users = await prisma.appUser.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(users);
});

// 관리자: 승인/거절
router.patch('/users/:id/status', requireAuth, requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'status는 approved/rejected/pending 중 하나여야 합니다.' });
  }
  const user = await prisma.appUser.update({
    where: { id: req.params.id },
    data: { status, approvedAt: status === 'approved' ? new Date() : null },
  });
  res.json(user);
});

// 관리자: 역할 변경
router.patch('/users/:id/role', requireAuth, requireAdmin, async (req, res) => {
  const { role } = req.body;
  if (!['admin', 'worker'].includes(role)) {
    return res.status(400).json({ error: 'role은 admin/worker 중 하나여야 합니다.' });
  }
  const user = await prisma.appUser.update({ where: { id: req.params.id }, data: { role } });
  res.json(user);
});

export default router;
