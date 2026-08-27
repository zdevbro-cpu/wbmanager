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

// 무엇을 어떻게 바꿨는지 남긴다.
// 예전에는 이름 몇 개만 골라 적어서 대부분 비어 있었고, 채워져도 "누가 무엇을 했는지"를
// 알 수 없었다. 이제 보낸 값 중 사람이 알아볼 수 있는 항목을 이름표를 붙여 적는다.
//
// 개인정보(전화·주소·메일·비밀번호)와 내부 참조(아이디)는 남기지 않는다.
// 순서는 아래 표에 적은 차례를 따른다 — 앞쪽이 그 건을 가장 잘 설명하는 항목이다.
const FIELD_LABEL = {
  // 언제
  inboundDate: '입고일',
  outboundDate: '출고일',
  wasteDate: '반출일',
  transferDate: '인계일',
  handoverDate: '인계일',
  transportDate: '운반일',
  weighDate: '계근일',
  workDate: '작업일',
  startDate: '시작일',
  endDate: '종료일',
  expiryDate: '만료일',
  docDate: '문서일자',
  // 누구와
  roundName: '차수',
  name: '이름',
  siteName: '현장',
  customerName: '발주처',
  vendorName: '거래처',
  buyerName: '매입처',
  dischargerName: '배출자',
  transporterName: '운반자',
  processorName: '처리자',
  // 무엇을
  itemName: '품목',
  itemCode: '품목코드',
  category: '구분',
  title: '제목',
  fileName: '파일',
  docTypeCode: '분류',
  assetNo: '자산번호',
  projectCode: '프로젝트코드',
  // 얼마나
  vehicleNo: '차량',
  plateNo: '차량번호',
  vehicleType: '차종',
  driverName: '운전자',
  grossWeight: '총중량',
  tareWeight: '공차중량',
  actualWeight: '실중량',
  lossWeight: '감량',
  weight: '중량',
  quantity: '수량',
  cubicMeter: '루베',
  unitPrice: '단가',
  amount: '금액',
  transportCost: '운반비',
  // 어디로
  loadingPoint: '상차지',
  unloadingPoint: '하차지',
  origin: '출발지',
  destination: '도착지',
  // 어떤 상태로
  status: '상태',
  isDraft: '임시저장',
  olbaroReported: '올바로신고',
  isSubsidiary: '부산물',
  isActive: '사용',
  approved: '승인',
  role: '권한',
  department: '부서',
  position: '직급',
  certName: '자격증',
  trainingName: '교육과정',
  // 덧붙인 말
  memo: '비고',
  olbaroMemo: '올바로메모',
  description: '설명',
  note: '메모',
  reportType: '보고서',
  label: '이름표',
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}/;

// 값을 화면에서 읽을 수 있는 모양으로 줄인다.
function showValue(key, v) {
  if (v === null || v === '') return '지움';
  if (typeof v === 'boolean') return v ? '예' : '아니오';
  if (typeof v === 'number') return v.toLocaleString('ko-KR');
  if (typeof v !== 'string') return null;

  const t = v.trim();
  if (!t) return '지움';
  // 날짜는 앞의 날짜 부분만 남긴다(시각까지는 필요 없다).
  if (DATE_ONLY.test(t)) return t.slice(0, 10);
  // 숫자로 온 중량·금액은 자릿점을 찍는다.
  if (/^-?\d+(\.\d+)?$/.test(t) && key !== 'vehicleNo' && key !== 'plateNo') {
    return Number(t).toLocaleString('ko-KR');
  }
  return t.length > 40 ? `${t.slice(0, 40)}…` : t;
}

function summarize(req) {
  const b = req.body ?? {};

  // 지울 때는 보낸 내용이 없다. 어떤 건이었는지 찾아갈 수 있도록 대상만 짧게 남긴다.
  if (req.method === 'DELETE') {
    const last = (req.originalUrl ?? '').split(/[/?]/).filter(Boolean).pop() ?? '';
    return /^[0-9a-f-]{8,}$/i.test(last) ? `대상 #${last.slice(0, 8)}` : null;
  }
  if (typeof b !== 'object' || Array.isArray(b)) return null;

  const parts = [];
  for (const [key, label] of Object.entries(FIELD_LABEL)) {
    if (!(key in b)) continue;
    const shown = showValue(key, b[key]);
    if (shown === null) continue;
    parts.push(`${label} ${shown}`);
  }

  if (!parts.length) return null;
  // 한 건에 항목이 많으면 앞의 여덟 개만 적고 나머지는 개수로 줄인다.
  const head = parts.slice(0, 8).join(' · ');
  const rest = parts.length - 8;
  return (rest > 0 ? `${head} 외 ${rest}개` : head).slice(0, 300);
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
