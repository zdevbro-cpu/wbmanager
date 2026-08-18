import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

// data/품목마스터_설계.md 기준. 단가·거래처별 별칭·공제 실적값은 마스터에서 분리해 두지 않는다.
// 품목 코드 분류 — 등록 화면의 드롭다운과 같은 목록이다.
// 코드는 분류 접두어 + 두 자리 순번(FE-01)으로 자동 채번한다.
export const CODE_GROUPS = [
  { value: 'FE', label: '고철' },
  { value: 'NF', label: '비철' },   // 알루미늄·STS 등
  { value: 'CU', label: '구리' },
  { value: 'WS', label: '폐기물 스크랩' },
];

const GROUP_LABEL = Object.fromEntries(CODE_GROUPS.map((g) => [g.value, g.label]));

// 해당 접두어의 마지막 순번 다음 번호를 만든다. 빈 자리는 메우지 않고 뒤에 잇는다.
async function nextItemCode(group) {
  const rows = await prisma.itemMaster.findMany({
    where: { itemCode: { startsWith: `${group}-` } },
    select: { itemCode: true },
  });
  const last = rows.reduce((max, r) => {
    const n = Number(String(r.itemCode).slice(group.length + 1));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `${group}-${String(last + 1).padStart(2, '0')}`;
}

const TEXT_FIELDS = [
  'itemCode',
  'itemName',
  'aliasNames',
  'category',
  'subCategory',
  'minorCategory',
  'material',
  'grade',
  'baseUnit',
  'weighUnit',
  'purchaseUnit',
  'salesUnit',
  'usageType',
  'convertToItemCode',
  'zoneCode',
  'priceRefCode',
  'taxType',
  'ecountItemCode',
  'accountCode',
  'createdBy',
];
const EXTRA_TEXT_FIELDS = ['memo'];
const NUMBER_FIELDS = ['basePrice', 'unitFactor', 'expectedYield', 'deductImpurity', 'deductSoil', 'deductMoisture'];
const BOOL_FIELDS = ['qtyManaged', 'priceLinked', 'recycleDeductible', 'isActive'];

const pick = (body) => {
  const data = {};
  for (const key of [...TEXT_FIELDS, ...EXTRA_TEXT_FIELDS]) {
    if (body[key] !== undefined) data[key] = body[key] === '' ? null : body[key];
  }
  for (const key of NUMBER_FIELDS) {
    if (body[key] !== undefined) data[key] = body[key] === '' || body[key] === null ? null : Number(body[key]);
  }
  for (const key of BOOL_FIELDS) {
    if (body[key] !== undefined) data[key] = Boolean(body[key]);
  }
  return data;
};

// 등록 화면용 — 분류 목록과 각 분류의 다음 코드를 함께 준다.
router.get('/code-groups', async (req, res) => {
  const groups = await Promise.all(
    CODE_GROUPS.map(async (g) => ({ ...g, nextCode: await nextItemCode(g.value) })),
  );
  res.json(groups);
});

router.get('/', async (req, res) => {
  const items = await prisma.itemMaster.findMany({ orderBy: { itemName: 'asc' } });
  res.json(items);
});

router.post('/', async (req, res) => {
  const data = pick(req.body);
  const group = req.body.codeGroup;

  // 분류를 주면 코드를 자동 채번한다. 코드를 직접 준 경우(가져오기 등)는 그대로 쓴다.
  if (!data.itemCode && group) {
    if (!GROUP_LABEL[group]) return res.status(400).json({ error: '알 수 없는 품목 분류입니다.' });
    data.itemCode = await nextItemCode(group);
    data.category = data.category || GROUP_LABEL[group];
  }
  if (!data.itemName) return res.status(400).json({ error: '품목명은 필수입니다.' });
  if (!data.itemCode) return res.status(400).json({ error: '품목 분류 또는 품목코드가 필요합니다.' });
  data.category = data.category || '미분류';

  // 동시에 등록하면 같은 번호가 날 수 있어, 충돌 시 한 번 더 채번한다.
  try {
    const item = await prisma.itemMaster.create({ data });
    return res.status(201).json(item);
  } catch (err) {
    if (err.code === 'P2002' && group) {
      data.itemCode = await nextItemCode(group);
      const item = await prisma.itemMaster.create({ data });
      return res.status(201).json(item);
    }
    throw err;
  }
});

// 품목 정보 수정
router.patch('/:itemCode', async (req, res) => {
  const item = await prisma.itemMaster.update({
    where: { itemCode: req.params.itemCode },
    data: pick(req.body),
  });
  res.json(item);
});

// 삭제 — 입출고·재고가 참조 중이면 FK 제약에 걸리므로 그대로 알려 준다.
router.delete('/:itemCode', async (req, res) => {
  try {
    await prisma.itemMaster.delete({ where: { itemCode: req.params.itemCode } });
    res.status(204).end();
  } catch (err) {
    if (err.code === 'P2003') {
      return res.status(409).json({ error: '입출고·재고에서 사용 중인 품목은 삭제할 수 없습니다.' });
    }
    if (err.code === 'P2025') return res.status(404).json({ error: 'not found' });
    throw err;
  }
});

// 마스터에 없는 품목을 임시 등록 (S-ELHMAG)
router.post('/quick-create', async (req, res) => {
  const { itemCode, category, itemName } = req.body;
  if (!itemCode || !category || !itemName) {
    return res.status(400).json({ error: 'itemCode, category, itemName is required' });
  }
  const item = await prisma.itemMaster.create({
    data: { itemCode, category, itemName, isTemporary: true },
  });
  res.status(201).json(item);
});

router.patch('/:itemCode/promote', async (req, res) => {
  const item = await prisma.itemMaster.update({
    where: { itemCode: req.params.itemCode },
    data: { isTemporary: false, ...req.body },
  });
  res.json(item);
});

export default router;
