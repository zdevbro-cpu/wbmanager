import { prisma } from './prisma.js';

// 품목이 확정된 물량 트랜잭션(선별/매각/폐기물반출) 발생 시 재고원장에 자동 반영한다.
// direction: 'IN' | 'OUT'
export async function postLedgerEntry({ projectId, itemCode, direction, weight, ledgerDate, refType, refId }, tx = prisma) {
  return tx.inventoryLedger.create({
    data: { projectId, itemCode, direction, weight, ledgerDate, refType, refId },
  });
}
