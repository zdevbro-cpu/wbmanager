import { Router } from 'express';
import { queryLedger, getLedgerDetail } from '../lib/ledgerQuery.js';
import { buildWorkbook } from '../lib/ecountExport.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

// 통합 원장 목록 조회 (필터: from, to, projectId, vendorId, itemCode, type)
router.get('/', async (req, res) => {
  const rows = await queryLedger(req.query);
  res.json(rows);
});

// 엑셀 내보내기 — 목록 화면들과 같은 .xlsx 양식으로 맞춘다. 필터는 조회와 동일.
const LEDGER_COLUMNS = [
  { header: '일자', key: 'date', width: 12 },
  { header: '구분', key: 'typeLabel', width: 12 },
  { header: '프로젝트', key: 'projectName', width: 22 },
  { header: '현장', key: 'siteName', width: 14 },
  { header: '거래처', key: 'vendorName', width: 18 },
  { header: '품목코드', key: 'itemCode', width: 12 },
  { header: '품목명', key: 'itemName', width: 16 },
  { header: '중량(kg)', key: 'weight', width: 12 },
  { header: '금액(원)', key: 'amount', width: 14 },
];

const TYPE_LABEL = {
  inbound: '입고',
  waste_inbound: '폐기물입고',
  sorting: '선별',
  outbound_sale: '매각(출고)',
  waste_outbound: '폐기물반출',
};

router.get('/export', async (req, res) => {
  try {
    const filters = req.query;
    const rows = await queryLedger(filters);
    const project = filters.projectId
      ? await prisma.project.findUnique({ where: { id: filters.projectId } })
      : null;

    const wb = await buildWorkbook({
      sheetName: '통합원장',
      columns: LEDGER_COLUMNS,
      rows: rows.map((r) => ({
        date: new Date(r.date).toISOString().slice(0, 10),
        typeLabel: TYPE_LABEL[r.type] ?? r.type,
        projectName: r.projectName ?? '',
        siteName: r.siteName ?? '',
        vendorName: r.vendorName ?? '',
        itemCode: r.itemCode ?? '',
        itemName: r.itemName ?? '',
        weight: r.weight == null ? '' : Number(r.weight),
        amount: r.amount == null ? '' : Number(r.amount),
      })),
      filters: { from: filters.from, to: filters.to, projectName: project?.roundName ?? null },
    });

    const fileName = `통합원장_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="export.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[ledger-export] 생성 실패:', err);
    res.status(500).json({ error: '엑셀을 만들지 못했습니다.' });
  }
});

// 원장 상세 (첨부파일 포함) — 원본 근거 추적 (S-XKNNIB)
router.get('/:type/:id', async (req, res) => {
  const detail = await getLedgerDetail(req.params.type, req.params.id);
  if (!detail) return res.status(404).json({ error: 'not found' });
  res.json(detail);
});

export default router;
