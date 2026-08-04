import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.get('/', async (req, res) => {
  const items = await prisma.itemMaster.findMany({ orderBy: { itemName: 'asc' } });
  res.json(items);
});

router.post('/', async (req, res) => {
  const item = await prisma.itemMaster.create({ data: req.body });
  res.status(201).json(item);
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
