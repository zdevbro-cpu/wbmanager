// <input type="date"> 등에서 오는 date-only 문자열(YYYY-MM-DD)을 Prisma가 요구하는
// 전체 ISO-8601 DateTime 문자열로 정규화한다.
//
// 화면은 비운 날짜 칸을 빈 문자열로 보낸다. 그것을 그대로 넘기면 Prisma가
// "Expected ISO-8601 DateTime"으로 저장 전체를 거부하므로, 비운 값은 비운 채로(null) 만든다.
// 값을 아예 보내지 않은 경우(undefined)는 "그 항목은 건드리지 않는다"는 뜻이라 그대로 둔다.
export function toISO(dateInput) {
  if (dateInput === undefined) return undefined;
  if (dateInput === null || dateInput === '') return null;
  if (dateInput instanceof Date) return Number.isNaN(dateInput.getTime()) ? null : dateInput.toISOString();

  const parsed = new Date(dateInput);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
