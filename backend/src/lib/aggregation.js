// 통합 원장(queryLedger) 결과를 여섯 축(프로젝트/현장/거래처/품목/유형/월)으로 소계 집계한다.
// 원본 갑지가 월별·현장별·거래처별 소계를 각각 피벗으로 뽑던 것을 한 번에 대신한다.
const TYPE_LABEL = {
  inbound: '입고',
  waste_inbound: '폐기물입고',
  sorting: '선별',
  outbound_sale: '매각',
  waste_outbound: '폐기물반출',
};

const emptyGroup = (key, label) => ({
  key,
  label,
  inbound: 0,
  waste_inbound: 0,
  sorting: 0,
  outbound_sale: 0,
  waste_outbound: 0,
  amount: 0,
  saleAmount: 0, // 매각 매출
  wasteAmount: 0, // 폐기물 반출 처리비
  count: 0,
});

export function buildAggregation(rows) {
  const byProject = new Map();
  const bySite = new Map();
  const byVendor = new Map();
  const byItem = new Map();
  const byType = new Map();
  const byMonth = new Map();
  const byDay = new Map();
  const totals = { inbound: 0, waste_inbound: 0, sorting: 0, outbound_sale: 0, waste_outbound: 0, amount: 0 };

  const addTo = (map, key, label, row) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, emptyGroup(key, label ?? key));
    const entry = map.get(key);
    const amt = Number(row.amount ?? 0);
    entry[row.type] += Number(row.weight ?? 0);
    entry.amount += amt;
    if (row.type === 'outbound_sale') entry.saleAmount += amt;
    if (row.type === 'waste_outbound') entry.wasteAmount += amt;
    entry.count += 1;
  };

  for (const row of rows) {
    const date = row.date ? new Date(row.date).toISOString().slice(0, 10) : null;
    const month = date ? date.slice(0, 7) : null;

    addTo(byProject, row.projectId, row.projectName, row);
    addTo(bySite, row.siteName, row.siteName, row);
    if (row.vendorId) addTo(byVendor, row.vendorId, row.vendorName, row);
    if (row.itemCode) addTo(byItem, row.itemCode, row.itemName, row);
    addTo(byType, row.type, TYPE_LABEL[row.type] ?? row.type, row);
    addTo(byMonth, month, month, row);
    addTo(byDay, date, date, row);

    totals[row.type] += Number(row.weight ?? 0);
    totals.amount += Number(row.amount ?? 0);
  }

  const desc = (map) => [...map.values()].sort((a, b) => b.count - a.count);

  return {
    byProject: desc(byProject),
    bySite: desc(bySite),
    byVendor: desc(byVendor),
    byItem: desc(byItem),
    byType: [...byType.values()],
    // 추이는 시간순이어야 읽힌다.
    byMonth: [...byMonth.values()].sort((a, b) => a.key.localeCompare(b.key)),
    byDay: [...byDay.values()].sort((a, b) => a.key.localeCompare(b.key)),
    totals,
  };
}
