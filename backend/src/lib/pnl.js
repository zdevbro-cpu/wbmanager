import { prisma } from './prisma.js';
import { getInventoryValuation } from './inventory.js';

// 차수(프로젝트) 손익 계산: 실현손익 + 재고평가(미실현) = 예상 최종손익
export async function getProjectPnl(projectId) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return null;

  const [salesAgg, wasteAgg, transportAgg, laborAgg, valuation] = await Promise.all([
    prisma.outboundSale.aggregate({ where: { projectId }, _sum: { amount: true } }),
    prisma.wasteOutbound.aggregate({ where: { projectId }, _sum: { amount: true } }),
    prisma.transport.aggregate({ where: { projectId }, _sum: { supplyAmount: true, taxAmount: true } }),
    prisma.labor.aggregate({ where: { projectId }, _sum: { totalAmount: true } }),
    getInventoryValuation({ projectId }),
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

  return {
    projectId,
    roundName: project.roundName,
    purchaseCost,
    salesRevenue,
    wasteCost,
    transportCost,
    laborCost,
    totalCost,
    realizedPnl,
    inventoryValuation,
    expectedFinalPnl,
    inventoryDetail: valuation.rows,
  };
}
