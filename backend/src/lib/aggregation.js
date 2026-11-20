// 통합 원장(queryLedger) 결과를 여섯 축(프로젝트/현장/거래처/품목/유형/월)으로 소계 집계한다.
// 원본 갑지가 월별·현장별·거래처별 소계를 각각 피벗으로 뽑던 것을 한 번에 대신한다.
const TYPE_LABEL = {
  inbound: '입고',
  waste_inbound: '폐기물입고',
  sorting: '선별',
  outbound_sale: '매각',
  waste_outbound: '폐기물반출',
  // 이동은 재고 총량을 바꾸지 않지만 유형별 소계에는 나와야 한다.
  move: '이동',
  // 보정은 더한 것과 뺀 것이 한 줄에 섞여 들어온다 — 뺀 것은 음수로 온다.
  adjust: '조정',
};

const emptyGroup = (key, label) => ({
  key,
  label,
  inbound: 0,
  waste_inbound: 0,
  sorting: 0,
  outbound_sale: 0,
  waste_outbound: 0,
  move: 0,
  adjust: 0,
  amount: 0,
  saleAmount: 0, // 매각 매출
  wasteAmount: 0, // 폐기물 반출 처리비
  count: 0,
});

// 월·업체 기준을 무엇으로 볼지 — 상차일(기본) 또는 입금일(요청 2026-11-13).
// 입금일 기준으로 보면 아직 안 들어온 건은 월에 잡히지 않는다. 그 수도 함께 돌려준다.
export function buildAggregation(rows, { basis = 'date' } = {}) {
  const byProject = new Map();
  const bySite = new Map();
  const byVendor = new Map();
  const byItem = new Map();
  const byType = new Map();
  const byMonth = new Map();
  const byDay = new Map();
  // 칸을 미리 0으로 두지 않으면 undefined + 숫자 = NaN 이 되어 그 유형이 집계에서 사라진다.
  const totals = {
    inbound: 0,
    waste_inbound: 0,
    sorting: 0,
    outbound_sale: 0,
    waste_outbound: 0,
    move: 0,
    adjust: 0,
    amount: 0,
  };

  const addTo = (map, key, label, row) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, emptyGroup(key, label ?? key));
    const entry = map.get(key);
    const amt = Number(row.amount ?? 0);
    // 모르는 유형이 들어와도 NaN이 되지 않게 한다.
    if (entry[row.type] === undefined) entry[row.type] = 0;
    entry[row.type] += Number(row.weight ?? 0);
    entry.amount += amt;
    if (row.type === 'outbound_sale') entry.saleAmount += amt;
    if (row.type === 'waste_outbound') entry.wasteAmount += amt;
    entry.count += 1;
  };

  // 입금일 기준이면 입금일이 없는 건은 월 소계에서 빠진다 — 몇 건인지 알려 준다.
  let undated = 0;

  for (const row of rows) {
    const basisValue = basis === 'paid' ? (row.paidDate ?? null) : row.date;
    const date = basisValue ? new Date(basisValue).toISOString().slice(0, 10) : null;
    const month = date ? date.slice(0, 7) : null;
    if (basis === 'paid' && !date) undated += 1;

    addTo(byProject, row.projectId, row.projectName, row);
    addTo(bySite, row.siteName, row.siteName, row);
    if (row.vendorId) addTo(byVendor, row.vendorId, row.vendorName, row);
    if (row.itemCode) addTo(byItem, row.itemCode, row.itemName, row);
    addTo(byType, row.type, TYPE_LABEL[row.type] ?? row.type, row);
    addTo(byMonth, month, month, row);
    addTo(byDay, date, date, row);

    if (totals[row.type] === undefined) totals[row.type] = 0;
    totals[row.type] += Number(row.weight ?? 0);
    totals.amount += Number(row.amount ?? 0);
  }

  const desc = (map) => [...map.values()].sort((a, b) => b.count - a.count);

  // 업체 × 월 교차표 — 「월별 업체별 통계」를 한눈에 본다(요청 2026-11-13).
  const cross = new Map();
  for (const row of rows) {
    if (!row.vendorId) continue;
    const basisValue = basis === 'paid' ? (row.paidDate ?? null) : row.date;
    if (!basisValue) continue;
    const month = new Date(basisValue).toISOString().slice(0, 10).slice(0, 7);
    const key = `${row.vendorId}::${month}`;
    if (!cross.has(key)) {
      cross.set(key, {
        key,
        vendorId: row.vendorId,
        vendorName: row.vendorName ?? null,
        month,
        quarter: `${month.slice(0, 4)}-Q${Math.floor(Number(month.slice(5, 7)) / 3.01) + 1}`,
        outWeight: 0,
        amount: 0,
        count: 0,
      });
    }
    const c = cross.get(key);
    if (row.type === 'outbound_sale' || row.type === 'waste_outbound') c.outWeight += Number(row.weight ?? 0);
    c.amount += Number(row.amount ?? 0);
    c.count += 1;
  }

  return {
    basis,
    undated,
    byProject: desc(byProject),
    bySite: desc(bySite),
    byVendor: desc(byVendor),
    byItem: desc(byItem),
    byType: [...byType.values()],
    // 추이는 시간순이어야 읽힌다.
    byMonth: [...byMonth.values()].sort((a, b) => a.key.localeCompare(b.key)),
    byVendorMonth: [...cross.values()].sort((a, b) => a.month.localeCompare(b.month) || b.amount - a.amount),
    byDay: [...byDay.values()].sort((a, b) => a.key.localeCompare(b.key)),
    totals,
  };
}
