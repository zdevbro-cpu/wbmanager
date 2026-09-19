// 근태코드별 공수·출근일수 환산표 — 서버의 backend/src/lib/attendCode.js 와 같은 값이다.
// 저장은 서버가 하고, 여기서는 고르는 자리에서 "몇 공수로 잡히는지" 미리 보여 주는 데만 쓴다.
const TABLE: Record<string, { manDays: number | null; days: number }> = {
  출근: { manDays: 1, days: 1 },
  반차: { manDays: 0.5, days: 0.5 },
  특근: { manDays: 1.5, days: 1 },
  // 조퇴 — 출퇴근 시각으로 정한다(earlyLeaveManDays). 나온 날은 하루.
  조퇴: { manDays: null, days: 1 },
  연차: { manDays: 0, days: 0 },
  병가: { manDays: 0, days: 0 },
  결근: { manDays: 0, days: 0 },
  휴무: { manDays: 0, days: 0 },
};

// 표에 없는 코드(회사가 공통코드에 더 넣은 이름)는 하루 나온 것으로 본다.
const DEFAULT = { manDays: 1, days: 1 };

export function attendManDays(code?: string | null) {
  if (!code) return null;
  return (TABLE[code] ?? DEFAULT).manDays;
}

// 조퇴 공수 — 8시간 기준 일한 시간 비율을 0.25 · 0.5 · 0.75 · 1 네 구간의 윗값으로 올린다.
// 서버 backend/src/lib/attendCode.js 의 earlyLeaveManDays 와 같은 계산이다.
export function earlyLeaveManDays(checkInAt?: string | null, checkOutAt?: string | null) {
  if (!checkInAt || !checkOutAt) return null;
  const inAt = new Date(checkInAt).getTime();
  const outAt = new Date(checkOutAt).getTime();
  // 점심시간(12:00~13:00, 한국 시각)과 겹친 만큼은 일한 시간에서 뺀다.
  const day = new Date(inAt + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const lunchStart = new Date(`${day}T12:00:00+09:00`).getTime();
  const lunchEnd = new Date(`${day}T13:00:00+09:00`).getTime();
  const lunch = Math.max(0, Math.min(outAt, lunchEnd) - Math.max(inAt, lunchStart));
  const hours = (outAt - inAt - lunch) / 3600000;
  if (!(hours > 0)) return 0.25;
  const ratio = Math.min(Math.round((hours / 8) * 100) / 100, 1);
  return Math.max(0.25, Math.ceil(ratio * 4 - 1e-9) / 4);
}

export function attendDays(code?: string | null) {
  if (!code) return 0;
  return (TABLE[code] ?? DEFAULT).days;
}
