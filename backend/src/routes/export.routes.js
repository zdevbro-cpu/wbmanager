import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  INBOUND_COLUMNS,
  OUTBOUND_COLUMNS,
  buildInboundRows,
  buildOutboundRows,
  buildWorkbook,
  findWeightMismatches,
} from '../lib/ecountExport.js';

const router = Router();

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function projectName(projectId) {
  if (!projectId) return null;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  return project?.roundName ?? null;
}

async function sendWorkbook(res, wb, fileName) {
  res.setHeader('Content-Type', XLSX_MIME);
  // 한글 파일명은 RFC 5987 형식으로 함께 내려 브라우저가 깨뜨리지 않도록 한다.
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="export.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
  );
  await wb.xlsx.write(res);
  res.end();
}

// 업로드 전 점검용 — 건수와 재고반영중량 불일치 건을 미리 확인한다.
router.get('/ecount/summary', async (req, res) => {
  const { from, to, projectId } = req.query;
  const filters = { from, to, projectId };

  const [inboundRows, outboundRows] = await Promise.all([
    buildInboundRows(filters),
    buildOutboundRows(filters),
  ]);

  res.json({
    inbound: {
      count: inboundRows.length,
      mismatchCount: findWeightMismatches(inboundRows, 'netWeight').length,
    },
    outbound: {
      count: outboundRows.length,
      mismatchCount: findWeightMismatches(outboundRows, 'settledWeight').length,
    },
  });
});

router.get('/ecount/inbounds', async (req, res) => {
  const { from, to, projectId } = req.query;
  const rows = await buildInboundRows({ from, to, projectId });

  const wb = await buildWorkbook({
    sheetName: '구매입력',
    columns: INBOUND_COLUMNS,
    rows,
    filters: { from, to, projectName: await projectName(projectId) },
  });

  await sendWorkbook(res, wb, `ecount_구매입력_${from || '전체'}_${to || '전체'}.xlsx`);
});

router.get('/ecount/outbounds', async (req, res) => {
  const { from, to, projectId } = req.query;
  const rows = await buildOutboundRows({ from, to, projectId });

  const wb = await buildWorkbook({
    sheetName: '판매입력',
    columns: OUTBOUND_COLUMNS,
    rows,
    filters: { from, to, projectName: await projectName(projectId) },
  });

  await sendWorkbook(res, wb, `ecount_판매입력_${from || '전체'}_${to || '전체'}.xlsx`);
});

export default router;
