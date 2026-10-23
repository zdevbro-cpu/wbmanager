import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { toISO } from '../lib/date.js';
import { postLedgerEntry, ensureUnclassifiedItem } from '../lib/ledger.js';

// 재고 보정 (회의 2026-10-14 3번 · 회신 2026-10-23 결정-1 ③ · 결정-6)
//
// 계근 차이나 자연 감소로 재고가 맞지 않을 때, 또는 현금 출고처럼 정식 거래가 아닌 것을
// 덜어 낼 때 쓴다. 한 줄이 재고원장 한 줄을 만든다.
//
// 금액은 적지 않는다. 수량만 맞추고 매입·매출은 건드리지 않는다 — 그래서 손익보고서의
// 숫자는 보정을 해도 달라지지 않고 재고 수량만 맞는다.

const router = Router();

const KINDS = ['보정', '별도출고'];
const DIRECTIONS = ['IN', 'OUT'];

const fail = (res, e) => {
  const status = e.status ?? 500;
  if (status === 500) console.error('[inventory-adjust]', e.message);
  res.status(status).json({ error: status === 500 ? '처리하지 못했습니다.' : e.message });
};
const bad = (msg) => Object.assign(new Error(msg), { status: 400 });

router.get('/', async (req, res) => {
  const { projectId, itemCode, kind, from, to } = req.query;
  const range = {};
  if (from) range.gte = toISO(from);
  if (to) range.lte = toISO(`${to} 23:59:59`);
  const rows = await prisma.inventoryAdjust.findMany({
    where: {
      deletedAt: null,
      ...(projectId ? { projectId } : {}),
      ...(itemCode ? { itemCode } : {}),
      ...(kind ? { kind } : {}),
      ...(Object.keys(range).length ? { adjustDate: range } : {}),
    },
    include: { project: { select: { id: true, roundName: true } }, item: { select: { itemCode: true, itemName: true } } },
    orderBy: [{ adjustDate: 'desc' }, { createdAt: 'desc' }],
  });
  res.json(rows);
});

router.post('/', async (req, res) => {
  try {
    const { projectId, adjustDate, weight, reason } = req.body;
    const kind = req.body.kind || '보정';
    const direction = req.body.direction || 'OUT';

    if (!projectId) throw bad('현장을 고르세요.');
    if (!adjustDate) throw bad('날짜를 적으세요.');
    if (!KINDS.includes(kind)) throw bad(`구분은 ${KINDS.join(' · ')} 중에서 고르세요.`);
    if (!DIRECTIONS.includes(direction)) throw bad('더하는지 빼는지 고르세요.');

    const w = Number(weight);
    // 0은 재고를 바꾸지 않으면서 줄만 남겨 혼란을 준다. 부호는 direction으로 가린다.
    if (!Number.isFinite(w) || w <= 0) throw bad('중량은 0보다 큰 값으로 적으세요.');

    const row = await prisma.$transaction(async (tx) => {
      const itemCode = req.body.itemCode || (await ensureUnclassifiedItem(tx));
      const created = await tx.inventoryAdjust.create({
        data: {
          projectId,
          itemCode,
          adjustDate: toISO(adjustDate),
          kind,
          direction,
          weight: w,
          reason: reason ?? null,
          createdById: req.appUser?.id ?? null,
        },
      });
      await postLedgerEntry(
        {
          projectId,
          itemCode,
          direction,
          weight: w,
          ledgerDate: created.adjustDate,
          refType: 'adjust',
          refId: created.id,
        },
        tx,
      );
      return created;
    });
    res.status(201).json(row);
  } catch (e) {
    fail(res, e);
  }
});

// 고칠 때는 원장 줄을 지우고 다시 넣는다. 금액이 없으므로 따져 볼 것은 수량과 방향뿐이다.
router.patch('/:id', async (req, res) => {
  try {
    const existing = await prisma.inventoryAdjust.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!existing) return res.status(404).json({ error: '보정 내역을 찾을 수 없습니다.' });

    const kind = req.body.kind ?? existing.kind;
    const direction = req.body.direction ?? existing.direction;
    if (!KINDS.includes(kind)) throw bad(`구분은 ${KINDS.join(' · ')} 중에서 고르세요.`);
    if (!DIRECTIONS.includes(direction)) throw bad('더하는지 빼는지 고르세요.');

    const w = req.body.weight == null ? Number(existing.weight) : Number(req.body.weight);
    if (!Number.isFinite(w) || w <= 0) throw bad('중량은 0보다 큰 값으로 적으세요.');

    const row = await prisma.$transaction(async (tx) => {
      const updated = await tx.inventoryAdjust.update({
        where: { id: existing.id },
        data: {
          ...(req.body.projectId ? { projectId: req.body.projectId } : {}),
          ...(req.body.itemCode ? { itemCode: req.body.itemCode } : {}),
          ...(req.body.adjustDate ? { adjustDate: toISO(req.body.adjustDate) } : {}),
          ...(req.body.reason !== undefined ? { reason: req.body.reason } : {}),
          kind,
          direction,
          weight: w,
        },
      });
      await tx.inventoryLedger.deleteMany({ where: { refType: 'adjust', refId: updated.id } });
      await postLedgerEntry(
        {
          projectId: updated.projectId,
          itemCode: updated.itemCode,
          direction: updated.direction,
          weight: Number(updated.weight),
          ledgerDate: updated.adjustDate,
          refType: 'adjust',
          refId: updated.id,
        },
        tx,
      );
      return updated;
    });
    res.json(row);
  } catch (e) {
    fail(res, e);
  }
});

// 소프트 삭제. 원장 줄은 지워 재고가 보정 전으로 돌아가게 한다 —
// 다른 거래와 같은 방식이다.
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await prisma.$transaction(async (tx) => {
      await tx.inventoryLedger.deleteMany({ where: { refType: 'adjust', refId: req.params.id } });
      return tx.inventoryAdjust.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    });
    res.json(deleted);
  } catch (e) {
    fail(res, e);
  }
});

export default router;
