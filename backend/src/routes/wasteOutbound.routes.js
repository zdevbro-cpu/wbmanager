import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { postLedgerEntry } from '../lib/ledger.js';
import { toISO } from '../lib/date.js';
import { rememberCodes } from '../lib/rememberCodes.js';
import { rememberDriver } from '../lib/rememberDriver.js';

const router = Router();

// 폼에서 온 값만 반영한다. 관계·시스템 컬럼은 덮어쓰지 않는다.
const OMIT = ['id', 'createdAt', 'deletedAt', 'project', 'item', 'buyer', 'attachments'];
const editable = (body) => Object.fromEntries(Object.entries(body).filter(([k]) => !OMIT.includes(k)));

// 반출에 적은 운반비를 운반비 관리(Transport)에도 한 건으로 남긴다.
// 손익의 운반비는 Transport 표만 합산하기 때문에, 여기서 만들어 두지 않으면
// 현장이 적은 운반비가 원가에 잡히지 않는다. 반출 건을 고치면 같이 고쳐지고,
// 운반비를 지우거나 반출을 삭제하면 짝이 된 건도 걷어낸다.
async function syncTransportCost(tx, row) {
  const cost = Number(row.transportCost ?? 0);
  const existing = await tx.transport.findUnique({ where: { wasteOutboundId: row.id } });

  if (cost > 0) {
    const data = {
      projectId: row.projectId,
      transportDate: row.outboundDate,
      vehicleNo: row.vehicleNo,
      vehicleType: row.vehicleType,
      origin: row.loadingPoint,
      destination: row.unloadingPoint,
      weight: row.weight,
      supplyAmount: cost,
      wasteOutboundId: row.id,
    };
    if (existing) await tx.transport.update({ where: { id: existing.id }, data });
    else await tx.transport.create({ data });
    return;
  }

  if (existing) await tx.transport.delete({ where: { id: existing.id } });
}

router.get('/', async (req, res) => {
  const {
    projectId,
    unreported,
    from,
    to,
    vehicleType,
    vehicleNo,
    driverName,
    itemCode,
    olbaro,
    dischargerName,
    transporterName,
    processorName,
  } = req.query;
  const range = {};
  if (from) range.gte = new Date(from);
  if (to) range.lte = new Date(to);

  // 배출자·운반자는 자유 입력, 처리자는 거래처 마스터라 이름으로 찾는다.
  const like = (v) => ({ contains: v, mode: 'insensitive' });

  const wasteOutbounds = await prisma.wasteOutbound.findMany({
    where: {
      deletedAt: null,
      ...(projectId ? { projectId } : {}),
      ...(Object.keys(range).length ? { outboundDate: range } : {}),
      ...(vehicleType ? { vehicleType } : {}),
      ...(vehicleNo ? { vehicleNo } : {}),
      ...(driverName ? { driverName } : {}),
      ...(itemCode ? { itemCode } : {}),
      ...(olbaro ? { olbaroReported: olbaro === 'O' } : {}),
      ...(dischargerName ? { dischargerName: like(dischargerName) } : {}),
      ...(transporterName ? { transporterName: like(transporterName) } : {}),
      ...(processorName ? { buyer: { name: like(processorName) } } : {}),
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
    await syncTransportCost(tx, created);
    return created;
  });

  await rememberCodes([
    ['배출자', req.body.dischargerName],
    ['운반자', req.body.transporterName],
    ['상차지', req.body.loadingPoint],
  ]);
  await rememberDriver(req.body.driverName, req.body.driverPhone);
  res.status(201).json(wasteOutbound);
});

// 소프트 삭제. 재고원장은 파생 데이터라 참조 행을 지워 재고가 줄어든 채 남지 않게 한다.
router.delete('/:id', async (req, res) => {
  const deleted = await prisma.$transaction(async (tx) => {
    await tx.inventoryLedger.deleteMany({ where: { refType: 'waste_outbound', refId: req.params.id } });
    await tx.transport.deleteMany({ where: { wasteOutboundId: req.params.id } });
    return tx.wasteOutbound.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
  });
  res.json(deleted);
});

// 올바로 신고 상태/인계일/메모를 포함한 등록 후 정정 (F-FZOGXB).
// 정산중량·품목·프로젝트가 바뀌면 재고원장을 다시 계상한다.
router.patch('/:id', async (req, res) => {
  const existing = await prisma.wasteOutbound.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!existing) return res.status(404).json({ error: 'not found' });

  const patch = editable(req.body);
  const merged = { ...existing, ...patch };

  if (merged.grossWeight != null && merged.tareWeight != null && Number(merged.grossWeight) < Number(merged.tareWeight)) {
    return res.status(400).json({ error: '총중량은 공차중량보다 작을 수 없습니다.' });
  }

  const actualWeight =
    merged.grossWeight != null && merged.tareWeight != null
      ? Number(merged.grossWeight) - Number(merged.tareWeight)
      : null;
  const settledWeight =
    patch.weight != null
      ? Number(patch.weight)
      : patch.preLossWeight != null
        ? Number(patch.preLossWeight)
        : actualWeight != null
          ? actualWeight - Number(merged.lossWeight ?? 0)
          : Number(existing.weight);

  if (settledWeight <= 0) {
    return res.status(400).json({ error: '정산중량은 0보다 커야 합니다.' });
  }

  const settledAmount =
    patch.amount != null
      ? Number(patch.amount)
      : merged.unitPrice != null
        ? settledWeight * Number(merged.unitPrice)
        : null;
  const outboundDate = patch.outboundDate ? toISO(patch.outboundDate) : existing.outboundDate;

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.wasteOutbound.update({
      where: { id: req.params.id },
      data: {
        ...patch,
        outboundDate,
        ...(patch.handoverDate !== undefined
          ? { handoverDate: patch.handoverDate ? toISO(patch.handoverDate) : null }
          : {}),
        ...(patch.transferDate !== undefined
          ? { transferDate: patch.transferDate ? toISO(patch.transferDate) : null }
          : {}),
        ...(actualWeight != null ? { actualWeight } : {}),
        weight: settledWeight,
        ...(settledAmount != null ? { amount: settledAmount } : {}),
      },
    });
    await tx.inventoryLedger.deleteMany({ where: { refType: 'waste_outbound', refId: row.id } });
    if (row.itemCode) {
      await postLedgerEntry(
        {
          projectId: row.projectId,
          itemCode: row.itemCode,
          direction: 'OUT',
          weight: settledWeight,
          ledgerDate: row.outboundDate,
          refType: 'waste_outbound',
          refId: row.id,
        },
        tx,
      );
    }
    await syncTransportCost(tx, row);
    return row;
  });

  await rememberCodes([
    ['배출자', patch.dischargerName],
    ['운반자', patch.transporterName],
    ['상차지', patch.loadingPoint],
  ]);
  await rememberDriver(patch.driverName, patch.driverPhone);
  res.json(updated);
});

export default router;
