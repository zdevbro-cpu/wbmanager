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
  const { projectId, from, to, vehicleType, vehicleNo, driverName, itemCode } = req.query;
  // 임시저장만 보거나(true), 정상등록만 보거나(false). 없으면 둘 다 본다.
  const draft = req.query.draft;
  const range = {};
  if (from) range.gte = new Date(from);
  if (to) range.lte = new Date(to);

  const inbounds = await prisma.inbound.findMany({
    where: {
      deletedAt: null,
      ...(draft === 'true' ? { isDraft: true } : draft === 'false' ? { isDraft: false } : {}),
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
      data: { ...req.body, createdById: req.appUser?.id ?? null, netWeight, stockWeight: stock, inboundDate: toISO(inboundDate) },
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

  await rememberCodes([['하차지', req.body.unloadingPoint]]);
  await rememberDriver(req.body.driverName, req.body.driverPhone);
  res.status(201).json(inbound);
});

// 등록 후 정정. 중량·품목·프로젝트가 바뀌면 재고원장을 다시 계상한다.
router.patch('/:id', async (req, res) => {
  const existing = await prisma.inbound.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!existing) return res.status(404).json({ error: 'not found' });

  const patch = editable(req.body);
  const merged = { ...existing, ...patch };

  if (Number(merged.grossWeight) < 0 || Number(merged.tareWeight) < 0 || Number(merged.lossWeight ?? 0) < 0) {
    return res.status(400).json({ error: '중량은 0 이상이어야 합니다.' });
  }
  if (Number(merged.grossWeight) < Number(merged.tareWeight)) {
    return res.status(400).json({ error: '만차중량은 공차중량보다 작을 수 없습니다.' });
  }

  const netWeight = Number(merged.grossWeight) - Number(merged.tareWeight) - Number(merged.lossWeight ?? 0);
  if (netWeight < 0) {
    return res.status(400).json({ error: '감량이 과다합니다. 입고량이 음수가 됩니다.' });
  }
  const stock = patch.stockWeight ?? netWeight;
  const inboundDate = patch.inboundDate ? toISO(patch.inboundDate) : existing.inboundDate;

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.inbound.update({
      where: { id: req.params.id },
      data: { ...patch, netWeight, stockWeight: stock, inboundDate },
    });
    await tx.inventoryLedger.deleteMany({ where: { refType: 'inbound', refId: row.id } });
    await postInboundLedger(
      {
        projectId: row.projectId,
        itemCode: row.itemCode,
        weight: stock,
        ledgerDate: row.inboundDate,
        refType: 'inbound',
        refId: row.id,
      },
      tx,
    );
    return row;
  });

  await rememberCodes([['하차지', patch.unloadingPoint]]);
  await rememberDriver(patch.driverName, patch.driverPhone);
  res.json(updated);
});

export default router;
