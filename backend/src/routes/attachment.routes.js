import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma.js';
import { uploadToDrive, downloadFromDrive, trashInDrive } from '../lib/drive.js';
import { decodeUploadName } from '../lib/fileName.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const LINK_FIELDS = {
  inbound: 'inboundId',
  waste_inbound: 'wasteInboundId',
  outbound_sale: 'outboundSaleId',
  waste_outbound: 'wasteOutboundId',
  vehicle_maintenance: 'vehicleMaintenanceId',
  vehicle: 'vehicleId',
  asset: 'assetId',
  asset_maintenance: 'assetMaintenanceId',
};

// 계량증명서/현장사진 등 증빙 파일을 Google Drive에 업로드하고, 지정된 트랜잭션에 연결한다.
// form-data: file, fileType, parentType(inbound|waste_inbound|outbound_sale|waste_outbound|vehicle_maintenance), parentId
router.post('/', upload.single('file'), async (req, res) => {
  const { fileType, parentType, parentId } = req.body;
  if (!req.file) return res.status(400).json({ error: 'file은 필수입니다.' });

  const linkField = LINK_FIELDS[parentType];
  if (parentType && !linkField) {
    return res.status(400).json({ error: `지원하지 않는 parentType: ${parentType}` });
  }

  const { driveFileId, fileName, webViewLink } = await uploadToDrive({
    buffer: req.file.buffer,
    fileName: decodeUploadName(req.file.originalname),
    mimeType: req.file.mimetype,
  });

  const attachment = await prisma.attachment.create({
    data: {
      driveFileId,
      fileName,
      webViewLink,
      fileType,
      ...(linkField && parentId ? { [linkField]: parentId } : {}),
    },
  });

  res.status(201).json(attachment);
});

// 증빙 파일 열람·내려받기 — 앱이 중계한다.
// 드라이브 파일은 의뢰자 계정 소유라, 링크를 그대로 주면 드라이브 접근 권한이 없는 사용자는 열지 못한다.
router.get('/:id/content', async (req, res) => {
  const item = await prisma.attachment.findUnique({ where: { id: req.params.id } });
  if (!item?.driveFileId) return res.status(404).json({ error: '첨부를 찾을 수 없습니다.' });

  try {
    const { stream, mimeType } = await downloadFromDrive(item.driveFileId);
    const encoded = encodeURIComponent(item.fileName ?? 'attachment');
    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="attachment"; filename*=UTF-8''${encoded}`);
    stream.pipe(res);
  } catch (err) {
    console.error('[attachment] 내려받기 실패:', err.message);
    res.status(502).json({ error: '드라이브에서 파일을 가져오지 못했습니다.' });
  }
});

// 잘못 올린 증빙을 치운다. 파일을 바꿔 붙이려면 지울 수 있어야 한다.
// 드라이브 파일은 휴지통으로 보내고, 지우지 못해도 목록에서는 사라지게 한다.
router.delete('/:id', async (req, res) => {
  const item = await prisma.attachment.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: '첨부를 찾을 수 없습니다.' });

  if (item.driveFileId) {
    try {
      await trashInDrive(item.driveFileId);
    } catch (err) {
      // 드라이브에서 이미 지워졌거나 권한이 없을 수 있다. 기록만 남기고 연결은 끊는다.
      console.error('[attachment] 드라이브 휴지통 이동 실패:', err.message);
    }
  }

  await prisma.attachment.delete({ where: { id: item.id } });
  res.json({ ok: true });
});

export default router;
