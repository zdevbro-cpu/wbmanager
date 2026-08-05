import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

// data/품목마스터_설계.md 기준. 단가·거래처별 별칭·공제 실적값은 마스터에서 분리해 두지 않는다.
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
const NUMBER_FIELDS = ['basePrice', 'unitFactor', 'expectedYield', 'deductImpurity', 'deductSoil', 'deductMoisture'];
const BOOL_FIELDS = ['qtyManaged', 'priceLinked', 'recycleDeductible', 'isActive'];

const pick = (body) => {
  const data = {};
  for (const key of TEXT_FIELDS) {
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

router.get('/', async (req, res) => {
  const items = await prisma.itemMaster.findMany({ orderBy: { itemName: 'asc' } });
  res.json(items);
});

router.post('/', async (req, res) => {
  const data = pick(req.body);
  if (!data.itemCode || !data.category || !data.itemName) {
    return res.status(400).json({ error: 'itemCode, category, itemName is required' });
  }
  const item = await prisma.itemMaster.create({ data });
  res.status(201).json(item);
});

// 품목 정보 수정
router.patch('/:itemCode', async (req, res) => {
  const item = await prisma.itemMaster.update({
    where: { itemCode: req.params.itemCode },
    data: pick(req.body),
  });
  res.json(item);
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
