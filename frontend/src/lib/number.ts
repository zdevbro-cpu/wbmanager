// 숫자 표시·입력 공통 포맷. 화면에 나오는 수량·금액은 예외 없이 세 자리마다 끊는다.

/** 표시용 — 값이 없으면 '-'. 소수는 최대 3자리(중량 kg 기준)까지 살린다. */
export function formatNumber(value: string | number | null | undefined, decimals?: number) {
  if (value === null || value === undefined || value === '') return '-';
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('ko-KR',
    decimals != null
      ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
      : { maximumFractionDigits: 3 },
  );
}

/** 입력창 표시용 — 타이핑 중이라 '1234.' 처럼 끝난 값도 그대로 살려야 한다. */
export function formatNumberInput(raw: string) {
  if (raw === '' || raw === '-') return raw;
  const negative = raw.startsWith('-');
  const body = negative ? raw.slice(1) : raw;
  const [int, ...rest] = body.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decimal = rest.length ? `.${rest.join('')}` : '';
  return `${negative ? '-' : ''}${grouped}${decimal}`;
}

/** 입력값 → 저장용 원시 문자열. 콤마·문자를 걷어내고 부호와 소수점을 하나로 정리한다. */
export function parseNumberInput(text: string, decimals = 0) {
  let s = text.replace(/[^\d.-]/g, '');
  const negative = s.startsWith('-');
  s = s.replace(/-/g, '');

  const parts = s.split('.');
  if (decimals > 0 && parts.length > 1) {
    s = `${parts[0]}.${parts.slice(1).join('').slice(0, decimals)}`;
  } else {
    s = parts[0];
  }

  return `${negative && s !== '' ? '-' : ''}${s}`;
}
