// 보고서 본문 생성 — 대표이사 손익보고(data/대표이사보고_26-1차_손익현황.docx)의 목차를 그대로 따른다.
// 담당자가 매번 엑셀을 집계해 문서를 쓰던 자리를 현재 데이터로 대신한다.

const won = (n) => `${Math.round(Number(n ?? 0)).toLocaleString()}원`;
const mWon = (n) => `${(Number(n ?? 0) / 1_000_000).toFixed(1)}백만원`;
const kg = (n) => `${Math.round(Number(n ?? 0)).toLocaleString()} kg`;
const pct = (n) => `${Number(n ?? 0).toFixed(1)}%`;

export function buildPnlReport(pnl, { reportDate }) {
  const title = `${pnl.roundName} 손익 현황 보고`;
  const verdict =
    pnl.realizedPnl >= 0
      ? '현재 장부상 실현손익은 흑자입니다.'
      : `현재 장부상 손익은 ${mWon(pnl.realizedPnl)}으로 표시되나, 잔여 재고 ${kg(pnl.remainingWeight)}가 남아 있어 확정 손익이 아닙니다.`;

  const lines = [
    `[${title}]`,
    `보고일: ${reportDate}   |   기준: 반입·반출·인건비·운송 등록 데이터`,
    '',
    '1. 핵심 결론',
    `- ${verdict}`,
    `- 반입 ${kg(pnl.inboundWeight)} 중 ${kg(pnl.soldWeight)} 매각(회수율 ${pct(pnl.recoveryRate)}), 잔여 ${kg(pnl.remainingWeight)}.`,
    pnl.purchaseRecoveryGap > 0
      ? `- 매입원가 회수까지 ${mWon(pnl.purchaseRecoveryGap)}의 추가 매각이 필요합니다.`
      : '- 매각수입이 매입원가를 회수했습니다.',
    '',
    '2. 손익 3단 요약',
    `- 매각 수입(실현): ${won(pnl.salesRevenue)}`,
    `- 총 지출: ${won(pnl.totalCost)} (매입 ${won(pnl.purchaseCost)} / 폐기물 ${won(pnl.wasteCost)} / 운송 ${won(
      pnl.transportCost,
    )} / 인건비 ${won(pnl.laborCost)})`,
    `- ① 실현손익: ${won(pnl.realizedPnl)}`,
    `- ② 재고평가(미실현, 추정): ${won(pnl.inventoryValuation)}`,
    `- ③ 예상 최종손익(①+②): ${won(pnl.expectedFinalPnl)}`,
    '',
    '3. 자재 회수(매각) 현황',
    `- 반입 총중량: ${kg(pnl.inboundWeight)}${pnl.contractWeight ? ` (계약중량 ${kg(pnl.contractWeight)})` : ''}`,
    `- 매각: ${kg(pnl.soldWeight)} (${pct(pnl.recoveryRate)}) / 폐기물 반출: ${kg(pnl.wasteOutWeight)}`,
    `- 잔여(야적): ${kg(pnl.remainingWeight)}`,
    `- 매각 평균단가: ${Math.round(pnl.avgSalePrice).toLocaleString()}원/kg`,
    '',
    '4. 품목별 매각 구성',
  ];

  if (pnl.salesByItem.length === 0) {
    lines.push('- 매각 실적이 없습니다.');
  } else {
    pnl.salesByItem.forEach((i) => {
      lines.push(
        `- ${i.itemName}: ${kg(i.weight)} / ${won(i.amount)} / 평균 ${Math.round(i.avgPrice).toLocaleString()}원 / 비중 ${pct(
          i.amountShare,
        )}`,
      );
    });
  }

  lines.push('', '5. 재고평가 상세(추정)');
  if (pnl.inventoryDetail.length === 0) {
    lines.push('- 잔여 재고가 없습니다.');
  } else {
    pnl.inventoryDetail.forEach((r) => {
      lines.push(
        `- ${r.itemName ?? r.itemCode}: 잔량 ${kg(r.remaining)} × ${Math.round(
          Number(r.unitPrice ?? 0),
        ).toLocaleString()}원 = ${won(r.valuation)}`,
      );
    });
  }

  lines.push(
    '',
    '※ 재고평가는 기 매각 평균단가를 잔여 중량에 적용한 추정치입니다. 손익 확정은 잔여 재고 처분 후에 가능합니다.',
  );

  return {
    title,
    content: lines.join('\n'),
    summary: {
      salesRevenue: pnl.salesRevenue,
      totalCost: pnl.totalCost,
      realizedPnl: pnl.realizedPnl,
      inventoryValuation: pnl.inventoryValuation,
      expectedFinalPnl: pnl.expectedFinalPnl,
      inboundWeight: pnl.inboundWeight,
      soldWeight: pnl.soldWeight,
      remainingWeight: pnl.remainingWeight,
      recoveryRate: pnl.recoveryRate,
    },
  };
}

const TYPE_LABEL = { outbound_sale: '매각', waste_outbound: '폐기물반출' };

// 일일 출고보고 — 앞단에 그날 전체 요약을 두고, 진행 중인 프로젝트를 하나씩 이어 붙인다.
// 출고가 없던 진행 프로젝트도 '출고 없음'으로 남겨 누락인지 무출고인지 구분되게 한다.
export function buildDailyReport({ date, groups }) {
  const all = groups.flatMap((g) => g.rows);
  const sum = (rows, key) => rows.reduce((acc, r) => acc + Number(r[key] ?? 0), 0);

  const totalWeight = sum(all, 'weight');
  const totalAmount = sum(all, 'amount');
  const saleRows = all.filter((r) => r.type === 'outbound_sale');
  const wasteRows = all.filter((r) => r.type === 'waste_outbound');
  const activeGroups = groups.filter((g) => g.rows.length > 0);

  const title = `${date} 일일 출고보고`;
  const lines = [`[${title}]`, '', '■ 전체 요약'];

  lines.push(
    `- 진행 프로젝트 ${groups.length}개 중 ${activeGroups.length}개 출고`,
    `- 총 ${all.length}건 / ${kg(totalWeight)} / ${won(totalAmount)}`,
    `- 매각 ${saleRows.length}건 ${kg(sum(saleRows, 'weight'))} (${won(sum(saleRows, 'amount'))})`,
    `- 폐기물반출 ${wasteRows.length}건 ${kg(sum(wasteRows, 'weight'))} (${won(sum(wasteRows, 'amount'))})`,
  );

  if (activeGroups.length > 0) {
    lines.push('', '- 프로젝트별 소계');
    activeGroups.forEach((g) => {
      lines.push(`  · ${g.projectName ?? '-'}: ${g.rows.length}건 / ${kg(sum(g.rows, 'weight'))} / ${won(sum(g.rows, 'amount'))}`);
    });
  }

  lines.push('', '■ 프로젝트별 상세');

  if (groups.length === 0) {
    lines.push('- 진행 중인 프로젝트가 없습니다.');
  } else {
    groups.forEach((g) => {
      lines.push('', `[${g.projectName ?? '-'}]${g.siteName ? ` · ${g.siteName}` : ''}`);
      if (g.rows.length === 0) {
        lines.push('  출고 없음');
        return;
      }
      g.rows.forEach((r, i) => {
        lines.push(
          `  ${i + 1}. ${TYPE_LABEL[r.type] ?? r.type} / ${r.vendorName ?? '-'} / ${r.itemName ?? '-'} / ${Number(
            r.weight ?? 0,
          ).toLocaleString()}kg / ${won(r.amount ?? 0)}`,
        );
      });
      lines.push(`  소계: ${g.rows.length}건 / ${kg(sum(g.rows, 'weight'))} / ${won(sum(g.rows, 'amount'))}`);
    });
  }

  return {
    title,
    content: lines.join('\n'),
    summary: {
      count: all.length,
      totalWeight,
      totalAmount,
      projectCount: groups.length,
      activeProjectCount: activeGroups.length,
    },
  };
}
