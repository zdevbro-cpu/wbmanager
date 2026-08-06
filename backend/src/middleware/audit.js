import { prisma } from '../lib/prisma.js';

// Cloud Run은 프록시 뒤에 있어 실제 접속 IP가 X-Forwarded-For 첫 항목에 담긴다.
export function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress ?? null;
}

const ACTION_BY_METHOD = { POST: 'create', PATCH: 'update', PUT: 'update', DELETE: 'delete' };

// 조회는 양이 많아 남기지 않는다. 등록·수정·삭제만 기록해 "누가 무엇을 바꿨나"를 추적한다.
export function auditMutations(req, res, next) {
  const action = ACTION_BY_METHOD[req.method];
  if (!action) return next();

  res.on('finish', () => {
    // 실패한 요청도 남긴다 — 권한 밖 시도를 확인해야 한다.
    prisma.auditLog
      .create({
        data: {
          appUserId: req.appUser?.id ?? null,
          email: req.appUser?.email ?? null,
          action,
          method: req.method,
          path: req.originalUrl?.slice(0, 300) ?? null,
          statusCode: res.statusCode,
          ip: clientIp(req),
          userAgent: (req.headers['user-agent'] ?? '').slice(0, 300) || null,
          summary: summarize(req),
        },
      })
      .catch((err) => console.error('[audit] 기록 실패:', err.message));
  });

  next();
}

// 본문에서 사람이 알아볼 수 있는 이름만 골라 남긴다(민감값은 남기지 않는다).
function summarize(req) {
  const b = req.body ?? {};
  const parts = [
    b.roundName,
    b.assetNo,
    b.name,
    b.vehicleNo,
    b.itemName,
    b.certName,
    b.trainingName,
    b.label,
    b.title,
    b.reportType,
    b.status,
  ].filter((v) => typeof v === 'string' && v.trim());
  return parts.length ? parts.slice(0, 3).join(' / ').slice(0, 200) : null;
}

// 로그인 기록 — 같은 사람이 화면을 옮길 때마다 쌓이지 않도록 30분 간격으로만 남긴다.
const LOGIN_GAP_MS = 30 * 60 * 1000;

export async function recordLogin(appUser, req) {
  const now = new Date();
  const last = appUser.lastLoginAt ? new Date(appUser.lastLoginAt) : null;
  if (last && now.getTime() - last.getTime() < LOGIN_GAP_MS) return;

  const ip = clientIp(req);
  await prisma.$transaction([
    prisma.appUser.update({
      where: { id: appUser.id },
      data: { lastLoginAt: now, lastLoginIp: ip, loginCount: { increment: 1 } },
    }),
    prisma.auditLog.create({
      data: {
        appUserId: appUser.id,
        email: appUser.email,
        action: 'login',
        method: 'GET',
        path: '/api/auth/me',
        statusCode: 200,
        ip,
        userAgent: (req.headers['user-agent'] ?? '').slice(0, 300) || null,
      },
    }),
  ]);
}
