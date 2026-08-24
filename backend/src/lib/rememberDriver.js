import { prisma } from './prisma.js';

// 등록 화면에서 손으로 적은 운전자를 외부 운전자 목록에 올려 둔다.
// 다음 등록부터는 이름으로 찾아 고를 수 있고, 연락처도 함께 채워진다.
// 임직원과 같은 이름은 건너뛴다 — 임직원 목록에서 이미 고를 수 있기 때문이다.
// 저장 실패로 거래 등록까지 막지는 않는다 — 어디까지나 편의를 위한 보조 기록이다.
export async function rememberDriver(rawName, rawPhone, tx = prisma) {
  const name = String(rawName ?? '').trim();
  if (!name) return;
  const phone = String(rawPhone ?? '').trim() || null;

  try {
    const employee = await tx.employee.findFirst({ where: { name } });
    if (employee) return;

    const existing = await tx.externalDriver.findUnique({ where: { name } });
    if (existing) {
      // 이미 있는 기사는 비어 있던 연락처만 채운다. 적어 둔 값을 덮어쓰지 않는다.
      if (phone && !existing.phone) {
        await tx.externalDriver.update({ where: { name }, data: { phone } });
      }
      return;
    }
    await tx.externalDriver.create({ data: { name, phone } });
  } catch (err) {
    console.error('[external-driver] 자동 등록 실패:', name, err.message);
  }
}
