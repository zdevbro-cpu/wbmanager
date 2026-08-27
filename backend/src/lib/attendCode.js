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

export { TABLE as ATTEND_TABLE };
