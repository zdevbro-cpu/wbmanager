import { Router } from 'express';
import { buildListWorkbook, isExportType } from '../lib/listExport.js';

const router = Router();

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// 목록 화면 엑셀 내보내기 — 화면에 적용된 필터를 그대로 쿼리로 받는다.
router.get('/:type', async (req, res) => {
  const { type } = req.params;
  if (!isExportType(type)) {
    return res.status(400).json({ error: '지원하지 않는 목록 유형입니다.' });
  }

  try {
    const { wb, fileName } = await buildListWorkbook(type, req.query);
    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="export.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[list-export] 생성 실패:', err);
    res.status(500).json({ error: '엑셀을 만들지 못했습니다.' });
  }
});

export default router;
