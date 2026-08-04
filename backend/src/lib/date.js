// <input type="date"> 등에서 오는 date-only 문자열(YYYY-MM-DD)을 Prisma가 요구하는
// 전체 ISO-8601 DateTime 문자열로 정규화한다.
export function toISO(dateInput) {
  if (!dateInput) return dateInput;
  if (dateInput instanceof Date) return dateInput.toISOString();
  return new Date(dateInput).toISOString();
}
