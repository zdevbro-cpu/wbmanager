import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

// 세금계산서 발행에 필요한 업체 정보까지 마스터에서 받는다.
const FIELDS = [
  'name',
  'vendorType',
  'bizRegNo',
  'corpRegNo',
  'ceoName',
  'bizType',
  'bizItem',
  'address',
  'phone',
  'fax',
  'contactName',
  'contactPhone',
  'contactEmail',
  'memo',
];

const pick = (body) =>
  FIELDS.reduce((data, key) => {
    if (body[key] !== undefined) data[key] = body[key] === '' ? null : body[key];
    return data;
  }, {});

// 목록 조회 (드롭다운 선택용)
router.get('/', async (req, res) => {
  const vendors = await prisma.vendor.findMany({ orderBy: { name: 'asc' } });
  res.json(vendors);
});

// 정식 등록
router.post('/', async (req, res) => {
  const data = pick(req.body);
  if (!data.name) return res.status(400).json({ error: 'name is required' });
  const vendor = await prisma.vendor.create({ data });
  res.status(201).json(vendor);
});

// 업체 정보 수정
router.patch('/:id', async (req, res) => {
  const vendor = await prisma.vendor.update({
    where: { id: req.params.id },
    data: pick(req.body),
  });
  res.json(vendor);
});

// 마스터에 없는 거래처를 임시 등록 (S-ELHMAG: 마스터 미존재 값 처리)
router.post('/quick-create', async (req, res) => {
  const { name, vendorType } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const vendor = await prisma.vendor.create({
    data: { name, vendorType, isTemporary: true },
  });
  res.status(201).json(vendor);
});

// 임시 등록건을 정식 마스터로 승격
router.patch('/:id/promote', async (req, res) => {
  const vendor = await prisma.vendor.update({
    where: { id: req.params.id },
    data: { isTemporary: false, ...req.body },
  });
  res.json(vendor);
});

export default router;
