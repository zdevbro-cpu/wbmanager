import { firebaseAuth } from '../lib/firebaseAdmin.js';
import { prisma } from '../lib/prisma.js';

// Authorization: Bearer <Firebase ID Token>을 검증하고, 내부 AppUser(승인 상태)를 req.appUser에 채운다.
// 승인되지 않은 사용자는 /api/auth/me 외 모든 API에서 차단된다.
export async function requireAuth(req, res, next) {
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
  if (!appUser) return res.status(403).json({ error: '가입 신청이 필요합니다.' });
  if (appUser.status !== 'approved') {
    return res.status(403).json({ error: '관리자 승인이 필요합니다.', status: appUser.status });
  }

  req.appUser = appUser;
  next();
}

export function requireAdmin(req, res, next) {
  if (req.appUser?.role !== 'admin') {
    return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  }
  next();
}
