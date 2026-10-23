import { Router } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma.js';
import { toISO } from '../lib/date.js';

// 자산 일괄 등록 — 「차량·중장비·어테치 관리대장」을 그대로 올려 넣기 위한 길이다.
// (회의 2026-10-14 5-12 · 회신 2026-10-23 결정-4 · 결정-5)
//
// 자산번호는 고객이 쓰는 관리번호를 그대로 쓴다. 관리번호가 없는 차량은 차량번호를 쓴다.
// 같은 자산번호가 이미 있으면 고치고, 없으면 새로 만든다 — 두 번 올려도 늘어나지 않는다.

const router = Router();
// 30MB까지 받는다. 그 위는 Cloud Run이 요청 자체를 자르므로(32MiB) 올려도 닿지 않는다.
// 관리대장 원본은 사진·서류가 박혀 있어 33MB다 — 사진을 지운 사본으로 올리시면 된다.
const MAX_UPLOAD = 30 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD } });

// multer가 파일 크기로 막으면 무슨 일인지 알려 준다. 안 그러면 빈 오류 화면만 뜬다.
function onUploadError(err, _req, res, next) {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: '엑셀이 30MB를 넘습니다. 사진이 박힌 원본 대신, 사진을 지운 사본으로 올려 주세요. 사진은 따로 넣습니다.',
    });
  }
  return next(err);
}
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// 머리글 → 칸. 관리대장에 적힌 말과 화면에 보이는 말을 모두 받는다.
const HEADERS = {
  자산번호: 'assetNo',
  관리번호: 'assetNo',
  유형: 'assetType',
  장비구분: 'category',
  분류: 'category',
  자산명: 'name',
  장비명: 'name',
  차종: 'category',
  모델: 'modelName',
  규격: 'modelName',
  품명: 'modelName',
  제조사: 'manufacturer',
  차대번호: 'serialNo',
  제조번호: 'serialNo',
  소유자: 'ownerDept',
  현재위치: 'location',
  사용현장: 'location',
  위치: 'location',
  상태: 'status',
  차량NO: 'plateNo',
  차량번호: 'plateNo',
  연식: 'yearModel',
  검사유효기간: 'inspectionNext',
  보험만기일: 'insuranceEnd',
  보험사: 'insuranceCompany',
  구입일: 'acquiredAt',
  등록일: 'acquiredAt',
  비고: 'memo',
};

const TITLES = [
  '자산번호',
  '유형',
  '분류',
  '자산명',
  '모델',
  '제조사',
  '차대번호',
  '차량번호',
  '연식',
  '소유자',
  '현재위치',
  '상태',
  '검사유효기간',
  '보험만기일',
  '보험사',
  '구입일',
  '비고',
];

const NOTES = [
  '자산번호 — 쓰시는 관리번호를 그대로 적으세요 (예: TP001 · EX46_01 · FL08-02).',
  '           관리번호가 없는 차량은 차량번호를 적으시면 그것이 자산번호가 됩니다.',
  '유형 — 「차량」 또는 「장비」. 비우면 차량번호가 있으면 차량, 없으면 장비로 봅니다.',
  '분류 — 집게차 · 암롤트럭 · 굴착기 · 지게차 · 어테치처럼 쓰시는 말 그대로 적으세요.',
  '날짜 — 2026-01-09 처럼 적으세요.',
  '상태 — 가용 · 사용중 · 정비중 · 유휴 · 매각 · 폐기 · 분실 중 하나. 비우면 「가용」입니다.',
  '',
  '같은 자산번호가 이미 있으면 고치고, 없으면 새로 만듭니다. 두 번 올려도 늘어나지 않습니다.',
  '모르는 열은 건너뜁니다 — 관리대장을 그대로 올리셔도 됩니다.',
];

const STATUSES = ['가용', '사용중', '정비중', '유휴', '매각', '폐기', '분실'];

// 번호판 모양 — 002마7872 · 경기04모8748 · 84됤4888
const PLATE = /^[가-힣]{0,2}\d{2,3}[가-힣]\d{4}$/;

// 어테치내역은 굴착기·지게차의 차량번호를 따로 적지 않고
// 품명 칸에 「DX350LC-7 /002마7872」처럼 붙여 적는다.
// 같은 장비가 차량 시트에도 있으므로 여기서 번호를 떼어 두어야 두 건으로 갈라지지 않는다.
function splitPlate(modelName) {
  if (!modelName || !String(modelName).includes('/')) return { modelName, plateNo: null };
  const parts = String(modelName).split('/');
  const tail = parts.pop().replace(/\s/g, '');
  if (!PLATE.test(tail)) return { modelName, plateNo: null };
  return { modelName: parts.join('/').trim() || null, plateNo: tail };
}

// 엑셀 날짜는 글자일 수도 날짜 값일 수도 있다. 둘 다 받는다.
function readDate(cell) {
  if (cell == null) return null;
  if (cell instanceof Date) return cell;
  const t = String(cell).trim();
  if (!t) return null;
  const iso = toISO(t.replace(/[.]/g, '-').replace(/\s/g, ''));
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

router.get('/template', async (_req, res) => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('자산');
  sheet.addRow(TITLES);
  sheet.getRow(1).font = { bold: true };
  TITLES.forEach((t, i) => {
    sheet.getColumn(i + 1).width = Math.max(12, t.length * 2 + 6);
  });
  const guide = wb.addWorksheet('작성안내');
  NOTES.forEach((n) => guide.addRow([n]));
  guide.getColumn(1).width = 100;
  const buffer = await wb.xlsx.writeBuffer();
  res.setHeader('Content-Type', XLSX_TYPE);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="asset-template.xlsx"; filename*=UTF-8''${encodeURIComponent('자산등록양식.xlsx')}`,
  );
  res.send(Buffer.from(buffer));
});

// 올리기 전에 어떤 시트가 있는지 본다 — 화면에서 고르시게 한다.
router.post('/sheets', upload.single('file'), onUploadError, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '엑셀 파일이 필요합니다.' });
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(req.file.buffer);
  } catch {
    return res.status(400).json({ error: '엑셀 파일을 읽지 못했습니다. .xlsx 형식인지 확인하세요.' });
  }
  const HISTORY_MARKS = ['수리일', '상차일자', '하차일자', '고장내용', '수리내용', '이동사유', '완료일'];
  const sheets = wb.worksheets.map((sheet) => {
    let headerRow = 0;
    let history = 0;
    for (let r = 1; r <= Math.min(sheet.rowCount, 10); r += 1) {
      let asset = 0;
      sheet.getRow(r).eachCell({ includeEmpty: false }, (cell) => {
        const raw = String(cell.text ?? '').replace(/\s+/g, '').replace(/\*$/, '');
        if (!raw) return;
        if (HISTORY_MARKS.includes(raw)) history += 1;
        if (HEADERS[raw] === 'assetNo' || HEADERS[raw] === 'plateNo') asset += 1;
      });
      if (!headerRow && asset) headerRow = r;
    }
    return { name: sheet.name, rows: Math.max(0, sheet.rowCount - headerRow), readable: headerRow > 0, history: history >= 2 };
  });
  res.json({ sheets });
});

router.post('/bulk-upload', upload.single('file'), onUploadError, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '엑셀 파일이 필요합니다.' });

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(req.file.buffer);
  } catch {
    return res.status(400).json({ error: '엑셀 파일을 읽지 못했습니다. .xlsx 형식인지 확인하세요.' });
  }

  // 시트를 지정하면 그 시트만, 아니면 읽을 수 있는 시트를 모두 읽는다 —
  // 관리대장은 시트가 여럿이라 한 번에 올리시게 한다.
  // sheets로 고른 시트만, 없으면 읽을 수 있는 시트를 모두 읽는다.
  // 관리대장에는 과거분·제출용 시트도 있어 골라 올리시는 편이 깔끔하다.
  const picked = String(req.body?.sheets ?? req.body?.sheetName ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const wanted = picked.length ? picked.map((n) => wb.getWorksheet(n)).filter(Boolean) : wb.worksheets;
  if (wanted.length === 0) return res.status(400).json({ error: '시트를 찾지 못했습니다.' });

  // 이력 시트는 자산 목록이 아니다. 관리대장에는 이동내역·검사수리내역처럼
  // 차량번호가 적힌 이력 시트가 섞여 있어, 그대로 읽으면 없는 자산이 생긴다.
  const HISTORY_MARKS = ['수리일', '상차일자', '하차일자', '고장내용', '수리내용', '이동사유', '완료일'];
  const looksHistory = (sheet) => {
    for (let r = 1; r <= Math.min(sheet.rowCount, 10); r += 1) {
      let hit = 0;
      sheet.getRow(r).eachCell({ includeEmpty: false }, (cell) => {
        const raw = String(cell.text ?? '').replace(/\s+/g, '');
        if (HISTORY_MARKS.includes(raw)) hit += 1;
      });
      if (hit >= 2) return true;
    }
    return false;
  };

  // 시트마다 머리글 줄을 찾는다. 1행이 아닐 수 있다(관리대장은 4행).
  const plans = [];
  const skippedSheets = [];
  for (const sheet of wanted) {
    // 시트를 콕 집어 주셨으면 그대로 읽는다.
    if (!picked.length && looksHistory(sheet)) {
      skippedSheets.push(sheet.name);
      continue;
    }
    let headerRow = 0;
    const columns = [];
    const unknown = [];
    for (let r = 1; r <= Math.min(sheet.rowCount, 10); r += 1) {
      const found = [];
      sheet.getRow(r).eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const raw = String(cell.text ?? '').replace(/\s+/g, '').replace(/\*$/, '');
        if (raw && HEADERS[raw]) found.push({ colNumber, key: HEADERS[raw] });
      });
      // 관리번호가 없는 시트도 있다 — 그때는 차량번호가 자산번호가 된다(결정-5 ②).
      if (found.some((c) => c.key === 'assetNo' || c.key === 'plateNo') && found.length >= 3) {
        headerRow = r;
        columns.push(...found);
        sheet.getRow(r).eachCell({ includeEmpty: false }, (cell) => {
          const raw = String(cell.text ?? '').replace(/\s+/g, '').replace(/\*$/, '');
          if (raw && !HEADERS[raw]) unknown.push(String(cell.text).trim());
        });
        break;
      }
    }
    if (headerRow) plans.push({ sheet, headerRow, columns, unknown, hasAssetNo: columns.some((c) => c.key === 'assetNo') });
  }
  if (plans.length === 0) {
    return res.status(400).json({ error: '머리글 줄에 「자산번호」·「관리번호」·「차량번호」 중 하나는 있어야 합니다.' });
  }
  // 관리번호를 적어 둔 시트를 먼저 넣는다. 그 시트가 장비 이름을 제대로 적어 두었고,
  // 뒤에 오는 차량 시트는 같은 장비에 보험·검사 날짜만 채운다.
  plans.sort((a, b) => Number(b.hasAssetNo) - Number(a.hasAssetNo));

  let added = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];
  // 차량번호로 알아보고 한 건으로 합친 것 — 몇 건을 합쳤는지 알려 드린다.
  const merged = [];

  const perSheet = [];

  for (const plan of plans) {
   const { sheet, headerRow, columns, unknown } = plan;
   const before = { added, updated, merged: merged.length, skipped };

   for (let r = headerRow + 1; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);
    const d = {};
    for (const c of columns) {
      const cell = row.getCell(c.colNumber);
      const text = String(cell.text ?? '').trim();
      if (text) d[c.key] = c.key.endsWith('At') || c.key.endsWith('Next') || c.key.endsWith('End') ? cell.value : text;
    }
    // 관리번호가 없으면 차량번호를 자산번호로 쓴다(결정-5 ②).
    const assetNo = (d.assetNo ?? d.plateNo ?? '').toString().trim();
    if (!assetNo) {
      // 줄에 무언가 적혀 있는데 번호가 없으면 조용히 버리지 않고 세어 알린다.
      if (Object.keys(d).length) skipped += 1;
      continue;
    }
    const name = (d.name ?? d.modelName ?? assetNo).toString().trim();

    // 품명에 붙어 있는 차량번호를 떼어 둔다.
    const split = splitPlate(d.modelName);
    d.modelName = split.modelName;
    if (!d.plateNo && split.plateNo) d.plateNo = split.plateNo;

    const assetType = d.assetType === '차량' ? 'VEHICLE' : d.assetType === '장비' ? 'EQUIPMENT' : d.plateNo ? 'VEHICLE' : 'EQUIPMENT';
    const status = STATUSES.includes(d.status) ? d.status : '가용';

    const base = {
      assetNo,
      assetType,
      name,
      category: d.category ?? null,
      modelName: d.modelName ?? null,
      manufacturer: d.manufacturer ?? null,
      serialNo: d.serialNo ?? null,
      ownerDept: d.ownerDept ?? null,
      location: d.location ?? null,
      status,
      acquiredAt: readDate(d.acquiredAt),
      memo: d.memo ?? null,
      isCompanyAsset: true,
    };
    const vehicle = {
      plateNo: d.plateNo ?? null,
      vin: d.serialNo ?? null,
      yearModel: d.yearModel ? String(d.yearModel) : null,
      insuranceCompany: d.insuranceCompany ?? null,
      insuranceEnd: readDate(d.insuranceEnd),
      inspectionNext: readDate(d.inspectionNext),
    };

    try {
      // 자산번호로 먼저 찾고, 없으면 차량번호로 찾는다.
      // 관리대장은 같은 굴착기를 차량 시트에서는 차량번호로, 어테치내역에서는 관리번호로
      // 부른다. 차량번호로 한 번 더 보지 않으면 한 장비가 두 건으로 들어간다.
      const KEEP = ['assetNo', 'name', 'category', 'modelName', 'manufacturer', 'serialNo', 'ownerDept', 'location', 'memo'];
      let existing = await prisma.asset.findUnique({ where: { assetNo }, select: { id: true } });
      let joined = null;
      if (!existing && vehicle.plateNo) {
        const byPlate = await prisma.assetVehicle.findFirst({
          where: { plateNo: vehicle.plateNo },
          select: { assetId: true, asset: { select: { id: true, assetNo: true, name: true, category: true, modelName: true, manufacturer: true, serialNo: true, ownerDept: true, location: true, memo: true } } },
        });
        if (byPlate?.asset) {
          existing = { id: byPlate.assetId };
          joined = byPlate.asset;
          merged.push({ 차량번호: vehicle.plateNo, 이미있던자산번호: joined.assetNo, 이번시트: assetNo });
        }
      }
      if (existing) {
        // 차량번호로 합친 것은 빈 칸만 채운다.
        // 관리번호 시트가 이름을 잘 적어 둔 쪽이라 덮어쓰면 「350 굴착기」가 「46톤」이 된다.
        const data = { ...base };
        if (joined) for (const k of KEEP) { const cur = joined[k]; if (cur != null && String(cur).trim() !== '') delete data[k]; }
        await prisma.asset.update({ where: { id: existing.id }, data });
        if (assetType === 'VEHICLE') {
          await prisma.assetVehicle.upsert({
            where: { assetId: existing.id },
            update: vehicle,
            create: { assetId: existing.id, ...vehicle },
          });
        }
        updated += 1;
      } else {
        const created = await prisma.asset.create({ data: base });
        if (assetType === 'VEHICLE') {
          await prisma.assetVehicle.create({ data: { assetId: created.id, ...vehicle } });
        } else {
          await prisma.assetEquipment.create({ data: { assetId: created.id, spec: d.modelName ?? null } });
        }
        added += 1;
      }
    } catch (err) {
      errors.push({ 행: r, 자산번호: assetNo, 사유: err.message?.split('\n').pop() || '저장 실패' });
    }
   }

   perSheet.push({
     시트: sheet.name,
     머리글행: headerRow,
     추가: added - before.added,
     수정: updated - before.updated,
     합침: merged.length - before.merged,
     건너뜀: skipped - before.skipped,
     모르는열: [...new Set(unknown)],
   });
  }

  res.json({
    시트수: perSheet.length,
    추가: added,
    수정: updated,
    합친것: merged,
    번호없어건너뜀: skipped,
    오류: errors,
    시트별: perSheet,
    건너뛴시트: skippedSheets,
  });
});

export default router;
