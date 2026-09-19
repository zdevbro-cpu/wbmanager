// 근태코드별 공수·출근일수 환산표.
//
// 정규직은 공수를 손으로 적지 않고 근태코드만 고른다. 그 코드가 며칠 몫인지는
// 여기 한 곳에서만 정한다 — 고객과 협의해 값이 바뀌면 이 표만 고치면 된다.
//
// manDays: 인건비 계산에 쓰는 공수(공수 × 단가).
// days   : 사람이 나온 날을 세는 수 — 반차는 반나절이라 0.5일, 특근도 하루 나온 것이라 1일.
//          특근의 공수가 1.5인 것은 품값을 더 쳐 주는 것이지 이틀 나온 것이 아니다.
const TABLE = {
  출근: { manDays: 1, days: 1 },
  반차: { manDays: 0.5, days: 0.5 },
  특근: { manDays: 1.5, days: 1 },
  // 조퇴는 일한 시간으로 정한다(아래 earlyLeaveManDays). 표에는 비워 두고, 나온 날은 하루로 센다.
  조퇴: { manDays: null, days: 1 },
  연차: { manDays: 0, days: 0 },
  병가: { manDays: 0, days: 0 },
  결근: { manDays: 0, days: 0 },
  휴무: { manDays: 0, days: 0 },
};

// 표에 없는 코드(회사가 공통코드에 더 넣은 이름)는 하루 나온 것으로 본다.
const DEFAULT = { manDays: 1, days: 1 };

export function attendManDays(code) {
  if (!code) return null;
  return (TABLE[code] ?? DEFAULT).manDays;
}

export function attendDays(code) {
  if (!code) return 0;
  return (TABLE[code] ?? DEFAULT).days;
}

// 조퇴 공수 — 8시간을 기준으로 일한 시간의 비율을 구해, 네 구간의 윗값으로 올린다.
//   0.00~0.25 → 0.25 · 0.26~0.50 → 0.5 · 0.51~0.75 → 0.75 · 0.76~1.00 → 1
// 비율은 소수 둘째 자리로 끊어 구간을 가린다. 일한 시간은 출근~퇴근 시각의 차이에서
// 점심시간(12:00~13:00, 한국 시각)과 겹친 만큼을 뺀 것이다. 점심 전에 나갔으면 뺄 것이 없다.
export const STANDARD_HOURS = 8;

const lunchOverlapHours = (inAt, outAt) => {
  const day = new Date(inAt.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const start = new Date(`${day}T12:00:00+09:00`);
  const end = new Date(`${day}T13:00:00+09:00`);
  return Math.max(0, Math.min(outAt, end) - Math.max(inAt, start)) / 3600000;
};

export function earlyLeaveManDays(checkInAt, checkOutAt) {
  if (!checkInAt || !checkOutAt) return null;
  const inAt = new Date(checkInAt);
  const outAt = new Date(checkOutAt);
  const hours = (outAt - inAt) / 3600000 - lunchOverlapHours(inAt, outAt);
  if (!(hours > 0)) return 0.25;
  const ratio = Math.min(Math.round((hours / STANDARD_HOURS) * 100) / 100, 1);
  return Math.max(0.25, Math.ceil(ratio * 4 - 1e-9) / 4);
}

export { TABLE as ATTEND_TABLE };
