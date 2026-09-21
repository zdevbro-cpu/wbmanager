import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { toISO } from '../lib/date.js';
import { rememberCodes } from '../lib/rememberCodes.js';
import { syncTransport } from '../lib/transportSync.js';

const router = Router();

// 이동 — 우리 물건을 다른 자리로 옮긴 기록 (리뷰회의 5-5).
// 판 것도 처리 맡긴 것도 아니라 재고 총량은 그대로다. 그래서 재고원장에 넣지 않는다.
// 어디서 어디로 얼마나 갔는지만 남기고, 통합 원장에서 다른 유형과 함께 본다.

const num = (v) => (v === '' || v == null ? undefined : Number(v));

router.get('/', async (req, res) => {
  const { projectId, itemCode, fromPlace, toPlace, from, to } = req.query;
  const range = {};
  if (from) range.gte = new Date(`${from}T00:00:00+09:00`);
  if (to) range.lte = new Date(`${to}T23:59:59.999+09:00`);

  const rows = await prisma.inventoryMove.findMany({
    where: {
      deletedAt: null,
      ...(projectId ? { projectId } : {}),
      ...(itemCode ? { itemCode } : {}),
      ...(fromPlace ? { fromPlace } : {}),
      ...(toPlace ? { toPlace } : {}),
      ...(Object.keys(range).length ? { moveDate: range } : {}),
    },
    include: { project: { select: { roundName: true } }, item: { select: { itemName: true } } },
    orderBy: [{ moveDate: 'desc' }, { createdAt: 'desc' }],
  });
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { projectId, moveDate } = req.body;
  if (!projectId || !moveDate) return res.status(400).json({ error: 'projectId, moveDate는 필수입니다.' });
  if (num(req.body.weight) != null && Number(req.body.weight) < 0) {
    return res.status(400).json({ error: '중량은 0 이상이어야 합니다.' });
  }
  if (req.body.fromPlace && req.body.toPlace && req.body.fromPlace === req.body.toPlace) {
    return res.status(400).json({ error: '출발지와 도착지가 같습니다.' });
  }

  const row = await prisma.$transaction(async (tx) => {
    const made = await tx.inventoryMove.create({
    data: {
      projectId,
      moveDate: toISO(moveDate),
      itemCode: req.body.itemCode || null,
      itemName: req.body.itemName || null,
      fromPlace: req.body.fromPlace || null,
      toPlace: req.body.toPlace || null,
      weight: num(req.body.weight) ?? 0,
      vehicleNo: req.body.vehicleNo || null,
      driverName: req.body.driverName || null,
      memo: req.body.memo || null,
      transportCost: num(req.body.transportCost) ?? null,
      createdById: req.appUser?.id ?? null,
    },
    });
    // 자리 간 운반도 운반비다 — 적으면 운반비 표에 한 줄로 들어간다(리뷰회의 5-6).
    await syncTransport(tx, 'moveId', made, {
      date: made.moveDate,
      origin: made.fromPlace,
      destination: made.toPlace,
      weight: made.weight,
      cost: made.transportCost,
    });
    return made;
  });
  // 적어 넣은 자리는 다음부터 목록에 나온다.
  await rememberCodes([
    ['이동장소', req.body.fromPlace],
    ['이동장소', req.body.toPlace],
  ]);
  res.status(201).json(row);
});

router.patch('/:id', async (req, res) => {
  const existing = await prisma.inventoryMove.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!existing) return res.status(404).json({ error: 'not found' });

  const b = req.body;
  const merged = { ...existing, ...b };
  if (merged.fromPlace && merged.toPlace && merged.fromPlace === merged.toPlace) {
    return res.status(400).json({ error: '출발지와 도착지가 같습니다.' });
  }

  const set = (key, value) => (b[key] !== undefined ? { [key]: value } : {});
  const row = await prisma.$transaction(async (tx) => {
    const done = await tx.inventoryMove.update({
    where: { id: req.params.id },
    data: {
      ...set('moveDate', b.moveDate ? toISO(b.moveDate) : existing.moveDate),
      ...set('itemCode', b.itemCode || null),
      ...set('itemName', b.itemName || null),
      ...set('fromPlace', b.fromPlace || null),
      ...set('toPlace', b.toPlace || null),
      ...set('weight', num(b.weight) ?? 0),
      ...set('vehicleNo', b.vehicleNo || null),
      ...set('driverName', b.driverName || null),
      ...set('memo', b.memo || null),
      ...set('transportCost', num(b.transportCost) ?? null),
    },
    });
    await syncTransport(tx, 'moveId', done, {
      date: done.moveDate,
      origin: done.fromPlace,
      destination: done.toPlace,
      weight: done.weight,
      cost: done.transportCost,
    });
    return done;
  });
  await rememberCodes([
    ['이동장소', b.fromPlace],
    ['이동장소', b.toPlace],
  ]);
  res.json(row);
});

// 지운 기록은 화면에서만 감춘다 — 다른 등록 화면과 같은 방식이다.
router.delete('/:id', async (req, res) => {
  const row = await prisma.$transaction(async (tx) => {
    await tx.transport.deleteMany({ where: { moveId: req.params.id } });
    return tx.inventoryMove.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
  });
  res.json(row);
});

export default router;
