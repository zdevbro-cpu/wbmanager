import { prisma } from './prisma.js';

// 사번 — 회사약자-등록연월-일련번호 (예: WB-202609-001, CR-202609-001). 근태 QR이 이 값을 담는다.
// 회사약자는 소속 회사 칸으로 정한다. 크로스면 CR, 그 밖(원방·빈칸)은 WB.
// 등록연월은 임직원을 등록한 달(한국 시각)이다. 일련번호는 회사·달마다 001부터 센다.
// 임직원 등록과 가입 승인이 같은 규칙을 써야 번호가 겹치지 않아 여기 한 곳에 둔다.
export const companyPrefix = (companyName) => (/크로스|cross/i.test(companyName ?? '') ? 'CR' : 'WB');

const kstYearMonth = (at) =>
  new Date(new Date(at).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 7).replace('-', '');

export async function nextEmpCode(db = prisma, companyName = null, at = new Date()) {
  const prefix = `${companyPrefix(companyName)}-${kstYearMonth(at)}-`;
  const last = await db.employee.findFirst({
    where: { empCode: { startsWith: prefix } },
    orderBy: { empCode: 'desc' },
    select: { empCode: true },
  });
  const seq = last ? Number(last.empCode.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(3, '0')}`;
}
