import { Router } from 'express';
import multer from 'multer';
import { readWeighingCertificate, readVehicleRegistration, isOcrEnabled } from '../lib/ocr.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.get('/status', (req, res) => {
  res.json({ enabled: isOcrEnabled() });
});

// 계량증명서 이미지/PDF → 계근 항목 추출. 결과는 폼에 채워지고 담당자가 수정할 수 있다.
router.post('/weighing-certificate', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file은 필수입니다.' });

  try {
    const result = await readWeighingCertificate(req.file.buffer, req.file.mimetype);
    res.json(result);
  } catch (err) {
    console.error('[ocr] 인식 실패:', err);
    // 인식 실패가 등록 자체를 막지 않도록 200으로 빈 결과를 돌려준다.
    res.json({ enabled: isOcrEnabled(), fields: {}, error: '인식에 실패했습니다. 직접 입력해 주세요.' });
  }
});

// 차량등록증 이미지/PDF → 차량 상세 항목 추출. 자산 등록 모달에서 사용한다.
router.post('/vehicle-registration', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file은 필수입니다.' });

  try {
    const result = await readVehicleRegistration(req.file.buffer, req.file.mimetype);
    res.json(result);
  } catch (err) {
    console.error('[ocr] 차량등록증 인식 실패:', err);
    res.json({ enabled: isOcrEnabled(), fields: {}, error: '인식에 실패했습니다. 직접 입력해 주세요.' });
  }
});

export default router;
