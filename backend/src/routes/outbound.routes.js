import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { postLedgerEntry, postInboundLedger } from '../lib/ledger.js';
import { toISO } from '../lib/date.js';

const router = Router();

// 폼에서 온 값만 반영한다. 관계·시스템 컬럼은 덮어쓰지 않는다.
const OMIT = ['id', 'createdAt', 'deletedAt', 'project', 'item', 'buyer', 'attachments', 'directInboundId'];
const editable = (body) => Object.fromEntries(Object.entries(body).filter(([k]) => !OMIT.includes(k)));

// 직납 — 야적장을 거치지 않고 현장에서 바로 매각한 건이다.
// 재고는 IN·OUT이 같은 날 같은 양으로 잡혀 순증 0이 되고, 반입량·회수율 집계는 정상으로 맞는다.
// 출고를 고치거나 지우면 짝이 되는 입고도 함께 움직인다.
async function syncDirectInbound(tx, row) {
  const weight = Number(row.settledWeight ?? 0);

  if (row.isSubsidiary && weight > 0) {
    const data = {
      projectId: row.projectId,
      inboundDate: row.outboundDate,
      itemCode: row.itemCode,
      loadingPoint: row.loadingPoint,
      unloadingPoint: row.loadingPoint,
      vehicleType: row.vehicleType,
      vehicleNo: row.vehicleNo,
      driverName: row.driverName,
      driverPhone: row.driverPhone,
      grossWeight: weight,
      tareWeight: 0,
      lossWeight: 0,
      netWeight: weight,
      stockWeight: weight,
      memo: '직납 — 출고 등록 시 자동 생성',
    };

    const inbound = row.directInboundId
      ? await tx.inbound.update({ where: { id: row.directInboundId }, data: { ...data, deletedAt: null } })
      : await tx.inbound.create({ data });

    await tx.inventoryLedger.deleteMany({ where: { refType: 'inbound', refId: inbound.id } });
    await postInboundLedger(
      {
        projectId: inbound.projectId,
        itemCode: inbound.itemCode,
        weight,
        ledgerDate: inbound.inboundDate,
        refType: 'inbound',
        refId: inbound.id,
      },
      tx,
    );
    return inbound.id;
  }

  // 직납을 껐거나 중량이 없어졌으면 짝이 된 입고를 걷어낸다.
  if (row.directInboundId) {
    await tx.inventoryLedger.deleteMany({ where: { refType: 'inbound', refId: row.directInboundId } });
    await tx.inbound.update({ where: { id: row.directInboundId }, data: { deletedAt: new Date() } });
  }
  return null;
}

router.get('/', async (req, res) => {
  const { projectId, from, to, vehicleType, vehicleNo, driverName, itemCode } = req.query;
  const range = {};
  if (from) range.gte = new Date(from);
  if (to) range.lte = new Date(to);

  const outbounds = await prisma.outboundSale.findMany({
    where: {
      deletedAt: null,
      ...(projectId ? { projectId } : {}),
      ...(Object.keys(range).length ? { outboundDate: range } : {}),
      ...(vehicleType ? { vehicleType } : {}),
      ...(vehicleNo ? { vehicleNo } : {}),
      ...(driverName ? { driverName } : {}),
      ...(itemCode ? { itemCode } : {}),
    },
    include: { project: true, item: true, buyer: true, attachments: true },
    orderBy: { outboundDate: 'desc' },
  });
  res.json(outbounds);
});

// 소프트 삭제. 재고원장은 파생 데이터라 참조 행을 지워 재고가 어긋나지 않게 한다.
router.delete('/:id', async (req, res) => {
  const deleted = await prisma.$transaction(async (tx) => {
    // 직납으로 함께 만든 입고가 있으면 그것도 같이 걷어낸다.
    const before = await tx.outboundSale.findUnique({ where: { id: req.params.id } });
    if (before?.directInboundId) {
      await tx.inventoryLedger.deleteMany({ where: { refType: 'inbound', refId: before.directInboundId } });
      await tx.inbound.update({ where: { id: before.directInboundId }, data: { deletedAt: new Date() } });
    }
    await tx.inventoryLedger.deleteMany({ where: { refType: 'outbound_sale', refId: req.params.id } });
    return tx.outboundSale.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
  });
  res.json(deleted);
});

router.post('/', async (req, res) => {
  const {
    projectId,
    itemCode,
    outboundDate,
    grossWeight,
    tareWeight,
    lossWeight,
    settledWeight: settledWeightInput,
    stockWeight,
    unitPrice,
    amount: amountInput,
    vatAmount: vatAmountInput,
    paidDate,
  } = req.body;

  if (!projectId || !itemCode || !outboundDate) {
    return res.status(400).json({ error: 'projectId, itemCode, outboundDate는 필수입니다.' });
  }

  let settledWeight = settledWeightInput;
  if (settledWeight == null) {
    if (grossWeight == null || tareWeight == null) {
      return res.status(400).json({ error: 'settledWeight 또는 (grossWeight, tareWeight)가 필요합니다.' });
    }
    settledWeight = Number(grossWeight) - Number(tareWeight) - Number(lossWeight ?? 0);
  }
  if (Number(settledWeight) < 0) {
    return res.status(400).json({ error: '정산중량은 0 이상이어야 합니다.' });
  }

  // 실중량 = 총중량 - 공차중량 (거래처 감량을 반영하기 전 값)
  const actualWeight =
    grossWeight != null && tareWeight != null ? Number(grossWeight) - Number(tareWeight) : undefined;

  // 공급가액 = 정산중량 × 단가, 부가세 = 공급가액 10% (원본 엑셀 금액 컬럼 / ecount 판매입력 기준)
  const amount =
    amountInput ?? (unitPrice != null ? Number(settledWeight) * Number(unitPrice) : undefined);
  const vatAmount = vatAmountInput ?? (amount != null ? Math.round(Number(amount) * 0.1) : undefined);

  const outbound = await prisma.$transaction(async (tx) => {
    const created = await tx.outboundSale.create({
      data: {
        ...req.body,
        settledWeight,
        // 재고반영중량은 ecount 필수 항목 — 미입력 시 정산중량과 동기화한다. (S-KZSNZB)
        stockWeight: stockWeight ?? settledWeight,
        ...(actualWeight !== undefined ? { actualWeight } : {}),
        ...(amount !== undefined ? { amount } : {}),
        ...(vatAmount !== undefined ? { vatAmount } : {}),
        ...(paidDate ? { paidDate: toISO(paidDate) } : {}),
        outboundDate: toISO(outboundDate),
      },
    });
    await postLedgerEntry(
      {
        projectId,
        itemCode,
        direction: 'OUT',
        weight: settledWeight,
        ledgerDate: toISO(outboundDate),
        refType: 'outbound_sale',
        refId: created.id,
      },
      tx,
    );

    const directInboundId = await syncDirectInbound(tx, created);
    if (directInboundId) {
      return tx.outboundSale.update({ where: { id: created.id }, data: { directInboundId } });
    }
    return created;
  });

  res.status(201).json(outbound);
});

// 등록 후 정정. 정산중량·품목·프로젝트가 바뀌면 재고원장을 다시 계상한다.
router.patch('/:id', async (req, res) => {
  const existing = await prisma.outboundSale.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!existing) return res.status(404).json({ error: 'not found' });

  const patch = editable(req.body);
  const merged = { ...existing, ...patch };

  // 정산중량 = 총중량 - 공차중량 - 감량. 직접 넣은 값이 있으면 그대로 쓴다.
  const settledWeight =
    patch.settledWeight != null
      ? Number(patch.settledWeight)
      : merged.grossWeight != null && merged.tareWeight != null
        ? Number(merged.grossWeight) - Number(merged.tareWeight) - Number(merged.lossWeight ?? 0)
        : Number(existing.settledWeight);
  if (settledWeight < 0) {
    return res.status(400).json({ error: '정산중량은 0 이상이어야 합니다.' });
  }

  const actualWeight =
    merged.grossWeight != null && merged.tareWeight != null
      ? Number(merged.grossWeight) - Number(merged.tareWeight)
      : undefined;
  const amount =
    patch.amount ?? (merged.unitPrice != null ? settledWeight * Number(merged.unitPrice) : undefined);
  const vatAmount = patch.vatAmount ?? (amount != null ? Math.round(Number(amount) * 0.1) : undefined);
  const outboundDate = patch.outboundDate ? toISO(patch.outboundDate) : existing.outboundDate;

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.outboundSale.update({
      where: { id: req.params.id },
      data: {
        ...patch,
        settledWeight,
        stockWeight: patch.stockWeight ?? settledWeight,
        ...(actualWeight !== undefined ? { actualWeight } : {}),
        ...(amount !== undefined ? { amount } : {}),
        ...(vatAmount !== undefined ? { vatAmount } : {}),
        ...(patch.paidDate !== undefined ? { paidDate: patch.paidDate ? toISO(patch.paidDate) : null } : {}),
        outboundDate,
      },
    });
    await tx.inventoryLedger.deleteMany({ where: { refType: 'outbound_sale', refId: row.id } });
    await postLedgerEntry(
      {
        projectId: row.projectId,
        itemCode: row.itemCode,
        direction: 'OUT',
        weight: settledWeight,
        ledgerDate: row.outboundDate,
        refType: 'outbound_sale',
        refId: row.id,
      },
      tx,
    );

    const directInboundId = await syncDirectInbound(tx, row);
    if (directInboundId !== (row.directInboundId ?? null)) {
      return tx.outboundSale.update({ where: { id: row.id }, data: { directInboundId } });
    }
    return row;
  });

  res.json(updated);
});

export default router;
