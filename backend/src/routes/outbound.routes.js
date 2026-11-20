import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { postLedgerEntry, postInboundLedger } from '../lib/ledger.js';
import { syncTransport } from '../lib/transportSync.js';
import { toISO } from '../lib/date.js';
import { rememberCodes } from '../lib/rememberCodes.js';
import { rememberDriver } from '../lib/rememberDriver.js';

const router = Router();

// 계량증명서를 여러 현장·품목으로 나눈 줄을 다시 깐다 (요청 2026-11-13).
//
// 줄이 있으면 재고는 줄마다 빠지고, 없으면 지금까지처럼 출고 한 건이 통째로 빠진다.
// 줄 중량의 합이 정산중량과 다르면 재고가 어긋나므로 저장 전에 막는다.
function normalizeSplits(raw, settledWeight) {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const rows = raw
    .map((r) => ({
      projectId: r.projectId,
      itemCode: r.itemCode,
      weight: Number(r.weight ?? 0),
      amount: r.amount == null || r.amount === '' ? null : Number(r.amount),
      memo: r.memo ?? null,
    }))
    .filter((r) => r.projectId && r.itemCode && r.weight > 0);

  if (rows.length === 0) return [];

  const sum = rows.reduce((acc, r) => acc + r.weight, 0);
  const settled = Number(settledWeight ?? 0);
  // 소수 셋째 자리까지 다루므로 그보다 작은 차이는 반올림 오차로 본다.
  if (Math.abs(sum - settled) > 0.001) {
    throw Object.assign(
      new Error(`나눠 적은 중량의 합(${sum.toLocaleString()}kg)이 정산중량(${settled.toLocaleString()}kg)과 다릅니다.`),
      { status: 400 },
    );
  }
  return rows;
}

// 출고 한 건의 재고 반영을 다시 깐다. 분할이 있으면 줄마다 OUT 을 쌓는다.
async function repostOutboundLedger(tx, row, splits) {
  await tx.inventoryLedger.deleteMany({ where: { refType: 'outbound_sale', refId: row.id } });
  if (splits.length === 0) {
    await postLedgerEntry(
      {
        projectId: row.projectId,
        itemCode: row.itemCode,
        direction: 'OUT',
        weight: row.settledWeight,
        ledgerDate: row.outboundDate,
        refType: 'outbound_sale',
        refId: row.id,
      },
      tx,
    );
    return;
  }
  for (const sp of splits) {
    await postLedgerEntry(
      {
        projectId: sp.projectId,
        itemCode: sp.itemCode,
        direction: 'OUT',
        weight: sp.weight,
        ledgerDate: row.outboundDate,
        refType: 'outbound_sale',
        refId: row.id,
      },
      tx,
    );
  }
}

// 폼에서 온 값만 반영한다. 관계·시스템 컬럼은 덮어쓰지 않는다.
const OMIT = ['id', 'createdAt', 'deletedAt', 'project', 'item', 'buyer', 'attachments', 'directInboundId', 'splits'];
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
  // 임시저장만 보거나(true), 정상등록만 보거나(false). 없으면 둘 다 본다.
  const draft = req.query.draft;
  const range = {};
  if (from) range.gte = new Date(from);
  if (to) range.lte = new Date(to);

  const outbounds = await prisma.outboundSale.findMany({
    where: {
      deletedAt: null,
      ...(draft === 'true' ? { isDraft: true } : draft === 'false' ? { isDraft: false } : {}),
      ...(projectId ? { projectId } : {}),
      ...(Object.keys(range).length ? { outboundDate: range } : {}),
      ...(vehicleType ? { vehicleType } : {}),
      ...(vehicleNo ? { vehicleNo } : {}),
      ...(driverName ? { driverName } : {}),
      ...(itemCode ? { itemCode } : {}),
    },
    include: { project: true, item: true, buyer: true, attachments: true, splits: { include: { project: { select: { roundName: true } }, item: { select: { itemName: true } } } } },
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

  try {
    const outbound = await prisma.$transaction(async (tx) => {
    // splits 는 따로 다룬다 — 출고 표의 칸이 아니라 딸린 줄이므로 그대로 넘기면 안 된다.
    const { splits: _splits, ...body } = req.body;
    const created = await tx.outboundSale.create({
      data: {
        ...body,
        createdById: req.appUser?.id ?? null,
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
    // 여러 현장·품목으로 나눠 적었으면 줄로 남기고, 재고도 줄마다 뺀다.
    const splits = normalizeSplits(req.body.splits, settledWeight);
    if (splits.length) {
      await tx.outboundSplit.createMany({ data: splits.map((sp) => ({ ...sp, outboundSaleId: created.id })) });
    }
    await repostOutboundLedger(tx, created, splits);

    // 이 건에 적은 운반비를 운반비 표에 한 줄로 남긴다(리뷰회의 5-6).
    await syncTransport(tx, 'outboundSaleId', created, {
      date: created.outboundDate,
      origin: created.loadingPoint ?? null,
      destination: created.unloadingPoint ?? null,
      weight: created.settledWeight,
      cost: created.transportCost,
      tax: created.transportTax,
    });

    const directInboundId = await syncDirectInbound(tx, created);
    if (directInboundId) {
      return tx.outboundSale.update({ where: { id: created.id }, data: { directInboundId } });
    }
    return created;
  });

  await rememberCodes([['상차지', req.body.loadingPoint]]);
  await rememberDriver(req.body.driverName, req.body.driverPhone);
  res.status(201).json(outbound);
  } catch (e) {
    if (e?.status === 400) return res.status(400).json({ error: e.message });
    console.error('[outbound]', e.message);
    return res.status(500).json({ error: '저장하지 못했습니다.' });
  }
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

  try {
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
    // 나눠 적은 줄을 보냈으면 통째로 다시 깐다. 보내지 않았으면 있던 줄을 그대로 둔다 —
    // 다른 칸만 고치러 들어온 수정이 줄을 지우면 안 되기 때문이다.
    let splits;
    if (req.body.splits !== undefined) {
      splits = normalizeSplits(req.body.splits, settledWeight);
      await tx.outboundSplit.deleteMany({ where: { outboundSaleId: row.id } });
      if (splits.length) {
        await tx.outboundSplit.createMany({ data: splits.map((sp) => ({ ...sp, outboundSaleId: row.id })) });
      }
    } else {
      splits = (
        await tx.outboundSplit.findMany({ where: { outboundSaleId: row.id } })
      ).map((sp) => ({ projectId: sp.projectId, itemCode: sp.itemCode, weight: Number(sp.weight) }));
    }
    await repostOutboundLedger(tx, row, splits);

    await syncTransport(tx, 'outboundSaleId', row, {
      date: row.outboundDate,
      origin: row.loadingPoint ?? null,
      destination: row.unloadingPoint ?? null,
      weight: row.settledWeight,
      cost: row.transportCost,
      tax: row.transportTax,
    });

    const directInboundId = await syncDirectInbound(tx, row);
    if (directInboundId !== (row.directInboundId ?? null)) {
      return tx.outboundSale.update({ where: { id: row.id }, data: { directInboundId } });
    }
    return row;
  });

  await rememberCodes([['상차지', patch.loadingPoint]]);
  await rememberDriver(patch.driverName, patch.driverPhone);
  res.json(updated);
  } catch (e) {
    if (e?.status === 400) return res.status(400).json({ error: e.message });
    console.error('[outbound]', e.message);
    return res.status(500).json({ error: '고치지 못했습니다.' });
  }
});

export default router;
