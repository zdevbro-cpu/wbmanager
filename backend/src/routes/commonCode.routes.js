import { Router } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// 화면에서 다루는 그룹 이름. 엑셀 머리글이 이 중 하나면 그 그룹으로 넣는다.
const GROUPS = [
  '배출자', '처리자', '작업자', '운반자', '상차지', '하차지',
  '자산 분류', '정비 구분', '일정 구분',
  '자격증 종류', '교육 과정', '부서', '직급',
  '정산주기', '제출서류 종류', '차종', '거래 구분',
];

// 머리글은 사람이 손으로 적는다. '자격증종류'처럼 띄어쓰기가 빠져도 같은 그룹으로 본다.
const squash = (v) => String(v ?? '').replace(/\s+/g, '').trim();
const GROUP_BY_KEY = new Map(GROUPS.map((g) => [squash(g), g]));

function resolveGroup(header) {
  const key = squash(header);
  if (!key) return null;
  return GROUP_BY_KEY.get(key) ?? null;
}

// 전체 목록(그룹별 정렬) 또는 ?group=차종 으로 단일 그룹 조회
router.get('/', async (req, res) => {
  const { group, includeInactive } = req.query;
  const codes = await prisma.commonCode.findMany({
    where: {
      ...(group ? { group } : {}),
      ...(includeInactive === 'true' ? {} : { isActive: true }),
    },
    orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }],
  });
  res.json(codes);
});

router.post('/', async (req, res) => {
  const { group, label } = req.body;
  if (!group || !label) return res.status(400).json({ error: 'group, label은 필수입니다.' });

  const exists = await prisma.commonCode.findUnique({ where: { group_label: { group, label } } });
  if (exists) return res.status(409).json({ error: '이미 등록된 항목입니다.' });

  const last = await prisma.commonCode.findFirst({ where: { group }, orderBy: { sortOrder: 'desc' } });
  const created = await prisma.commonCode.create({
    data: { group, label, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });
  res.status(201).json(created);
});

// 이름 변경 / 순서 변경 / 사용여부 토글
router.patch('/:id', async (req, res) => {
  const { label, sortOrder, isActive } = req.body;
  const updated = await prisma.commonCode.update({
    where: { id: req.params.id },
    data: {
      ...(label !== undefined ? { label } : {}),
      ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
  });
  res.json(updated);
});

// 같은 그룹 안에서 위/아래 항목과 순서를 맞바꾼다.
router.patch('/:id/move', async (req, res) => {
  const { direction } = req.body; // 'up' | 'down'
  const current = await prisma.commonCode.findUnique({ where: { id: req.params.id } });
  if (!current) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });

  const neighbor = await prisma.commonCode.findFirst({
    where: {
      group: current.group,
      sortOrder: direction === 'up' ? { lt: current.sortOrder } : { gt: current.sortOrder },
    },
    orderBy: { sortOrder: direction === 'up' ? 'desc' : 'asc' },
  });
  if (!neighbor) return res.json(current);

  await prisma.$transaction([
    prisma.commonCode.update({ where: { id: current.id }, data: { sortOrder: neighbor.sortOrder } }),
    prisma.commonCode.update({ where: { id: neighbor.id }, data: { sortOrder: current.sortOrder } }),
  ]);
  res.json({ ...current, sortOrder: neighbor.sortOrder });
});

router.delete('/:id', async (req, res) => {
  const deleted = await prisma.commonCode.delete({ where: { id: req.params.id } });
  res.json(deleted);
});

// 엑셀 한 장으로 여러 그룹을 한 번에 넣는다.
// 첫 줄이 그룹 이름(배출자·처리자·작업자·운반자·상차지·하차지·자격증 종류·교육 과정·부서·직급 …)이고
// 그 아래 칸이 값이다. 열마다 다른 그룹으로 들어가므로, 한 파일로 여러 목록을 동시에 채울 수 있다.
router.post('/bulk-upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '엑셀 파일이 필요합니다.' });

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(req.file.buffer);
  } catch {
    return res.status(400).json({ error: '엑셀 파일을 읽지 못했습니다. .xlsx 형식인지 확인하세요.' });
  }

  const sheet = wb.worksheets[0];
  if (!sheet) return res.status(400).json({ error: '시트가 없습니다.' });

  // 1행 = 머리글. 아는 이름만 담고 나머지 열은 건너뛴다.
  const columns = [];
  const unknown = [];
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const raw = String(cell.text ?? '').trim();
    if (!raw) return;
    const group = resolveGroup(raw);
    if (group) columns.push({ colNumber, group, header: raw });
    else unknown.push(raw);
  });

  if (!columns.length) {
    return res.status(400).json({
      error: '알아볼 수 있는 열 이름이 없습니다. 첫 줄에 그룹 이름을 적어 주세요.',
      groups: GROUPS,
    });
  }

  // 같은 그룹에 이미 있는 값은 건너뛴다 — 여러 번 올려도 중복이 생기지 않게 한다.
  const existing = await prisma.commonCode.findMany({
    where: { group: { in: columns.map((c) => c.group) } },
    select: { group: true, label: true },
  });
  const have = new Set(existing.map((e) => `${e.group}||${e.label}`));

  const maxOrder = new Map();
  for (const c of columns) {
    const last = await prisma.commonCode.findFirst({
      where: { group: c.group },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    maxOrder.set(c.group, last?.sortOrder ?? 0);
  }

  const rows = [];
  const result = columns.map((c) => ({ 열: c.header, 그룹: c.group, 추가: 0, 중복: 0 }));

  for (let r = 2; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);
    columns.forEach((c, i) => {
      const label = String(row.getCell(c.colNumber).text ?? '').trim();
      if (!label) return;
      const key = `${c.group}||${label}`;
      if (have.has(key)) {
        result[i].중복 += 1;
        return;
      }
      have.add(key);
      const order = (maxOrder.get(c.group) ?? 0) + 1;
      maxOrder.set(c.group, order);
      rows.push({ group: c.group, label, sortOrder: order });
      result[i].추가 += 1;
    });
  }

  if (rows.length) await prisma.commonCode.createMany({ data: rows, skipDuplicates: true });

  res.json({ 추가: rows.length, 열: result, 모르는열: unknown });
});

// 양식 내려받기 — 어떤 이름을 써야 하는지 파일로 알려 주는 편이 설명보다 빠르다.
router.get('/bulk-template', async (req, res) => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('공통코드');
  sheet.addRow(GROUPS);
  sheet.getRow(1).font = { bold: true };
  GROUPS.forEach((g, i) => {
    sheet.getColumn(i + 1).width = Math.max(12, g.length * 2 + 4);
  });

  const buffer = await wb.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', "attachment; filename=\"common-code-template.xlsx\"; filename*=UTF-8''%EA%B3%B5%ED%86%B5%EC%BD%94%EB%93%9C_%EC%96%91%EC%8B%9D.xlsx");
  res.send(Buffer.from(buffer));
});

export default router;
