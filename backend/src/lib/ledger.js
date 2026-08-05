import { prisma } from './prisma.js';

// 품목이 지정되지 않은 반입 물량을 담아 두는 품목. 입고 시점에 제품명을 모르는 건도
// 재고에서 누락되지 않도록 이 품목으로 계상하고, 선별에서 실제 품목으로 재분류한다.
export const UNCLASSIFIED_ITEM_CODE = 'UNCLASSIFIED';

// 물량 트랜잭션 발생 시 재고원장에 반영한다. direction: 'IN' | 'OUT'
export async function postLedgerEntry({ projectId, itemCode, direction, weight, ledgerDate, refType, refId }, tx = prisma) {
  return tx.inventoryLedger.create({
    data: { projectId, itemCode, direction, weight, ledgerDate, refType, refId },
  });
}

// 미분류 품목이 없으면 만들어 둔다. 재고원장이 item_master를 참조하므로 선행되어야 한다.
export async function ensureUnclassifiedItem(tx = prisma) {
  await tx.itemMaster.upsert({
    where: { itemCode: UNCLASSIFIED_ITEM_CODE },
    update: {},
    create: {
      itemCode: UNCLASSIFIED_ITEM_CODE,
      category: '미분류',
      itemName: '미분류',
    },
  });
  return UNCLASSIFIED_ITEM_CODE;
}

// 입고 계열(입고/폐기물입고)을 재고원장에 IN으로 계상한다.
// 회사의 재고 정의가 `재고 = 입고 - 출고`(갑지 기준)이므로 입고가 재고의 시작점이다.
export async function postInboundLedger({ projectId, itemCode, weight, ledgerDate, refType, refId }, tx = prisma) {
  const code = itemCode || (await ensureUnclassifiedItem(tx));
  return postLedgerEntry(
    { projectId, itemCode: code, direction: 'IN', weight, ledgerDate, refType, refId },
    tx,
  );
}
