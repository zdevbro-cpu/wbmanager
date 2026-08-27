import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { postInboundLedger } from '../lib/ledger.js';
import { toISO } from '../lib/date.js';
import { rememberCodes } from '../lib/rememberCodes.js';
import { rememberDriver } from '../lib/rememberDriver.js';

const router = Router();

// 폼에서 온 값만 반영한다. 관계·시스템 컬럼은 덮어쓰지 않는다.
const OMIT = ['id', 'createdAt', 'deletedAt', 'project', 'item', 'buyer', 'attachments'];
const editable = (body) => Object.fromEntries(Object.entries(body).filter(([k]) => !OMIT.includes(k)));

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
  // 임시저장만 보거나(true), 정상등록만 보거나(false). 없으면 둘 다 본다.
  const draft = req.query.draft;
  const range = {};
  if (from) range.gte = new Date(from);
  if (to) range.lte = new Date(to);

  // 배출자·운반자·처리자는 자유 입력이라 부분 일치로 찾는다.
  const like = (v) => ({ contains: v, mode: 'insensitive' });

  const wasteInbounds = await prisma.wasteInbound.findMany({
    where: {
      deletedAt: null,
      ...(draft === 'true' ? { isDraft: true } : draft === 'false' ? { isDraft: false } : {}),
      ...(projectId ? { projectId } : {}),
      ...(Object.keys(range).length ? { receiveDate: range } : {}),
      ...(vehicleType ? { vehicleType } : {}),
      ...(vehicleNo ? { vehicleNo } : {}),
      ...(driverName ? { driverName } : {}),
      ...(itemCode ? { itemCode } : {}),
      ...(olbaro ? { olbaroReported: olbaro === 'O' } : {}),
      ...(dischargerName ? { dischargerName: like(dischargerName) } : {}),
      ...(transporterName ? { transporterName: like(transporterName) } : {}),
      ...(processorName ? { processorName: like(processorName) } : {}),
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

  // 정산 항목 — 실중량·정산중량을 비우면 계근값에서 채우고, 금액은 정산중량 × 단가로 잡는다.
  const num = (v) => (v === '' || v == null ? undefined : Number(v));
  const actualWeight = num(req.body.actualWeight) ?? Number(grossWeight) - Number(tareWeight);
  const settledWeight = num(req.body.settledWeight) ?? netWeight;
  const unitPrice = num(req.body.unitPrice);
  const amount = num(req.body.amount) ?? (unitPrice != null ? settledWeight * unitPrice : undefined);

  const wasteInbound = await prisma.$transaction(async (tx) => {
    const created = await tx.wasteInbound.create({
      data: {
        ...req.body,
        netWeight,
        receiveDate: toISO(receiveDate),
        ...(handoverDate ? { handoverDate: toISO(handoverDate) } : {}),
        actualWeight,
        settledWeight,
        cubicMeter: num(req.body.cubicMeter),
        unitPrice,
        amount,
        transferDate: req.body.transferDate ? toISO(req.body.transferDate) : undefined,
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

  await rememberCodes([
    ['배출자', req.body.dischargerName],
    ['운반자', req.body.transporterName],
    ['처리자', req.body.processorName],
    ['하차지', req.body.unloadingPoint],
  ]);
  await rememberDriver(req.body.driverName, req.body.driverPhone);
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

// 올바로 신고 상태/인계일/비고를 포함한 등록 후 정정 (F-FZOGXB).
// 중량·품목·프로젝트가 바뀌면 재고원장을 다시 계상한다.
router.patch('/:id', async (req, res) => {
  const existing = await prisma.wasteInbound.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!existing) return res.status(404).json({ error: 'not found' });

  const patch = editable(req.body);
  const merged = { ...existing, ...patch };

  if (Number(merged.grossWeight) < Number(merged.tareWeight)) {
    return res.status(400).json({ error: '총중량은 공차중량보다 작을 수 없습니다.' });
  }
  const netWeight = Number(merged.grossWeight) - Number(merged.tareWeight) - Number(merged.lossWeight ?? 0);
  if (netWeight < 0) {
    return res.status(400).json({ error: '감량이 과다합니다. 입고량이 음수가 됩니다.' });
  }

  const num = (v) => (v === '' || v == null ? undefined : Number(v));
  const actualWeight = num(patch.actualWeight) ?? Number(merged.grossWeight) - Number(merged.tareWeight);
  const settledWeight = num(patch.settledWeight) ?? netWeight;
  const unitPrice = num(merged.unitPrice);
  const amount = num(patch.amount) ?? (unitPrice != null ? settledWeight * unitPrice : undefined);
  const receiveDate = patch.receiveDate ? toISO(patch.receiveDate) : existing.receiveDate;

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.wasteInbound.update({
      where: { id: req.params.id },
      data: {
        ...patch,
        netWeight,
        actualWeight,
        settledWeight,
        ...(amount !== undefined ? { amount } : {}),
        receiveDate,
        ...(patch.handoverDate !== undefined
          ? { handoverDate: patch.handoverDate ? toISO(patch.handoverDate) : null }
          : {}),
        ...(patch.transferDate !== undefined
          ? { transferDate: patch.transferDate ? toISO(patch.transferDate) : null }
          : {}),
      },
    });
    await tx.inventoryLedger.deleteMany({ where: { refType: 'waste_inbound', refId: row.id } });
    await postInboundLedger(
      {
        projectId: row.projectId,
        itemCode: row.itemCode,
        weight: netWeight,
        ledgerDate: row.receiveDate,
        refType: 'waste_inbound',
        refId: row.id,
      },
      tx,
    );
    return row;
  });

  await rememberCodes([
    ['배출자', patch.dischargerName],
    ['운반자', patch.transporterName],
    ['처리자', patch.processorName],
    ['하차지', patch.unloadingPoint],
  ]);
  await rememberDriver(patch.driverName, patch.driverPhone);
  res.json(updated);
});

export default router;
