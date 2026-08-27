// 근태코드별 공수·출근일수 환산표 — 서버의 backend/src/lib/attendCode.js 와 같은 값이다.
// 저장은 서버가 하고, 여기서는 고르는 자리에서 "몇 공수로 잡히는지" 미리 보여 주는 데만 쓴다.
const TABLE: Record<string, { manDays: number; days: number }> = {
  출근: { manDays: 1, days: 1 },
  반차: { manDays: 0.5, days: 0.5 },
  특근: { manDays: 1.5, days: 1 },
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

export function attendDays(code?: string | null) {
  if (!code) return 0;
  return (TABLE[code] ?? DEFAULT).days;
}
