import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { postInboundLedger } from '../lib/ledger.js';
import { toISO } from '../lib/date.js';

const router = Router();

router.get('/', async (req, res) => {
  const { projectId, unreported, from, to, vehicleType, vehicleNo, driverName, itemCode } = req.query;
  const range = {};
  if (from) range.gte = new Date(from);
  if (to) range.lte = new Date(to);

  const wasteInbounds = await prisma.wasteInbound.findMany({
    where: {
      deletedAt: null,
      ...(projectId ? { projectId } : {}),
      ...(Object.keys(range).length ? { receiveDate: range } : {}),
      ...(vehicleType ? { vehicleType } : {}),
      ...(vehicleNo ? { vehicleNo } : {}),
      ...(driverName ? { driverName } : {}),
      ...(itemCode ? { itemCode } : {}),
      // 미신고/미기재 폐기물 건만 필터 (S-FPMCPT)
      ...(unreported === 'true' ? { OR: [{ olbaroReported: false }, { handoverDate: null }] } : {}),
    },
    include: { project: true, item: true, attachments: true },
    orderBy: { receiveDate: 'desc' },
  });
  res.json(wasteInbounds);
});

router.post('/', async (req, res) => {
  const { projectId, receiveDate, handoverDate, grossWeight, tareWeight, lossWeight } = req.body;

  if (!projectId || !receiveDate || grossWeight == null || tareWeight == null) {
    return res.status(400).json({ error: 'projectId, receiveDate, grossWeight, tareWeight는 필수입니다.' });
  }
  if (Number(grossWeight) < 0 || Number(tareWeight) < 0 || Number(lossWeight ?? 0) < 0) {
    return res.status(400).json({ error: '중량은 0 이상이어야 합니다.' });
  }
  if (Number(grossWeight) < Number(tareWeight)) {
    return res.status(400).json({ error: '총중량은 공차중량보다 작을 수 없습니다.' });
  }

  // 입고량 = 총중량 - 공차중량 - 감량 (원본 엑셀 `폐기물 입고` 시트 기준)
  const netWeight = Number(grossWeight) - Number(tareWeight) - Number(lossWeight ?? 0);
  if (netWeight < 0) {
    return res.status(400).json({ error: '감량이 과다합니다. 입고량이 음수가 됩니다.' });
  }

  const wasteInbound = await prisma.$transaction(async (tx) => {
    const created = await tx.wasteInbound.create({
      data: {
        ...req.body,
        netWeight,
        receiveDate: toISO(receiveDate),
        ...(handoverDate ? { handoverDate: toISO(handoverDate) } : {}),
      },
    });
    // 갑지가 폐기물도 `재고량 = 입고량 - 출고량`으로 집계하므로 스크랩과 동일하게 IN 계상한다.
    await postInboundLedger(
      {
        projectId,
        itemCode: req.body.itemCode,
        weight: netWeight,
        ledgerDate: toISO(receiveDate),
        refType: 'waste_inbound',
        refId: created.id,
      },
      tx,
    );
    return created;
  });

  res.status(201).json(wasteInbound);
});

// 소프트 삭제. 재고원장은 파생 데이터라 참조 행을 지워 재고가 부풀지 않게 한다.
router.delete('/:id', async (req, res) => {
  const deleted = await prisma.$transaction(async (tx) => {
    await tx.inventoryLedger.deleteMany({ where: { refType: 'waste_inbound', refId: req.params.id } });
    return tx.wasteInbound.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
  });
  res.json(deleted);
});

// 올바로 신고 상태/인계일/비고 수정 (F-FZOGXB)
router.patch('/:id', async (req, res) => {
  const { olbaroReported, handoverDate, memo } = req.body;
  const updated = await prisma.wasteInbound.update({
    where: { id: req.params.id },
    data: {
      ...(olbaroReported !== undefined ? { olbaroReported } : {}),
      ...(handoverDate !== undefined ? { handoverDate: toISO(handoverDate) } : {}),
      ...(memo !== undefined ? { memo } : {}),
    },
  });
  res.json(updated);
});

export default router;
