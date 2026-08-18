// 발행 보고서 엑셀 생성 — 손익보고 / 일일 출고보고.
// 워드 양식과 같은 구성·문구를 쓰되, 표를 시트 셀로 내려 그대로 편집·재집계할 수 있게 한다.
import ExcelJS from 'exceljs';

const HEADER_FILL = 'FFEFEFEF';

const n = (v) => Math.round(Number(v ?? 0));
const pct = (v) => `${Number(v ?? 0).toFixed(1)}%`;

function newBook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'wbmanager';
  wb.created = new Date();
  return wb;
}

function addTitle(ws, text, span) {
  const row = ws.addRow([text]);
  ws.mergeCells(row.number, 1, row.number, span);
  row.font = { bold: true, size: 16 };
  row.height = 24;
  return row;
}

function addMeta(ws, text, span) {
  const row = ws.addRow([text]);
  ws.mergeCells(row.number, 1, row.number, span);
  row.font = { size: 9, color: { argb: 'FF666666' } };
  return row;
}

function addSection(ws, text, span) {
  ws.addRow([]);
  const row = ws.addRow([text]);
  ws.mergeCells(row.number, 1, row.number, span);
  row.font = { bold: true, size: 12, color: { argb: 'FF1F4E79' } };
  return row;
}

// numberCols에 든 열은 숫자 서식(#,##0)으로 둔다 — 받는 쪽에서 바로 재집계할 수 있어야 한다.
function addTable(ws, headers, rows, { numberCols = [], lastRowBold = false } = {}) {
  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.border = { bottom: { style: 'thin' }, top: { style: 'thin' } };
    cell.alignment = { horizontal: 'center' };
  });

  rows.forEach((r, idx) => {
    const row = ws.addRow(r);
    row.eachCell((cell, col) => {
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFDDDDDD' } } };
      if (numberCols.includes(col)) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right' };
      }
    });
    if (lastRowBold && idx === rows.length - 1) row.font = { bold: true };
  });
  return headerRow;
}

function setWidths(ws, widths) {
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}

function addWrapped(ws, text, span) {
  const row = ws.addRow([text]);
  ws.mergeCells(row.number, 1, row.number, span);
  row.alignment = { wrapText: true, vertical: 'top' };
  return row;
}

// ── 손익 보고 ──────────────────────────────────────────────
export async function buildPnlXlsx(payload) {
  // 예전에 발행된 보고서는 일부 항목이 없을 수 있어 기본값으로 채운다.
  const p = {
    roundName: '-',
    reportDate: new Date().toISOString().slice(0, 10),
    salesRevenue: 0,
    totalCost: 0,
    purchaseCost: 0,
    realizedPnl: 0,
    inventoryValuation: 0,
    expectedFinalPnl: 0,
    inboundWeight: 0,
    soldWeight: 0,
    wasteOutWeight: 0,
    remainingWeight: 0,
    recoveryRate: 0,
    avgSalePrice: 0,
    purchaseRecoveryGap: 0,
    ...payload,
    salesByItem: payload?.salesByItem ?? [],
    inventoryDetail: payload?.inventoryDetail ?? [],
  };

  const wb = newBook();
  const ws = wb.addWorksheet('손익 보고');
  setWidths(ws, [30, 18, 18, 16, 14]);

  addTitle(ws, `${p.roundName}${p.roundNo ? ` ${p.roundNo}` : ''} 손익 현황 보고`, 5);
  addMeta(ws, `보고일: ${p.reportDate}   |   작성: 크로스특수   |   기준: 반입·반출·인건비·운송 등록 데이터`, 5);

  addSection(ws, '1. 핵심 결론 (요약)', 5);
  const won = (v) => `${n(v).toLocaleString()}원`;
  const kg = (v) => `${n(v).toLocaleString()}kg`;
  [
    p.realizedPnl >= 0
      ? `현재 장부상 실현손익은 ${won(p.realizedPnl)} 흑자입니다.`
      : `현재 장부상 손익은 ${won(p.realizedPnl)}으로 표시되나, 적자 확정이 아니라 작업이 진행 중인 중간 시점의 수치입니다. 잔여 재고 ${kg(p.remainingWeight)}가 처분되면 손익이 달라집니다.`,
    `반입 ${kg(p.inboundWeight)} 중 ${kg(p.soldWeight)} 매각(회수율 ${pct(p.recoveryRate)}), 잔여 ${kg(p.remainingWeight)}.`,
    p.purchaseRecoveryGap > 0
      ? `매입원가 회수 관점: 매각 ${won(p.salesRevenue)} − 매입가 ${won(p.purchaseCost)} → 회수까지 약 ${won(p.purchaseRecoveryGap)}의 추가 매각이 필요합니다.`
      : '매각수입이 매입원가를 회수했습니다.',
  ].forEach((line) => addWrapped(ws, `· ${line}`, 5));

  addSection(ws, '2. 손익 3단 요약', 5);
  addTable(
    ws,
    ['구분', '금액(원)', '비고'],
    [
      ['매각 수입 (실현)', n(p.salesRevenue), `회수율 ${pct(p.recoveryRate)}`],
      ['총 지출', -n(p.totalCost), '매입+폐기물+운송+인건비'],
      ['① 실현손익', n(p.realizedPnl), '현재 장부'],
      ['② 재고평가 (미실현, 추정)', n(p.inventoryValuation), `잔여 ${kg(p.remainingWeight)}`],
      ['③ 예상 최종손익 (①+②)', n(p.expectedFinalPnl), '재고 처분 가정'],
    ],
    { numberCols: [2], lastRowBold: true },
  );

  addSection(ws, '3. 자재 회수(매각) 현황', 5);
  addTable(
    ws,
    ['항목', '값'],
    [
      ['반입 총중량(kg)', n(p.inboundWeight)],
      ...(p.contractWeight ? [['계약중량(kg)', n(p.contractWeight)]] : []),
      ['매각 중량(kg)', n(p.soldWeight)],
      ['폐기물 반출(kg)', n(p.wasteOutWeight)],
      ['잔여(야적)(kg)', n(p.remainingWeight)],
      ['회수율(%)', Number(Number(p.recoveryRate ?? 0).toFixed(1))],
      ['매각 평균단가(원/kg)', n(p.avgSalePrice)],
      ['매입원가 회수 잔여(원)', n(p.purchaseRecoveryGap)],
    ],
    { numberCols: [2] },
  );

  addSection(ws, '4. 품목별 매각 구성', 5);
  if (p.salesByItem.length) {
    addTable(
      ws,
      ['품목', '매각중량(kg)', '매각금액(원)', '평균단가(원)', '비중(%)'],
      [
        ...p.salesByItem.map((i) => [
          i.itemName,
          n(i.weight),
          n(i.amount),
          n(i.avgPrice),
          Number(Number(i.amountShare ?? 0).toFixed(1)),
        ]),
        ['매각 합계', n(p.soldWeight), n(p.salesRevenue), n(p.avgSalePrice), 100],
      ],
      { numberCols: [2, 3, 4, 5], lastRowBold: true },
    );
  } else {
    ws.addRow(['매각 실적이 없습니다.']);
  }

  addSection(ws, '5. 재고평가 상세 (추정)', 5);
  if (p.inventoryDetail.length) {
    addTable(
      ws,
      ['품목', '잔량(kg)', '적용단가(원)', '평가금액(원)'],
      p.inventoryDetail.map((r) => [
        r.itemName ?? r.itemCode,
        n(r.remaining),
        n(r.unitPrice),
        n(r.valuationAmount ?? r.valuation),
      ]),
      { numberCols: [2, 3, 4] },
    );
  } else {
    ws.addRow(['잔여 재고가 없습니다.']);
  }

  ws.addRow([]);
  const note = addWrapped(
    ws,
    '※ 금액은 시스템에 등록된 반입·반출·운송·인건비 데이터를 집계·재계산한 것이며, 재고평가는 추정단가를 적용한 추정치입니다. 손익 확정은 잔여 재고 처분 후에 가능합니다.',
    5,
  );
  note.font = { size: 9, color: { argb: 'FF666666' } };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

const TYPE_LABEL = { outbound_sale: '매각', waste_outbound: '폐기물반출' };

// ── 일일 출고보고 ──────────────────────────────────────────
// 보고 양식: 프로젝트마다 "스크랩 출고현황"과 "폐기물 출고현황"을 따로 두고,
// 구분·거래처명·제품명·실중량·비고 순으로 적은 뒤 반출합계로 닫는다.
export async function buildDailyXlsx(payload) {
  const date = payload?.date ?? new Date().toISOString().slice(0, 10);
  const groups = (payload?.groups ?? []).map((g) => ({ ...g, rows: g.rows ?? [] }));
  const summary = payload?.summary ?? { count: 0, totalWeight: 0, totalAmount: 0 };
  const activeGroups = groups.filter((g) => g.rows.length > 0);
  const pick = (type) => groups.flatMap((g) => g.rows.filter((r) => r.type === type));
  const sum = (rows, key) => rows.reduce((acc, r) => acc + Number(r[key] ?? 0), 0);
  // 실중량이 없으면 정산중량을 쓴다 — 계근 항목이 비어 있는 예전 등록건 대비.
  const weightOf = (r) => Number(r.actualWeight ?? r.weight ?? 0);

  const wb = newBook();
  const ws = wb.addWorksheet('일일 출고보고');
  setWidths(ws, [8, 22, 20, 14, 14, 34]);

  addTitle(ws, `${date} 일일 출고보고`, 6);
  addMeta(ws, '작성: 크로스특수   |   기준: 매각·폐기물반출 등록 데이터', 6);

  addSection(ws, '1. 전체 요약', 6);
  const sales = pick('outbound_sale');
  const wastes = pick('waste_outbound');
  const paidCount = [...sales, ...wastes].filter((r) => r.paidDate).length;
  addTable(
    ws,
    ['구분', '건수', '실중량(kg)', '금액(원)', '입금완료'],
    [
      ['스크랩 매각', sales.length, n(sum(sales.map((r) => ({ w: weightOf(r) })), 'w')), n(sum(sales, 'amount')), sales.filter((r) => r.paidDate).length],
      ['폐기물 반출', wastes.length, n(sum(wastes.map((r) => ({ w: weightOf(r) })), 'w')), n(sum(wastes, 'amount')), wastes.filter((r) => r.paidDate).length],
      ['합계', n(summary.count), n(sum([...sales, ...wastes].map((r) => ({ w: weightOf(r) })), 'w')), n(summary.totalAmount), paidCount],
    ],
    { numberCols: [2, 3, 4, 5], lastRowBold: true },
  );
  addMeta(ws, `진행 프로젝트 ${groups.length}개 중 ${activeGroups.length}개 출고 · 입금 완료 ${paidCount}건 / ${summary.count}건`, 6);

  // 프로젝트 × 구분별 표 — 첨부 보고 양식과 같은 모양으로 낸다.
  const block = (title, rows) => {
    const head = ws.addRow([title, '', '', '', '', date]);
    ws.mergeCells(head.number, 1, head.number, 5);
    head.font = { bold: true, size: 11 };
    head.getCell(6).alignment = { horizontal: 'right' };
    head.getCell(6).font = { size: 9, color: { argb: 'FF666666' } };

    addTable(
      ws,
      ['구분', '거래처명', '제품명', '실중량(kg)', '입금여부', '비고'],
      [
        ...rows.map((r, i) => [
          i + 1,
          r.vendorName ?? '-',
          r.itemName ?? '-',
          n(weightOf(r)),
          r.paidDate ? `완료 ${String(r.paidDate).slice(0, 10)}` : '미입금',
          r.memo ?? '',
        ]),
        ['반출합계', '', '', n(rows.reduce((acc, r) => acc + weightOf(r), 0)), '', ''],
      ],
      { numberCols: [4], lastRowBold: true },
    );
    ws.addRow([]);
  };

  addSection(ws, '2. 프로젝트별 출고현황', 6);
  if (groups.length === 0) {
    ws.addRow(['진행 중인 프로젝트가 없습니다.']);
  } else {
    groups.forEach((g) => {
      const name = g.projectName ?? '-';
      const scrap = g.rows.filter((r) => r.type === 'outbound_sale');
      const waste = g.rows.filter((r) => r.type === 'waste_outbound');

      if (scrap.length === 0 && waste.length === 0) {
        const row = ws.addRow([`${name} — 출고 없음`]);
        ws.mergeCells(row.number, 1, row.number, 6);
        row.font = { color: { argb: 'FF888888' } };
        ws.addRow([]);
        return;
      }
      if (scrap.length) block(`${name} 스크랩 출고현황`, scrap);
      if (waste.length) block(`${name} 폐기물 출고현황`, waste);
    });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
