import { Router } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
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
const ITEM_HEADERS = {
  품목코드: 'itemCode',
  품목명: 'itemName',
  대분류: 'category',
  중분류: 'subCategory',
  소분류: 'minorCategory',
  재질: 'material',
  등급: 'grade',
  기본단위: 'baseUnit',
  기준단가: 'basePrice',
  별칭: 'aliasNames',
  현장호칭: 'aliasNames',
  용도: 'usageType',
  비고: 'memo',
};
const ITEM_TITLES = ['품목코드', '품목명', '대분류', '소분류', '재질', '등급', '기본단위', '기준단가', '별칭', '비고'];

// 대분류 칸으로 코드 분류를 찾는다 — 'FE'처럼 접두어를 적어도, '고철'처럼 이름을 적어도 된다.
const groupOf = (text) => {
  const t = String(text ?? '').trim();
  return CODE_GROUPS.find((g) => g.value === t.toUpperCase() || g.label === t)?.value ?? null;
};

// 양식 내려받기
router.get('/bulk-template', async (req, res) => {
  await sendTemplate(
    res,
    '품목',
    ITEM_TITLES,
    [
      '1행 머리글은 그대로 두고 2행부터 한 줄에 품목 하나씩 적습니다.',
      '품목명은 필수입니다.',
      '품목코드가 이미 있으면 파일 값으로 고칩니다(덮어쓰기). 비워 둔 칸은 기존 값을 그대로 둡니다.',
      `품목코드를 비워 두면 대분류로 코드를 자동으로 붙입니다. 대분류: ${CODE_GROUPS.map((g) => `${g.value}(${g.label})`).join(' · ')}`,
      '별칭(현장 호칭)은 쉼표로 구분해 여러 개 적을 수 있습니다. 기준단가는 숫자만 적습니다.',
    ],
    '품목_양식.xlsx',
  );
});

// 일괄 등록 — 같은 품목코드가 있으면 덮어쓰고, 없으면 새로 등록한다.
router.post('/bulk-upload', upload.single('file'), async (req, res) => {
  const sheet = await readSheet(req, res, ITEM_HEADERS);
  if (!sheet) return;
  if (!sheet.columns.some((c) => c.key === 'itemName' || c.key === 'itemCode')) {
    return res.status(400).json({ error: "첫 줄에 '품목코드' 또는 '품목명' 열이 있어야 합니다." });
  }

  const existing = new Set((await prisma.itemMaster.findMany({ select: { itemCode: true } })).map((i) => i.itemCode));

  let added = 0;
  let updated = 0;
  const errors = [];
  for (const { rowNo, data } of sheet.rows) {
    if (data.basePrice !== undefined) {
      const n = Number(String(data.basePrice).replace(/[,\s원]/g, ''));
      if (!Number.isFinite(n)) {
        errors.push({ 행: rowNo, 사유: `기준단가 '${data.basePrice}'가 숫자가 아닙니다.` });
        continue;
      }
      data.basePrice = n;
    }
    if (data.itemCode) data.itemCode = data.itemCode.toUpperCase();

    try {
      if (data.itemCode && existing.has(data.itemCode)) {
        const { itemCode, ...rest } = data;
        await prisma.itemMaster.update({ where: { itemCode }, data: rest });
        updated += 1;
        continue;
      }
      if (!data.itemName) {
        errors.push({ 행: rowNo, 사유: '품목명이 비어 있습니다.' });
        continue;
      }
      if (!data.itemCode) {
        const group = groupOf(data.category);
        if (!group) {
          errors.push({ 행: rowNo, 사유: '품목코드가 없고, 대분류로 코드 분류를 알 수 없습니다.' });
          continue;
        }
        data.itemCode = await nextItemCode(group);
        data.category = GROUP_LABEL[group];
      }
      data.category = data.category || '미분류';
      await prisma.itemMaster.create({ data });
      existing.add(data.itemCode);
      added += 1;
    } catch (err) {
      errors.push({ 행: rowNo, 사유: err.message?.split('\n').pop() || '저장 실패' });
    }
  }

  res.json({ 추가: added, 수정: updated, 오류: errors, 모르는열: sheet.unknown });
});

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
