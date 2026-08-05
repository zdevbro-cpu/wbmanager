import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { postInboundLedger } from '../lib/ledger.js';
import { toISO } from '../lib/date.js';

const router = Router();

router.get('/', async (req, res) => {
  const { projectId, from, to, vehicleType, vehicleNo, driverName, itemCode } = req.query;
  const range = {};
  if (from) range.gte = new Date(from);
  if (to) range.lte = new Date(to);

  const inbounds = await prisma.inbound.findMany({
    where: {
      deletedAt: null,
      ...(projectId ? { projectId } : {}),
      ...(Object.keys(range).length ? { inboundDate: range } : {}),
      ...(vehicleType ? { vehicleType } : {}),
      ...(vehicleNo ? { vehicleNo } : {}),
      ...(driverName ? { driverName } : {}),
      ...(itemCode ? { itemCode } : {}),
    },
    include: { project: true, item: true, attachments: true },
    orderBy: { inboundDate: 'desc' },
  });
  res.json(inbounds);
});

// 소프트 삭제. 재고원장은 파생 데이터라 참조 행을 지워 재고가 부풀지 않게 한다.
router.delete('/:id', async (req, res) => {
  const deleted = await prisma.$transaction(async (tx) => {
    await tx.inventoryLedger.deleteMany({ where: { refType: 'inbound', refId: req.params.id } });
    return tx.inbound.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
  });
  res.json(deleted);
});

router.post('/', async (req, res) => {
  const { projectId, inboundDate, grossWeight, tareWeight, lossWeight, stockWeight } = req.body;

  if (!projectId || !inboundDate || grossWeight == null || tareWeight == null) {
    return res.status(400).json({ error: 'projectId, inboundDate, grossWeight, tareWeight는 필수입니다.' });
  }
  if (Number(grossWeight) < 0 || Number(tareWeight) < 0 || Number(lossWeight ?? 0) < 0) {
    return res.status(400).json({ error: '중량은 0 이상이어야 합니다.' });
  }
  if (Number(grossWeight) < Number(tareWeight)) {
    return res.status(400).json({ error: '만차중량은 공차중량보다 작을 수 없습니다.' });
  }

  // 입고량 = 총중량 - 공차중량 - 감량 (원본 엑셀 `스크랩입고량` 시트 / ecount 구매입력 기준)
  const netWeight = Number(grossWeight) - Number(tareWeight) - Number(lossWeight ?? 0);
  if (netWeight < 0) {
    return res.status(400).json({ error: '감량이 과다합니다. 입고량이 음수가 됩니다.' });
  }

  // 재고반영중량은 ecount 필수 항목 — 미입력 시 입고량과 동기화한다. (S-KZSNZB)
  const stock = stockWeight ?? netWeight;

  const inbound = await prisma.$transaction(async (tx) => {
    const created = await tx.inbound.create({
      data: { ...req.body, netWeight, stockWeight: stock, inboundDate: toISO(inboundDate) },
    });
    // 재고 = 입고 - 출고 (갑지 기준). 품목 미선택 건은 미분류 품목으로 계상해 누락을 막는다.
    await postInboundLedger(
      {
        projectId,
        itemCode: req.body.itemCode,
        weight: stock,
        ledgerDate: toISO(inboundDate),
        refType: 'inbound',
        refId: created.id,
      },
      tx,
    );
    return created;
  });

  res.status(201).json(inbound);
});

export default router;
