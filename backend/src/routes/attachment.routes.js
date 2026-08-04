import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma.js';
import { uploadToDrive } from '../lib/drive.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const LINK_FIELDS = {
  inbound: 'inboundId',
  outbound_sale: 'outboundSaleId',
  waste_outbound: 'wasteOutboundId',
  vehicle_maintenance: 'vehicleMaintenanceId',
};

// 계량증명서/현장사진 등 증빙 파일을 Google Drive에 업로드하고, 지정된 트랜잭션에 연결한다.
// form-data: file, fileType, parentType(inbound|outbound_sale|waste_outbound|vehicle_maintenance), parentId
router.post('/', upload.single('file'), async (req, res) => {
  const { fileType, parentType, parentId } = req.body;
  if (!req.file) return res.status(400).json({ error: 'file은 필수입니다.' });

  const linkField = LINK_FIELDS[parentType];
  if (parentType && !linkField) {
    return res.status(400).json({ error: `지원하지 않는 parentType: ${parentType}` });
  }

  const { driveFileId, fileName, webViewLink } = await uploadToDrive({
    buffer: req.file.buffer,
    fileName: req.file.originalname,
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

export default router;
