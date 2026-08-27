import { prisma } from './prisma.js';
import { getInventoryValuation } from './inventory.js';

// 차수(프로젝트) 손익 계산: 실현손익 + 재고평가(미실현) = 예상 최종손익
// 물량 회수 현황·품목별 매각 구성은 대표이사 손익보고(data/대표이사보고_26-1차_손익현황.docx)가
// 매번 손으로 계산하던 값이라 함께 산출한다.
export async function getProjectPnl(projectId) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return null;

  const [salesAgg, wasteAgg, transportAgg, laborAgg, valuation, inboundAgg, wasteInAgg, saleRows] = await Promise.all([
    prisma.outboundSale.aggregate({
      where: { projectId, deletedAt: null },
      _sum: { amount: true, settledWeight: true },
    }),
    prisma.wasteOutbound.aggregate({ where: { projectId, deletedAt: null }, _sum: { amount: true, weight: true } }),
    prisma.transport.aggregate({ where: { projectId }, _sum: { supplyAmount: true, taxAmount: true } }),
    prisma.labor.aggregate({ where: { projectId }, _sum: { totalAmount: true } }),
    getInventoryValuation({ projectId }),
    prisma.inbound.aggregate({ where: { projectId, deletedAt: null }, _sum: { netWeight: true } }),
    prisma.wasteInbound.aggregate({ where: { projectId, deletedAt: null }, _sum: { netWeight: true } }),
    prisma.outboundSale.findMany({
      where: { projectId, deletedAt: null },
      include: { item: true },
    }),
  ]);

  const purchaseCost = Number(project.purchasePrice ?? 0);
  const salesRevenue = Number(salesAgg._sum.amount ?? 0);
  const wasteCost = Number(wasteAgg._sum.amount ?? 0);
  const transportCost = Number(transportAgg._sum.supplyAmount ?? 0) + Number(transportAgg._sum.taxAmount ?? 0);
  const laborCost = Number(laborAgg._sum.totalAmount ?? 0);
  const totalCost = purchaseCost + wasteCost + transportCost + laborCost;

  const realizedPnl = salesRevenue - totalCost;
  const inventoryValuation = valuation.totalValuation;
  const expectedFinalPnl = realizedPnl + inventoryValuation;

  // ── 물량 회수 현황 ──
  const inboundWeight = Number(inboundAgg._sum.netWeight ?? 0) + Number(wasteInAgg._sum.netWeight ?? 0);
  const soldWeight = Number(salesAgg._sum.settledWeight ?? 0);
  const wasteOutWeight = Number(wasteAgg._sum.weight ?? 0);
  const remainingWeight = valuation.rows.reduce((sum, r) => sum + Number(r.remaining ?? 0), 0);
  const recoveryRate = inboundWeight > 0 ? (soldWeight / inboundWeight) * 100 : 0;
  const avgSalePrice = soldWeight > 0 ? salesRevenue / soldWeight : 0;
  // 매입원가 회수까지 남은 금액 — 보고서의 "추가 매각 필요액"
  const purchaseRecoveryGap = Math.max(0, purchaseCost - salesRevenue);

  // ── 품목별 매각 구성 ──
  const itemMap = new Map();
  for (const r of saleRows) {
    const key = r.itemCode ?? '미분류';
    if (!itemMap.has(key)) {
      itemMap.set(key, {
        itemCode: key,
        itemName: r.item?.itemName ?? key,
        category: r.item?.category ?? null,
        weight: 0,
        amount: 0,
      });
    }
    const entry = itemMap.get(key);
    entry.weight += Number(r.settledWeight ?? 0);
    entry.amount += Number(r.amount ?? 0);
  }
  const salesByItem = [...itemMap.values()]
    .map((e) => ({
      ...e,
      avgPrice: e.weight > 0 ? e.amount / e.weight : 0,
      amountShare: salesRevenue > 0 ? (e.amount / salesRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    projectId,
    roundName: project.roundName,
    contractWeight: project.contractWeight ? Number(project.contractWeight) : null,
    purchaseCost,
    salesRevenue,
    wasteCost,
    transportCost,
    laborCost,
    totalCost,
    realizedPnl,
    inventoryValuation,
    expectedFinalPnl,
    inboundWeight,
    soldWeight,
    wasteOutWeight,
    remainingWeight,
    recoveryRate,
    avgSalePrice,
    purchaseRecoveryGap,
    salesByItem,
    inventoryDetail: valuation.rows,
  };
}
