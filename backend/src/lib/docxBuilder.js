// 보고서 워드 문서 생성 — data/대표이사보고_26-1차_손익현황.docx의 구성을 따른다.
// 제목 / 부제 / 보고 메타줄 / 번호 붙은 절 / 요약표 / 말미 주의문구.
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from 'docx';

const won = (n) => `${Math.round(Number(n ?? 0)).toLocaleString()}원`;
const mWon = (n) => `${(Number(n ?? 0) / 1_000_000).toFixed(1)}백만원`;
const kg = (n) => `${Math.round(Number(n ?? 0)).toLocaleString()} kg`;
const pct = (n) => `${Number(n ?? 0).toFixed(1)}%`;

const FONT = '맑은 고딕';

const title = (text) =>
  new Paragraph({
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text, bold: true, size: 32, font: FONT })],
  });

const subtitle = (text) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text, size: 22, color: '444444', font: FONT })],
  });

const meta = (text) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 320 },
    children: [new TextRun({ text, size: 18, color: '777777', font: FONT })],
  });

const section = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 140 },
    children: [new TextRun({ text, bold: true, size: 24, font: FONT })],
  });

const bullet = (text) =>
  new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 20, font: FONT })],
  });

const note = (text) =>
  new Paragraph({
    spacing: { before: 320 },
    children: [new TextRun({ text, size: 16, color: '888888', italics: true, font: FONT })],
  });

const cell = (text, { bold = false, align = AlignmentType.LEFT, shade } = {}) =>
  new TableCell({
    shading: shade ? { fill: shade } : undefined,
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text: String(text ?? ''), bold, size: 18, font: FONT })],
      }),
    ],
  });

// 표는 머리행에 음영을 넣어 문서에서 바로 읽히게 한다.
const table = (headers, rows, widths) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      left: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      right: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
    },
    columnWidths: widths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h, i) =>
          cell(h, { bold: true, shade: 'F2F4F7', align: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT }),
        ),
      }),
      ...rows.map(
        (r) =>
          new TableRow({
            children: r.map((c, i) => cell(c, { align: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT })),
          }),
      ),
    ],
  });

function docFrom(children) {
  return new Document({
    styles: { default: { document: { run: { font: FONT } } } },
    sections: [{ properties: {}, children }],
  });
}

// 손익 현황 보고 — 원본 문서의 5개 절 구성을 그대로 따른다.
export async function buildPnlDocx(payload) {
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
  const children = [
    title(`${p.roundName} 손익 현황 보고`),
    subtitle('손익 현황 보고 — 대표이사 보고용'),
    meta(`보고일: ${p.reportDate}   |   작성: 크로스특수   |   기준: 반입·반출·인건비·운송 등록 데이터`),

    section('1. 핵심 결론 (요약)'),
    bullet(
      p.realizedPnl >= 0
        ? `현재 장부상 실현손익은 ${mWon(p.realizedPnl)} 흑자입니다.`
        : `현재 장부상 손익은 ${mWon(p.realizedPnl)}으로 표시되나, 이는 적자 확정이 아니라 작업이 진행 중인 중간 시점의 수치입니다. 잔여 재고 ${kg(
            p.remainingWeight,
          )}가 처분되면 손익이 달라집니다.`,
    ),
    bullet(`반입 ${kg(p.inboundWeight)} 중 ${kg(p.soldWeight)} 매각(회수율 ${pct(p.recoveryRate)}), 잔여 ${kg(p.remainingWeight)}.`),
    bullet(
      p.purchaseRecoveryGap > 0
        ? `매입원가 회수 관점: 매각 ${mWon(p.salesRevenue)} − 매입가 ${mWon(p.purchaseCost)} → 회수까지 약 ${mWon(
            p.purchaseRecoveryGap,
          )}의 추가 매각이 필요합니다.`
        : '매각수입이 매입원가를 회수했습니다.',
    ),

    section('2. 손익 3단 요약'),
    new Paragraph({
      spacing: { after: 140 },
      children: [
        new TextRun({
          text: '단순 장부(실현) 손익과 함께, 야적장에 남은 재고 가치(미실현)를 반영한 ‘예상 최종손익’을 병기합니다.',
          size: 18,
          color: '555555',
          font: FONT,
        }),
      ],
    }),
    table(
      ['구분', '금액', '비고'],
      [
        ['매각 수입 (실현)', won(p.salesRevenue), `회수율 ${pct(p.recoveryRate)}`],
        ['총 지출', `-${won(p.totalCost)}`, '매입+폐기물+운송+인건비'],
        ['① 실현손익', won(p.realizedPnl), '현재 장부'],
        ['② 재고평가 (미실현, 추정)', won(p.inventoryValuation), `잔여 ${kg(p.remainingWeight)}`],
        ['③ 예상 최종손익 (①+②)', won(p.expectedFinalPnl), '재고 처분 가정'],
      ],
      [3400, 3000, 2600],
    ),

    section('3. 자재 회수(매각) 현황'),
    bullet(
      `반입 총중량 ${kg(p.inboundWeight)}${p.contractWeight ? ` (계약중량 ${kg(p.contractWeight)})` : ''} 대비 매각 ${kg(
        p.soldWeight,
      )}(${pct(p.recoveryRate)}), 야적장 잔여 ${kg(p.remainingWeight)}.`,
    ),
    bullet(`폐기물 반출: ${kg(p.wasteOutWeight)} / 매각 평균단가: ${Math.round(p.avgSalePrice).toLocaleString()}원/kg`),

    section('4. 품목별 매각 구성'),
    p.salesByItem.length
      ? table(
          ['품목', '매각중량', '매각금액', '평균단가', '비중'],
          [
            ...p.salesByItem.map((i) => [
              i.itemName,
              kg(i.weight),
              won(i.amount),
              `${Math.round(i.avgPrice).toLocaleString()}원`,
              pct(i.amountShare),
            ]),
            ['매각 합계', kg(p.soldWeight), won(p.salesRevenue), `${Math.round(p.avgSalePrice).toLocaleString()}원`, '100%'],
          ],
          [2600, 2000, 2400, 1800, 1200],
        )
      : bullet('매각 실적이 없습니다.'),

    section('5. 재고평가 상세 (추정)'),
    p.inventoryDetail.length
      ? table(
          ['품목', '잔량', '적용단가', '평가금액'],
          p.inventoryDetail.map((r) => [
            r.itemName ?? r.itemCode,
            kg(r.remaining),
            `${Math.round(Number(r.unitPrice ?? 0)).toLocaleString()}원`,
            won(r.valuation),
          ]),
          [3200, 2200, 2200, 2400],
        )
      : bullet('잔여 재고가 없습니다.'),

    note(
      '※ 본 보고서의 금액은 시스템에 등록된 반입·반출·운송·인건비 데이터를 집계·재계산한 것이며, 재고평가는 기 매각 평균단가를 적용한 추정치입니다. 손익 확정은 잔여 재고 처분 후에 가능합니다.',
    ),
  ];

  return Packer.toBuffer(docFrom(children));
}

const TYPE_LABEL = { outbound_sale: '매각', waste_outbound: '폐기물반출' };

// 일일 출고보고 — 앞단 전체 요약 표 + 진행 프로젝트별 상세 표
export async function buildDailyDocx(payload) {
  const date = payload?.date ?? new Date().toISOString().slice(0, 10);
  const groups = (payload?.groups ?? []).map((g) => ({ ...g, rows: g.rows ?? [] }));
  const summary = payload?.summary ?? { count: 0, totalWeight: 0, totalAmount: 0 };
  const activeGroups = groups.filter((g) => g.rows.length > 0);
  const sum = (rows, key) => rows.reduce((acc, r) => acc + Number(r[key] ?? 0), 0);

  const children = [
    title(`${date} 일일 출고보고`),
    meta(`작성: 크로스특수   |   기준: 매각·폐기물반출 등록 데이터`),

    section('1. 전체 요약'),
    table(
      ['구분', '건수', '중량', '금액'],
      [
        [
          '매각',
          `${groups.reduce((a, g) => a + g.rows.filter((r) => r.type === 'outbound_sale').length, 0)}건`,
          kg(sum(groups.flatMap((g) => g.rows.filter((r) => r.type === 'outbound_sale')), 'weight')),
          won(sum(groups.flatMap((g) => g.rows.filter((r) => r.type === 'outbound_sale')), 'amount')),
        ],
        [
          '폐기물반출',
          `${groups.reduce((a, g) => a + g.rows.filter((r) => r.type === 'waste_outbound').length, 0)}건`,
          kg(sum(groups.flatMap((g) => g.rows.filter((r) => r.type === 'waste_outbound')), 'weight')),
          won(sum(groups.flatMap((g) => g.rows.filter((r) => r.type === 'waste_outbound')), 'amount')),
        ],
        ['합계', `${summary.count}건`, kg(summary.totalWeight), won(summary.totalAmount)],
      ],
      [3000, 1800, 2400, 2800],
    ),
    new Paragraph({
      spacing: { before: 140 },
      children: [
        new TextRun({
          text: `진행 프로젝트 ${groups.length}개 중 ${activeGroups.length}개 출고`,
          size: 18,
          color: '555555',
          font: FONT,
        }),
      ],
    }),

    section('2. 프로젝트별 상세'),
  ];

  if (groups.length === 0) {
    children.push(bullet('진행 중인 프로젝트가 없습니다.'));
  } else {
    groups.forEach((g) => {
      children.push(
        new Paragraph({
          spacing: { before: 200, after: 100 },
          children: [
            new TextRun({ text: `${g.projectName ?? '-'}`, bold: true, size: 20, font: FONT }),
            ...(g.siteName ? [new TextRun({ text: `  · ${g.siteName}`, size: 18, color: '777777', font: FONT })] : []),
          ],
        }),
      );

      if (g.rows.length === 0) {
        children.push(bullet('출고 없음'));
        return;
      }

      children.push(
        table(
          ['구분', '거래처', '품목', '중량', '금액'],
          [
            ...g.rows.map((r) => [
              TYPE_LABEL[r.type] ?? r.type,
              r.vendorName ?? '-',
              r.itemName ?? '-',
              kg(r.weight),
              won(r.amount),
            ]),
            ['소계', `${g.rows.length}건`, '', kg(sum(g.rows, 'weight')), won(sum(g.rows, 'amount'))],
          ],
          [1600, 2600, 2400, 1800, 2200],
        ),
      );
    });
  }

  return Packer.toBuffer(docFrom(children));
}
