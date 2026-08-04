import { prisma } from './prisma.js';

// 프로젝트×품목 기준 재고 스냅샷: Σ입고(IN) - Σ출고(OUT) = 잔량 (F-JUVSRN)
export async function getInventorySnapshot({ projectId, itemCode } = {}) {
  const grouped = await prisma.inventoryLedger.groupBy({
    by: ['projectId', 'itemCode', 'direction'],
    where: {
      ...(projectId ? { projectId } : {}),
      ...(itemCode ? { itemCode } : {}),
    },
    _sum: { weight: true },
  });

  const map = new Map();
  for (const g of grouped) {
    const key = `${g.projectId}::${g.itemCode}`;
    if (!map.has(key)) {
      map.set(key, { projectId: g.projectId, itemCode: g.itemCode, inWeight: 0, outWeight: 0 });
    }
    const entry = map.get(key);
    const weight = Number(g._sum.weight ?? 0);
    if (g.direction === 'IN') entry.inWeight += weight;
    else entry.outWeight += weight;
  }

  const rows = [...map.values()].map((r) => ({ ...r, remaining: r.inWeight - r.outWeight }));

  const projectIds = [...new Set(rows.map((r) => r.projectId))];
  const itemCodes = [...new Set(rows.map((r) => r.itemCode))];
  const [projects, items] = await Promise.all([
    prisma.project.findMany({ where: { id: { in: projectIds } } }),
    prisma.itemMaster.findMany({ where: { itemCode: { in: itemCodes } } }),
  ]);
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const itemMap = new Map(items.map((i) => [i.itemCode, i]));

  return rows.map((r) => ({
    ...r,
    projectName: projectMap.get(r.projectId)?.roundName ?? null,
    itemName: itemMap.get(r.itemCode)?.itemName ?? null,
  }));
}

// 특정 프로젝트×품목의 재고원장 상세 내역 (드릴다운, S-HPWLTV)
export async function getInventoryEntries(projectId, itemCode) {
  return prisma.inventoryLedger.findMany({
    where: { projectId, itemCode },
    orderBy: { ledgerDate: 'desc' },
  });
}

// 해당 품목/프로젝트에 적용할 추정단가를 조회한다.
// 우선순위: 해당 차수 전용 단가(최신) > 전체 적용 단가(최신) > ItemMaster.basePrice
export async function resolveUnitPrice(itemCode, projectId, asOfDate) {
  const dateFilter = asOfDate ? { lte: new Date(asOfDate) } : undefined;

  const projectSpecific = projectId
    ? await prisma.itemPriceHistory.findFirst({
        where: { itemCode, projectId, ...(dateFilter ? { effectiveDate: dateFilter } : {}) },
        orderBy: { effectiveDate: 'desc' },
      })
    : null;
  if (projectSpecific) return { price: Number(projectSpecific.price), source: 'project' };

  const global = await prisma.itemPriceHistory.findFirst({
    where: { itemCode, projectId: null, ...(dateFilter ? { effectiveDate: dateFilter } : {}) },
    orderBy: { effectiveDate: 'desc' },
  });
  if (global) return { price: Number(global.price), source: 'global' };

  const item = await prisma.itemMaster.findUnique({ where: { itemCode } });
  return { price: Number(item?.basePrice ?? 0), source: 'base' };
}

// 재고평가(미실현 손익) = 잔량 × 적용단가 (F-KGKYJL)
export async function getInventoryValuation({ projectId, asOf } = {}) {
  const snapshot = await getInventorySnapshot({ projectId });
  const valued = [];
  for (const row of snapshot) {
    const { price, source } = await resolveUnitPrice(row.itemCode, row.projectId, asOf);
    valued.push({ ...row, unitPrice: price, priceSource: source, valuationAmount: row.remaining * price });
  }
  const totalValuation = valued.reduce((sum, r) => sum + r.valuationAmount, 0);
  return { rows: valued, totalValuation };
}
