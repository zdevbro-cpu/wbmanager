import { Router } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
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

// ── 엑셀 일괄 등록 ──────────────────────────
// 1행 머리글을 보고 칸을 찾는다. 열 순서가 바뀌거나 모르는 열이 섞여도 읽는다.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function readSheet(req, res, headers) {
  if (!req.file) {
    res.status(400).json({ error: '엑셀 파일이 필요합니다.' });
    return null;
  }
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(req.file.buffer);
  } catch {
    res.status(400).json({ error: '엑셀 파일을 읽지 못했습니다. .xlsx 형식인지 확인하세요.' });
    return null;
  }
  const sheet = wb.worksheets[0];
  if (!sheet) {
    res.status(400).json({ error: '시트가 없습니다.' });
    return null;
  }
  const columns = [];
  const unknown = [];
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const raw = String(cell.text ?? '').replace(/\s+/g, '').replace(/\*$/, '');
    if (!raw) return;
    const key = headers[raw];
    if (key) columns.push({ colNumber, key });
    else unknown.push(String(cell.text).trim());
  });
  const rows = [];
  for (let r = 2; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);
    const data = {};
    for (const c of columns) {
      const text = String(row.getCell(c.colNumber).text ?? '').trim();
      if (text) data[c.key] = text;
    }
    if (Object.keys(data).length) rows.push({ rowNo: r, data });
  }
  return { columns, unknown, rows };
}

async function sendTemplate(res, sheetName, titles, notes, fileName) {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet(sheetName);
  sheet.addRow(titles);
  sheet.getRow(1).font = { bold: true };
  titles.forEach((t, i) => {
    sheet.getColumn(i + 1).width = Math.max(12, t.length * 2 + 6);
  });
  const guide = wb.addWorksheet('작성안내');
  notes.forEach((n) => guide.addRow([n]));
  guide.getColumn(1).width = 100;
  const buffer = await wb.xlsx.writeBuffer();
  res.setHeader('Content-Type', XLSX_TYPE);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="template.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
  );
  res.send(Buffer.from(buffer));
}

// 머리글 → 칸. 화면에 보이는 이름 그대로 적으면 된다(띄어쓰기는 무시).
const VENDOR_HEADERS = {
  거래처명: 'name',
  구분: 'vendorType',
  사업자등록번호: 'bizRegNo',
  법인등록번호: 'corpRegNo',
  대표자: 'ceoName',
  업태: 'bizType',
  종목: 'bizItem',
  주소: 'address',
  전화: 'phone',
  팩스: 'fax',
  담당자: 'contactName',
  담당자연락처: 'contactPhone',
  메일: 'contactEmail',
  비고: 'memo',
};
const VENDOR_TITLES = [
  '거래처명',
  '구분',
  '사업자등록번호',
  '법인등록번호',
  '대표자',
  '업태',
  '종목',
  '주소',
  '전화',
  '팩스',
  '담당자',
  '담당자 연락처',
  '메일',
  '비고',
];

// 양식 내려받기
router.get('/bulk-template', async (req, res) => {
  await sendTemplate(
    res,
    '거래처',
    VENDOR_TITLES,
    [
      '1행 머리글은 그대로 두고 2행부터 한 줄에 거래처 하나씩 적습니다.',
      '거래처명은 필수입니다. 구분은 매입처 · 매각처 · 자회사 · 폐기물업체 중에서 적습니다.',
      '이미 있는 거래처명이면 파일 값으로 고칩니다(덮어쓰기). 비워 둔 칸은 기존 값을 그대로 둡니다.',
      '같은 이름의 거래처가 시스템에 두 곳 이상 있으면 어느 것인지 알 수 없어 그 줄은 건너뜁니다.',
    ],
    '거래처_양식.xlsx',
  );
});

// 일괄 등록 — 같은 거래처명이 있으면 덮어쓰고, 없으면 새로 등록한다.
router.post('/bulk-upload', upload.single('file'), async (req, res) => {
  const sheet = await readSheet(req, res, VENDOR_HEADERS);
  if (!sheet) return;
  if (!sheet.columns.some((c) => c.key === 'name')) {
    return res.status(400).json({ error: "첫 줄에 '거래처명' 열이 있어야 합니다." });
  }

  const existing = await prisma.vendor.findMany({ select: { id: true, name: true } });
  const byName = new Map();
  for (const v of existing) {
    const key = v.name.trim();
    byName.set(key, [...(byName.get(key) ?? []), v.id]);
  }

  let added = 0;
  let updated = 0;
  const errors = [];
  for (const { rowNo, data } of sheet.rows) {
    if (!data.name) {
      errors.push({ 행: rowNo, 사유: '거래처명이 비어 있습니다.' });
      continue;
    }
    const ids = byName.get(data.name) ?? [];
    if (ids.length > 1) {
      errors.push({ 행: rowNo, 사유: `'${data.name}' 거래처가 ${ids.length}곳 있어 어느 것인지 알 수 없습니다.` });
      continue;
    }
    try {
      if (ids.length === 1) {
        await prisma.vendor.update({ where: { id: ids[0] }, data });
        updated += 1;
      } else {
        const v = await prisma.vendor.create({ data });
        byName.set(data.name, [v.id]);
        added += 1;
      }
    } catch (err) {
      errors.push({ 행: rowNo, 사유: err.message?.split('\n').pop() || '저장 실패' });
    }
  }

  res.json({ 추가: added, 수정: updated, 오류: errors, 모르는열: sheet.unknown });
});

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

// 삭제 — 거래·프로젝트가 참조 중이면 FK 제약에 걸리므로 그대로 알려 준다.
router.delete('/:id', async (req, res) => {
  try {
    await prisma.vendor.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    if (err.code === 'P2003') {
      return res.status(409).json({ error: '거래·프로젝트에서 사용 중인 거래처는 삭제할 수 없습니다.' });
    }
    if (err.code === 'P2025') return res.status(404).json({ error: 'not found' });
    throw err;
  }
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
