// 저장·전송은 UTC, 화면 표시와 "오늘" 판정은 한국표준시(KST)로 통일한다.
// 서버가 내려주는 ISO 문자열을 그대로 잘라 쓰면 UTC가 노출돼 9시간 이르게 보인다.
const KST = 'Asia/Seoul';

const parts = (v: string | number | Date) => {
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const f = new Intl.DateTimeFormat('sv-SE', {
    timeZone: KST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  // sv-SE 로케일은 'YYYY-MM-DD HH:mm' 형태로 내준다.
  return f.format(d);
};

// 'YYYY-MM-DD HH:mm' (KST)
export const kstStamp = (v?: string | number | Date | null) => {
  if (!v) return '-';
  return parts(v) ?? '-';
};

// 'YYYY-MM-DD' (KST)
export const kstDay = (v?: string | number | Date | null) => {
  if (!v) return '-';
  const s = parts(v);
  return s ? s.slice(0, 10) : '-';
};

// 오늘 날짜 'YYYY-MM-DD' (KST) — UTC 기준으로 뽑으면 한국시간 오전 9시 전에 전날이 나온다.
export const kstToday = () => kstDay(new Date());

// 이번 달 'YYYY-MM' (KST)
export const kstThisMonth = () => kstToday().slice(0, 7);
