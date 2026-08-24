import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

// 정비 현황 — 회사자산의 진행 중·완료 정비를 한 화면에서 본다(설계문서 4.관리자 5).
// 운송만 맡고 기록에만 남는 외부 차량은 정비 대상이 아니라 목록에서 뺀다.
router.get('/', async (req, res) => {
  const { status, assetId, assetType, maintType, from, to } = req.query;
  const range = {};
  if (from) range.gte = new Date(from);
  if (to) range.lte = new Date(to);

  const rows = await prisma.assetMaintenance.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(assetId ? { assetId } : {}),
      ...(maintType ? { maintType } : {}),
      asset: { isCompanyAsset: true, ...(assetType ? { assetType } : {}) },
      ...(Object.keys(range).length ? { OR: [{ completedAt: range }, { requestedAt: range }] } : {}),
    },
    include: { asset: { include: { vehicle: true } }, vendor: true, attachments: true },
    orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
  });
  res.json(rows);
});

export default router;
