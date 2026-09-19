import { Router } from 'express';
import multer from 'multer';
import { buildListWorkbook, buildRowsWorkbook, isExportType } from '../lib/listExport.js';

const router = Router();

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// 화면이 거른 줄을 받아 엑셀로 옮긴다. 줄이 많으면 기본 JSON 크기 제한(100kb)을 넘으므로
// 폼 필드 하나(payload)에 JSON을 담아 받는다.
const form = multer({ limits: { fieldSize: 30 * 1024 * 1024, fields: 2 } });

router.post('/rows', form.none(), async (req, res) => {
  let payload;
  try {
    payload = JSON.parse(req.body?.payload ?? '');
  } catch {
    return res.status(400).json({ error: '내보낼 내용을 읽지 못했습니다.' });
  }

  let wb;
  try {
    wb = buildRowsWorkbook(payload);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const stamp = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const base = String(payload.fileName || '목록').replace(/[\\/:*?"<>|]/g, ' ').slice(0, 60);
  res.setHeader('Content-Type', XLSX_MIME);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="export.xlsx"; filename*=UTF-8''${encodeURIComponent(`${base}_${stamp}.xlsx`)}`,
  );
  await wb.xlsx.write(res);
  res.end();
});

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
