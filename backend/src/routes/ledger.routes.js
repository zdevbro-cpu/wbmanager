import { Router } from 'express';
import { queryLedger, getLedgerDetail } from '../lib/ledgerQuery.js';

const router = Router();

// 통합 원장 목록 조회 (필터: from, to, projectId, vendorId, itemCode, type)
router.get('/', async (req, res) => {
  const rows = await queryLedger(req.query);
  res.json(rows);
});

// CSV 내보내기 (필터 동일 + template=ecount 옵션)
router.get('/export', async (req, res) => {
  const { template, ...filters } = req.query;
  const rows = await queryLedger(filters);

  const header =
    template === 'ecount'
      ? ['일자', '구분', '프로젝트', '거래처', '품목코드', '품목명', '중량', '금액']
      : ['일자', '구분', '프로젝트', '거래처', '품목코드', '품목명', '중량(kg)', '금액'];

  const typeLabel = {
    inbound: '입고',
    sorting: '선별',
    outbound_sale: '매각',
    waste_outbound: '폐기물반출',
  };

  const escapeCsv = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [header.map(escapeCsv).join(',')];
  for (const r of rows) {
    lines.push(
      [
        new Date(r.date).toISOString().slice(0, 10),
        typeLabel[r.type] ?? r.type,
        r.projectName,
        r.vendorName,
        r.itemCode,
        r.itemName,
        r.weight,
        r.amount,
      ]
        .map(escapeCsv)
        .join(','),
    );
  }

  const csv = '﻿' + lines.join('\n'); // BOM: 엑셀에서 한글 깨짐 방지
  const fileName = `wbmanager_ledger_${template === 'ecount' ? 'ecount_' : ''}${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(csv);
});

// 원장 상세 (첨부파일 포함) — 원본 근거 추적 (S-XKNNIB)
router.get('/:type/:id', async (req, res) => {
  const detail = await getLedgerDetail(req.params.type, req.params.id);
  if (!detail) return res.status(404).json({ error: 'not found' });
  res.json(detail);
});

export default router;
