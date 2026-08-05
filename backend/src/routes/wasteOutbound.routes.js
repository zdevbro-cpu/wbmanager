import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { postLedgerEntry } from '../lib/ledger.js';
import { toISO } from '../lib/date.js';

const router = Router();

router.get('/', async (req, res) => {
  const { projectId, unreported, from, to, vehicleType, vehicleNo, driverName, itemCode } = req.query;
  const range = {};
  if (from) range.gte = new Date(from);
  if (to) range.lte = new Date(to);

  const wasteOutbounds = await prisma.wasteOutbound.findMany({
    where: {
      deletedAt: null,
      ...(projectId ? { projectId } : {}),
      ...(Object.keys(range).length ? { outboundDate: range } : {}),
      ...(vehicleType ? { vehicleType } : {}),
      ...(vehicleNo ? { vehicleNo } : {}),
      ...(driverName ? { driverName } : {}),
      ...(itemCode ? { itemCode } : {}),
      // 미신고/미기재 폐기물 건만 필터 (S-FPMCPT)
      ...(unreported === 'true' ? { OR: [{ olbaroReported: false }, { handoverDate: null }] } : {}),
    },
    include: { project: true, buyer: true, item: true, attachments: true },
    orderBy: { outboundDate: 'desc' },
  });
  res.json(wasteOutbounds);
});

router.post('/', async (req, res) => {
  const {
    projectId,
    itemCode,
    outboundDate,
    handoverDate,
    transferDate,
    grossWeight,
    tareWeight,
    preLossWeight,
    lossWeight,
    unitPrice,
    weight,
    amount,
  } = req.body;

  if (!projectId || !outboundDate) {
    return res.status(400).json({ error: 'projectId, outboundDate는 필수입니다.' });
  }
  if (grossWeight != null && tareWeight != null && Number(grossWeight) < Number(tareWeight)) {
    return res.status(400).json({ error: '총중량은 공차중량보다 작을 수 없습니다.' });
  }

  // 실중량 = 총중량 - 공차중량 (원본 `폐기물출고량` 시트 기준)
  const actualWeight =
    grossWeight != null && tareWeight != null ? Number(grossWeight) - Number(tareWeight) : null;
  // 정산중량 = 거래처 감량 전 실중량이 있으면 그 값, 없으면 실중량 - 감량
  const settledWeight =
    weight != null
      ? Number(weight)
      : preLossWeight != null
        ? Number(preLossWeight)
        : actualWeight != null
          ? actualWeight - Number(lossWeight ?? 0)
          : null;

  if (settledWeight == null) {
    return res.status(400).json({ error: '정산중량(또는 총중량·공차중량)은 필수입니다.' });
  }
  if (settledWeight <= 0) {
    return res.status(400).json({ error: '정산중량은 0보다 커야 합니다.' });
  }

  // 금액(지출) = 정산중량 × 단가
  const settledAmount =
    amount != null ? Number(amount) : unitPrice != null ? settledWeight * Number(unitPrice) : null;

  const wasteOutbound = await prisma.$transaction(async (tx) => {
    const created = await tx.wasteOutbound.create({
      data: {
        ...req.body,
        outboundDate: toISO(outboundDate),
        ...(handoverDate ? { handoverDate: toISO(handoverDate) } : {}),
        ...(transferDate ? { transferDate: toISO(transferDate) } : {}),
        ...(actualWeight != null ? { actualWeight } : {}),
        weight: settledWeight,
        ...(settledAmount != null ? { amount: settledAmount } : {}),
      },
    });
    if (itemCode) {
      await postLedgerEntry(
        {
          projectId,
          itemCode,
          direction: 'OUT',
          weight: settledWeight,
          ledgerDate: toISO(outboundDate),
          refType: 'waste_outbound',
          refId: created.id,
        },
        tx,
      );
    }
    return created;
  });

  res.status(201).json(wasteOutbound);
});

// 소프트 삭제. 재고원장은 파생 데이터라 참조 행을 지워 재고가 줄어든 채 남지 않게 한다.
router.delete('/:id', async (req, res) => {
  const deleted = await prisma.$transaction(async (tx) => {
    await tx.inventoryLedger.deleteMany({ where: { refType: 'waste_outbound', refId: req.params.id } });
    return tx.wasteOutbound.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
  });
  res.json(deleted);
});

// 올바로 신고 상태/인계일/메모 수정 (F-FZOGXB)
router.patch('/:id', async (req, res) => {
  const { olbaroReported, handoverDate, olbaroMemo } = req.body;
  const updated = await prisma.wasteOutbound.update({
    where: { id: req.params.id },
    data: {
      ...(olbaroReported !== undefined ? { olbaroReported } : {}),
      ...(handoverDate !== undefined ? { handoverDate: toISO(handoverDate) } : {}),
      ...(olbaroMemo !== undefined ? { olbaroMemo } : {}),
    },
  });
  res.json(updated);
});

export default router;
