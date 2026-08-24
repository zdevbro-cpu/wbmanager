import { prisma } from './prisma.js';

// 등록 화면에서 손으로 적은 값(배출자·운반자·처리자·상차지·하차지)을 공통코드에 쌓아 둔다.
// 다음 등록부터는 목록에서 고를 수 있고, 잘못 들어간 값은 공통코드 관리에서 지운다.
// 저장 실패로 거래 등록까지 막지는 않는다 — 어디까지나 편의를 위한 보조 기록이다.
export async function rememberCodes(pairs, tx = prisma) {
  for (const [group, raw] of pairs) {
    const label = String(raw ?? '').trim();
    if (!label) continue;
    try {
      await tx.commonCode.upsert({
        where: { group_label: { group, label } },
        update: {},
        create: { group, label },
      });
    } catch (err) {
      console.error('[common-code] 자동 등록 실패:', group, label, err.message);
    }
  }
}
