// 통합 원장(queryLedger) 결과를 프로젝트/거래처/품목 기준으로 소계 집계한다. (갑지 대체)
export function buildAggregation(rows) {
  const byProject = new Map();
  const byVendor = new Map();
  const byItem = new Map();
  const totals = { inbound: 0, waste_inbound: 0, sorting: 0, outbound_sale: 0, waste_outbound: 0, amount: 0 };

  const addTo = (map, key, label, row) => {
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, { key, label, inbound: 0, waste_inbound: 0, sorting: 0, outbound_sale: 0, waste_outbound: 0, amount: 0, count: 0 });
    }
    const entry = map.get(key);
    entry[row.type] += Number(row.weight ?? 0);
    entry.amount += Number(row.amount ?? 0);
    entry.count += 1;
  };

  for (const row of rows) {
    addTo(byProject, row.projectId, row.projectName, row);
    if (row.vendorId) addTo(byVendor, row.vendorId, row.vendorName, row);
    if (row.itemCode) addTo(byItem, row.itemCode, row.itemName, row);

    totals[row.type] += Number(row.weight ?? 0);
    totals.amount += Number(row.amount ?? 0);
  }

  return {
    byProject: [...byProject.values()],
    byVendor: [...byVendor.values()],
    byItem: [...byItem.values()],
    totals,
  };
}
