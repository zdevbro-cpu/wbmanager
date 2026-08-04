import { Router } from 'express';
import { queryLedger } from '../lib/ledgerQuery.js';
import { buildAggregation } from '../lib/aggregation.js';

const router = Router();

// 갑지 자동 집계 — 기간/프로젝트/거래처/품목 기준 소계 (F-SDUKJY, S-TCUYZO)
router.get('/aggregation', async (req, res) => {
  const rows = await queryLedger(req.query);
  res.json(buildAggregation(rows));
});

const TYPE_LABEL = {
  inbound: '입고',
  sorting: '선별',
  outbound_sale: '매각',
  waste_outbound: '폐기물반출',
};

// 일일 출고보고 — 특정 일자의 매각/폐기물반출 내역 + 합계 (F-KLJXKW)
router.get('/daily', async (req, res) => {
  const { date, projectId } = req.query;
  if (!date) return res.status(400).json({ error: 'date는 필수입니다.' });

  const rows = await queryLedger({ from: date, to: date, projectId });
  const outboundRows = rows.filter((r) => r.type === 'outbound_sale' || r.type === 'waste_outbound');

  const totalWeight = outboundRows.reduce((sum, r) => sum + Number(r.weight ?? 0), 0);
  const totalAmount = outboundRows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

  res.json({ date, rows: outboundRows, totalWeight, totalAmount, count: outboundRows.length });
});

// 일일 출고보고 카톡 공유용 텍스트/CSV 내보내기 (S-LPSDYR)
router.get('/daily/export', async (req, res) => {
  const { date, projectId, format } = req.query;
  if (!date) return res.status(400).json({ error: 'date는 필수입니다.' });

  const rows = await queryLedger({ from: date, to: date, projectId });
  const outboundRows = rows.filter((r) => r.type === 'outbound_sale' || r.type === 'waste_outbound');
  const totalWeight = outboundRows.reduce((sum, r) => sum + Number(r.weight ?? 0), 0);

  if (format === 'text') {
    const lines = [`[${date} 출고현황 보고]`, ''];
    outboundRows.forEach((r, i) => {
      lines.push(
        `${i + 1}. ${r.projectName ?? '-'} / ${TYPE_LABEL[r.type]} / ${r.vendorName ?? '-'} / ${r.itemName ?? '-'} / ${r.weight}kg`,
      );
    });
    lines.push('', `총 ${outboundRows.length}건, 합계 ${totalWeight}kg`);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="daily_report_${date}.txt"`);
    res.send(lines.join('\n'));
    return;
  }

  const escapeCsv = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const header = ['일자', '구분', '프로젝트', '거래처', '품목', '중량(kg)', '금액'];
  const lines = [header.map(escapeCsv).join(',')];
  outboundRows.forEach((r) => {
    lines.push(
      [date, TYPE_LABEL[r.type], r.projectName, r.vendorName, r.itemName, r.weight, r.amount].map(escapeCsv).join(','),
    );
  });
  lines.push(['', '', '', '', '합계', totalWeight, ''].map(escapeCsv).join(','));

  const csv = '﻿' + lines.join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="daily_report_${date}.csv"`);
  res.send(csv);
});

export default router;
