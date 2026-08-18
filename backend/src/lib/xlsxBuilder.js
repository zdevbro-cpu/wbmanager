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

// 좌측 제목 + 우측 기준일. 제목만 병합해 날짜 칸을 덮지 않게 한다.
function addTitleWithDate(ws, text, dateText, span) {
  const row = ws.addRow([]);
  row.getCell(1).value = text;
  row.getCell(1).font = { bold: true, size: 14 };
  ws.mergeCells(row.number, 1, row.number, span - 1);
  row.getCell(span).value = dateText;
  row.getCell(span).font = { size: 9, color: { argb: 'FF666666' } };
  row.getCell(span).alignment = { horizontal: 'right' };
  row.height = 22;
  return row;
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
// 사무실에서 돌리는 "스크랩 및 폐기물 반출 보고자료" 통합문서를 그대로 만든다.
// 시트 구성·컬럼·표기(원본의 '프로잭트명' 표기 포함)를 맞추고, A열은 원본처럼 여백으로 둔다.
const TITLE_COLOR = 'FF0000FF';

function listTitle(ws, text, dateText, lastCol) {
  const row = ws.addRow([]);
  row.getCell(2).value = text;
  row.getCell(2).font = { bold: true, size: 16, color: { argb: TITLE_COLOR } };
  ws.mergeCells(row.number, 2, row.number, lastCol - 3);
  row.getCell(lastCol).value = dateText;
  row.getCell(lastCol).font = { size: 10, color: { argb: 'FF666666' } };
  row.getCell(lastCol).alignment = { horizontal: 'right' };
  row.height = 22;
  return row;
}

// 표 한 줄 — A열을 비우고 B열부터 채운다.
function listRow(ws, values, opts) {
  const { bold = false, numberCols = [] } = opts || {};
  const row = ws.addRow(['', ...values]);
  row.eachCell({ includeEmpty: true }, (cell, col) => {
    if (col === 1) return;
    cell.border = {
      top: { style: 'hair', color: { argb: 'FFBFBFBF' } },
      bottom: { style: 'hair', color: { argb: 'FFBFBFBF' } },
      left: { style: 'hair', color: { argb: 'FFBFBFBF' } },
      right: { style: 'hair', color: { argb: 'FFBFBFBF' } },
    };
    cell.font = bold ? { size: 10, bold: true } : { size: 10 };
    if (numberCols.includes(col)) {
      cell.numFmt = '#,##0';
      cell.alignment = { horizontal: 'right' };
    }
  });
  return row;
}

function listHeader(ws, values) {
  const row = listRow(ws, values, { bold: true });
  row.eachCell({ includeEmpty: true }, (cell, col) => {
    if (col === 1) return;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  return row;
}

export async function buildDailyXlsx(payload) {
  const date = payload?.date ?? new Date().toISOString().slice(0, 10);
  const groups = (payload?.groups ?? []).map((g) => ({ ...g, rows: g.rows ?? [] }));
  const all = groups.flatMap((g) => g.rows.map((r) => ({ ...r, projectName: g.projectName ?? '-' })));
  const scrapAll = all.filter((r) => r.type === 'outbound_sale');
  const wasteAll = all.filter((r) => r.type === 'waste_outbound');
  // 실중량이 없으면 정산중량을 쓴다 — 계근 항목이 비어 있는 예전 등록건 대비.
  const weightOf = (r) => Number(r.actualWeight ?? r.weight ?? 0);
  const day = (v) => (v ? String(v).slice(0, 10) : '');
  const sum = (rows, pick) => rows.reduce((acc, r) => acc + Number(pick(r) ?? 0), 0);

  const wb = newBook();

  /* 시트1 계근공유방 보고자료 */
  const ws = wb.addWorksheet('계근공유방 보고자료');
  setWidths(ws, [6, 15, 16, 13, 37]);
  const t1 = ws.addRow(['계근 공유방 보고 자료']);
  ws.mergeCells(t1.number, 1, t1.number, 5);
  t1.font = { bold: true, size: 14 };
  t1.height = 22;
  ws.addRow([]);

  const block = (title, rows) => {
    const head = ws.addRow([]);
    head.getCell(1).value = 'ㅁ ' + title;
    head.getCell(1).font = { bold: true, size: 11 };
    ws.mergeCells(head.number, 1, head.number, 4);
    head.getCell(5).value = date;
    head.getCell(5).font = { size: 10 };
    head.getCell(5).alignment = { horizontal: 'right' };

    addTable(
      ws,
      ['구분', '거래처명', '제품명', '실중량(kg)', '비고'],
      [
        ...rows.map((r, i) => [i + 1, r.vendorName ?? '', r.itemName ?? '', n(weightOf(r)), r.memo ?? '']),
        ['반출합계', '', '', n(sum(rows, weightOf)), ''],
      ],
      { numberCols: [4], lastRowBold: true },
    );
    ws.addRow([]);
  };

  if (!scrapAll.length && !wasteAll.length) {
    ws.addRow(['그날 반출 내역이 없습니다.']);
  } else {
    groups.forEach((g) => {
      const name = g.projectName ?? '-';
      const scrap = g.rows.filter((r) => r.type === 'outbound_sale');
      const waste = g.rows.filter((r) => r.type === 'waste_outbound');
      if (scrap.length) block(name + ' 스크랩 출고현황', scrap);
      if (waste.length) block(name + ' 폐기물 출고현황', waste);
    });
  }

  /* 시트2 스크랩반출List */
  const s2 = wb.addWorksheet('스크랩반출List');
  setWidths(s2, [2, 5, 5, 13, 11, 8, 13, 15, 13, 8, 13, 12, 8, 7, 11, 7, 11, 11, 11, 10, 10, 8, 15, 9, 49]);
  listTitle(s2, '□ 원방 스크랩 반출보고', date + ' 기준', 25);

  const h2 = listHeader(s2, [
    'No', 'No(2)', '프로잭트명', '반출날짜', '상차지', '차량번호', '운전자', '연락처', '차량타입',
    '거래처', '상차제품', '단가', '계 근 내 역', '', '', '',
    '스크랩중량', '스크랩중량(원방)', '정산 감량', '정산 중량', '계근차', '결제금액', '입금여부', '운송중 특이사항 기록',
  ]);
  s2.mergeCells(h2.number, 14, h2.number, 17);

  const s2Num = [13, 15, 17, 18, 19, 20, 21, 23];
  scrapAll.forEach((r, i) => {
    listRow(
      s2,
      [
        i + 1, i + 1, r.projectName, day(r.date), r.loadingPoint ?? '', r.vehicleNo ?? '', r.driverName ?? '',
        r.driverPhone ?? '', r.vehicleType ?? '', r.vendorName ?? '', r.itemName ?? '', n(r.unitPrice),
        '', n(r.grossWeight), '', n(r.tareWeight),
        n(weightOf(r)), '', n(r.lossWeight), n(r.weight), '', n(r.amount), r.paidDate ? 'O' : 'X', r.memo ?? '',
      ],
      { numberCols: s2Num },
    );
  });
  const f2 = listRow(
    s2,
    [
      '합 계', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
      n(sum(scrapAll, weightOf)), '', n(sum(scrapAll, (r) => r.lossWeight)), n(sum(scrapAll, (r) => r.weight)),
      '', n(sum(scrapAll, (r) => r.amount)), '', '',
    ],
    { bold: true, numberCols: s2Num },
  );
  s2.mergeCells(f2.number, 2, f2.number, 13);

  /* 시트3 폐기물반출List */
  const s3 = wb.addWorksheet('폐기물반출List');
  setWidths(s3, [2, 5, 5, 12, 12, 8, 9, 9, 13, 12, 9, 11, 6, 8, 10, 9, 49]);
  listTitle(s3, '□ 원방 폐기물 반출보고', date + ' 기준', 17);

  listHeader(s3, [
    'No', 'No(2)', '프로잭트명', '반출날짜', '상차지', '배출자', '운반자', '처리자', '상차제품',
    '단가', '스크랩중량', '루베', '운반비', '처리비', '결제금액', '운송중 특이사항 기록',
  ]);

  const s3Num = [11, 12, 13, 14, 15, 16];
  wasteAll.forEach((r, i) => {
    listRow(
      s3,
      [
        i + 1, i + 1, r.projectName, day(r.date), r.loadingPoint ?? '', r.dischargerName ?? '',
        r.transporterName ?? '', r.vendorName ?? '', r.itemName ?? '',
        n(r.unitPrice), n(weightOf(r)), n(r.cubicMeter), '', '', n(r.amount), r.memo ?? '',
      ],
      { numberCols: s3Num },
    );
  });
  const f3 = listRow(
    s3,
    [
      '합 계', '', '', '', '', '', '', '', '', '',
      n(sum(wasteAll, weightOf)), n(sum(wasteAll, (r) => r.cubicMeter)), '', '', n(sum(wasteAll, (r) => r.amount)), '',
    ],
    { bold: true, numberCols: s3Num },
  );
  s3.mergeCells(f3.number, 2, f3.number, 11);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
