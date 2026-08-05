import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { postLedgerEntry, ensureUnclassifiedItem } from '../lib/ledger.js';
import { toISO } from '../lib/date.js';

const router = Router();

router.get('/', async (req, res) => {
  const { projectId } = req.query;
  const sortings = await prisma.sorting.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: { sortDate: 'desc' },
  });
  res.json(sortings);
});

// 반입된 물량의 품목을 확정하는 재분류. 재고 총량은 변하지 않으므로
// 원품목 OUT + 확정품목 IN(순증 0)으로 기록한다. 입고 시점에 이미 IN이 계상돼 있어
// 여기서 다시 IN만 넣으면 같은 물량이 두 번 잡힌다.
router.post('/', async (req, res) => {
  const { projectId, itemCode, sourceItemCode, sortDate, sortWeight } = req.body;

  if (!projectId || !itemCode || !sortDate || sortWeight == null) {
    return res.status(400).json({ error: 'projectId, itemCode, sortDate, sortWeight는 필수입니다.' });
  }
  if (Number(sortWeight) <= 0) {
    return res.status(400).json({ error: 'sortWeight는 0보다 커야 합니다.' });
  }
  if (sourceItemCode && sourceItemCode === itemCode) {
    return res.status(400).json({ error: '선별 전/후 품목이 같습니다.' });
  }

  const sorting = await prisma.$transaction(async (tx) => {
    const sourceCode = sourceItemCode || (await ensureUnclassifiedItem(tx));
    const created = await tx.sorting.create({
      data: { ...req.body, sourceItemCode: sourceCode, sortDate: toISO(sortDate) },
    });

    await postLedgerEntry(
      {
        projectId,
        itemCode: sourceCode,
        direction: 'OUT',
        weight: sortWeight,
        ledgerDate: toISO(sortDate),
        refType: 'sorting',
        refId: created.id,
      },
      tx,
    );
    await postLedgerEntry(
      {
        projectId,
        itemCode,
        direction: 'IN',
        weight: sortWeight,
        ledgerDate: toISO(sortDate),
        refType: 'sorting',
        refId: created.id,
      },
      tx,
    );
    return created;
  });

  res.status(201).json(sorting);
});

export default router;
