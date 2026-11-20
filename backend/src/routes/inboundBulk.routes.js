import { Router } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma.js';
import { toISO } from '../lib/date.js';
import { postInboundLedger } from '../lib/ledger.js';
import { syncTransport } from '../lib/transportSync.js';

// 입고 엑셀 일괄 등록 (요청 2026-11-13)
//
// 한 건씩 적기 어려운 날이 있고, 나중에 계근프로그램이 뽑아 주는 내역도
// 이 길로 올리게 된다. 지금은 저희가 드리는 양식을 쓴다.
//
// 자산 일괄등록과 같은 방식이다 — 양식을 받아 채워 올리면 한 번에 들어간다.

const router = Router();
const MAX_UPLOAD = 20 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD } });
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function onUploadError(err, _req, res, next) {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: '엑셀이 20MB를 넘습니다. 나눠서 올려 주세요.' });
  }
  return next(err);
}

// 머리글 → 칸. 화면에 보이는 말 그대로 적으면 된다(띄어쓰기는 무시).
const HEADERS = {
  현장: 'projectName',
  프로젝트: 'projectName',
  상차일: 'inboundDate',
  입고일: 'inboundDate',
  상차지: 'loadingPoint',
  하차지: 'unloadingPoint',
  차량번호: 'vehicleNo',
  차종: 'vehicleType',
  운전자: 'driverName',
  연락처: 'driverPhone',
  제품명: 'itemName',
  품목: 'itemName',
  품목코드: 'itemCode',
  총중량: 'grossWeight',
  공차중량: 'tareWeight',
  감량: 'lossWeight',
  'C/T': 'ct',
  단가: 'unitPrice',
  운반비: 'transportCost',
  운반비세액: 'transportTax',
  비고: 'memo',
};

const TITLES = [
  '현장', '상차일', '상차지', '하차지', '차량번호', '차종', '운전자', '연락처',
  '제품명', '총중량', '공차중량', '감량', 'C/T', '단가', '운반비', '운반비세액', '비고',
];

const NOTES = [
  '현장 — 등록된 프로젝트 이름을 그대로 적으세요. 이름이 맞지 않으면 그 줄은 들어가지 않습니다.',
  '상차일 — 2026-11-20 처럼 적으세요.',
  '제품명 — 품목 마스터의 이름과 같게 적으세요. 비우면 미분류로 들어갑니다.',
  '총중량 · 공차중량 — 필수입니다. 입고량은 총중량 − 공차중량 − 감량으로 저희가 계산합니다.',
  'C/T · 단가 — 설비·펌프처럼 한 덩어리로 들어올 때 적으세요. 비워도 됩니다.',
  '운반비세액 — 비우면 운반비의 10%로 채웁니다.',
  '',
  '같은 줄을 두 번 올리면 두 건이 됩니다 — 올리기 전에 미리보기로 확인하세요.',
];

const num = (v) => {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/[,\s원]/g, ''));
  return Number.isFinite(n) ? n : null;
};

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
  const sheet = wb.addWorksheet('입고');
  sheet.addRow(TITLES);
  sheet.getRow(1).font = { bold: true };
  TITLES.forEach((t, i) => {
    sheet.getColumn(i + 1).width = Math.max(10, t.length * 2 + 6);
  });
  const guide = wb.addWorksheet('작성안내');
  NOTES.forEach((n) => guide.addRow([n]));
  guide.getColumn(1).width = 100;
  const buffer = await wb.xlsx.writeBuffer();
  res.setHeader('Content-Type', XLSX_TYPE);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="inbound-template.xlsx"; filename*=UTF-8''${encodeURIComponent('입고등록양식.xlsx')}`,
  );
  res.send(Buffer.from(buffer));
});

// 엑셀을 읽어 줄마다 무엇이 들어갈지 추린다. 저장은 하지 않는다.
async function parse(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) throw Object.assign(new Error('시트가 없습니다.'), { status: 400 });

  let headerRow = 0;
  const columns = [];
  for (let r = 1; r <= Math.min(sheet.rowCount, 10); r += 1) {
    const found = [];
    sheet.getRow(r).eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const raw = String(cell.text ?? '').replace(/\s+/g, '').replace(/\*$/, '');
      if (raw && HEADERS[raw]) found.push({ colNumber, key: HEADERS[raw] });
    });
    if (found.some((c) => c.key === 'grossWeight') && found.length >= 3) {
      headerRow = r;
      columns.push(...found);
      break;
    }
  }
  if (!headerRow) {
    throw Object.assign(new Error('머리글 줄에 「총중량」이 있어야 합니다. 양식을 받아 쓰세요.'), { status: 400 });
  }

  const [projects, items] = await Promise.all([
    prisma.project.findMany({ select: { id: true, roundName: true } }),
    prisma.itemMaster.findMany({ select: { itemCode: true, itemName: true } }),
  ]);
  const byProject = new Map(projects.map((p) => [p.roundName.replace(/\s+/g, ''), p.id]));
  const byItemName = new Map(items.map((i) => [i.itemName.replace(/\s+/g, ''), i.itemCode]));
  const itemCodes = new Set(items.map((i) => i.itemCode));

  const ok = [];
  const bad = [];
  for (let r = headerRow + 1; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);
    const d = {};
    for (const c of columns) {
      const cell = row.getCell(c.colNumber);
      const text = String(cell.text ?? '').trim();
      if (text) d[c.key] = c.key === 'inboundDate' ? cell.value : text;
    }
    if (Object.keys(d).length === 0) continue;

    const projectId = d.projectName ? byProject.get(String(d.projectName).replace(/\s+/g, '')) : null;
    const inboundDate = readDate(d.inboundDate);
    const gross = num(d.grossWeight);
    const tare = num(d.tareWeight);
    const loss = num(d.lossWeight) ?? 0;

    const why = [];
    if (!projectId) why.push(`현장 '${d.projectName ?? ''}'을(를) 찾지 못했습니다`);
    if (!inboundDate) why.push('상차일이 없거나 읽히지 않습니다');
    if (gross == null || tare == null) why.push('총중량 또는 공차중량이 없습니다');
    else if (gross < tare) why.push('총중량이 공차중량보다 작습니다');

    if (why.length) {
      bad.push({ 행: r, 사유: why.join(' · ') });
      continue;
    }

    const itemCode =
      (d.itemCode && itemCodes.has(d.itemCode) ? d.itemCode : null) ??
      (d.itemName ? byItemName.get(String(d.itemName).replace(/\s+/g, '')) : null) ??
      null;

    ok.push({
      행: r,
      projectId,
      projectName: d.projectName ?? null,
      inboundDate,
      loadingPoint: d.loadingPoint ?? null,
      unloadingPoint: d.unloadingPoint ?? null,
      vehicleNo: d.vehicleNo ?? null,
      vehicleType: d.vehicleType ?? null,
      driverName: d.driverName ?? null,
      driverPhone: d.driverPhone ?? null,
      itemCode,
      itemName: d.itemName ?? null,
      grossWeight: gross,
      tareWeight: tare,
      lossWeight: loss,
      netWeight: gross - tare - loss,
      ct: d.ct ?? null,
      unitPrice: num(d.unitPrice),
      transportCost: num(d.transportCost),
      transportTax: num(d.transportTax),
      memo: d.memo ?? null,
    });
  }
  return { ok, bad, headerRow };
}

router.post('/bulk-preview', upload.single('file'), onUploadError, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '엑셀 파일이 필요합니다.' });
  try {
    const { ok, bad, headerRow } = await parse(req.file.buffer);
    res.json({ 머리글행: headerRow, 넣을것: ok.length, 못넣는것: bad.length, rows: ok.slice(0, 200), 오류: bad });
  } catch (e) {
    if (e?.status === 400) return res.status(400).json({ error: e.message });
    console.error('[inbound-bulk/preview]', e.message);
    res.status(500).json({ error: '엑셀을 읽지 못했습니다. .xlsx 형식인지 확인하세요.' });
  }
});

router.post('/bulk-upload', upload.single('file'), onUploadError, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '엑셀 파일이 필요합니다.' });
  try {
    const { ok, bad } = await parse(req.file.buffer);
    let added = 0;
    const failed = [];

    for (const r of ok) {
      try {
        await prisma.$transaction(async (tx) => {
          const created = await tx.inbound.create({
            data: {
              projectId: r.projectId,
              inboundDate: r.inboundDate,
              loadingPoint: r.loadingPoint,
              unloadingPoint: r.unloadingPoint,
              vehicleNo: r.vehicleNo,
              vehicleType: r.vehicleType,
              driverName: r.driverName,
              driverPhone: r.driverPhone,
              itemCode: r.itemCode,
              itemName: r.itemName,
              grossWeight: r.grossWeight,
              tareWeight: r.tareWeight,
              lossWeight: r.lossWeight,
              netWeight: r.netWeight,
              stockWeight: r.netWeight,
              ct: r.ct,
              unitPrice: r.unitPrice,
              transportCost: r.transportCost,
              transportTax: r.transportTax,
              memo: r.memo,
              createdById: req.appUser?.id ?? null,
            },
          });
          await postInboundLedger(
            {
              projectId: r.projectId,
              itemCode: r.itemCode,
              weight: r.netWeight,
              ledgerDate: r.inboundDate,
              refType: 'inbound',
              refId: created.id,
            },
            tx,
          );
          await syncTransport(tx, 'inboundId', created, {
            date: created.inboundDate,
            origin: created.loadingPoint,
            destination: created.unloadingPoint,
            weight: created.netWeight,
            cost: created.transportCost,
            tax: created.transportTax,
          });
        });
        added += 1;
      } catch (err) {
        failed.push({ 행: r.행, 사유: err.message?.split('\n').pop() || '저장 실패' });
      }
    }

    res.json({ 넣음: added, 못넣은것: [...bad, ...failed] });
  } catch (e) {
    if (e?.status === 400) return res.status(400).json({ error: e.message });
    console.error('[inbound-bulk/upload]', e.message);
    res.status(500).json({ error: '올리지 못했습니다.' });
  }
});

export default router;
