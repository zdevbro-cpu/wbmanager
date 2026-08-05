import ExcelJS from 'exceljs';
import { prisma } from './prisma.js';

// ecount 업로드용 표준 포맷 출력 (S-TOISQC)
// 컬럼 구성/순서는 ecount 구매입력·판매입력 화면과 동일하게 맞춘다.
// 근거: data/.../1. 이카운트, 엑셀 입출고 입력 방식/3. 입고(구매)입력.png, 6. 판매입력.png

const INBOUND_COLUMNS = [
  { header: '상차일', key: 'date', width: 12 },
  { header: '프로젝트명', key: 'projectName', width: 22 },
  { header: '차종', key: 'vehicleType', width: 10 },
  { header: '차량번호', key: 'vehicleNo', width: 14 },
  { header: '운전자', key: 'driverName', width: 10 },
  { header: '연락처', key: 'driverPhone', width: 15 },
  { header: '하차지', key: 'unloadingPoint', width: 16 },
  { header: '제품코드', key: 'itemCode', width: 12 },
  { header: '제품명', key: 'itemName', width: 18 },
  { header: '총중량(kg)', key: 'grossWeight', width: 12 },
  { header: '공차중량(kg)', key: 'tareWeight', width: 12 },
  { header: '감량(kg)', key: 'lossWeight', width: 10 },
  { header: '입고량(kg)', key: 'netWeight', width: 12 },
  { header: '재고반영중량(kg)', key: 'stockWeight', width: 15 },
  { header: '비고', key: 'memo', width: 30 },
];

const OUTBOUND_COLUMNS = [
  { header: '계량일', key: 'date', width: 12 },
  { header: '프로젝트명', key: 'projectName', width: 22 },
  { header: '차종', key: 'vehicleType', width: 10 },
  { header: '차량번호', key: 'vehicleNo', width: 14 },
  { header: '운전자', key: 'driverName', width: 10 },
  { header: '연락처', key: 'driverPhone', width: 15 },
  { header: '거래처', key: 'buyerName', width: 18 },
  { header: '상차지', key: 'loadingPoint', width: 14 },
  { header: '제품코드', key: 'itemCode', width: 12 },
  { header: '제품명', key: 'itemName', width: 18 },
  { header: '공차중량(kg)', key: 'tareWeight', width: 12 },
  { header: '총중량(kg)', key: 'grossWeight', width: 12 },
  { header: '실중량(kg)', key: 'actualWeight', width: 12 },
  { header: '재고반영중량(kg)', key: 'stockWeight', width: 15 },
  { header: '거래처 감량 전 실중량(kg)', key: 'preLossWeight', width: 20 },
  { header: '감량(kg)', key: 'lossWeight', width: 10 },
  { header: '정산 중량(kg)', key: 'settledWeight', width: 13 },
  { header: '단가', key: 'unitPrice', width: 12 },
  { header: '공급가액', key: 'amount', width: 15 },
  { header: '부가세', key: 'vatAmount', width: 13 },
  { header: '비고', key: 'memo', width: 30 },
];

function dateRange(from, to) {
  const range = {};
  if (from) range.gte = new Date(from);
  if (to) range.lte = new Date(to);
  return Object.keys(range).length ? range : undefined;
}

function num(v) {
  return v == null ? null : Number(v);
}

function ymd(d) {
  return d ? new Date(d).toISOString().slice(0, 10) : '';
}

export async function buildInboundRows({ from, to, projectId } = {}) {
  const range = dateRange(from, to);
  const inbounds = await prisma.inbound.findMany({
    where: {
      deletedAt: null,
      ...(projectId ? { projectId } : {}),
      ...(range ? { inboundDate: range } : {}),
    },
    include: { project: true, item: true },
    orderBy: { inboundDate: 'asc' },
  });

  return inbounds.map((r) => ({
    date: ymd(r.inboundDate),
    projectName: r.project?.roundName ?? '',
    vehicleType: r.vehicleType ?? '',
    vehicleNo: r.vehicleNo ?? '',
    driverName: r.driverName ?? '',
    driverPhone: r.driverPhone ?? '',
    unloadingPoint: r.unloadingPoint ?? '',
    itemCode: r.itemCode ?? '',
    itemName: r.item?.itemName ?? r.itemName ?? '',
    grossWeight: num(r.grossWeight),
    tareWeight: num(r.tareWeight),
    lossWeight: num(r.lossWeight),
    netWeight: num(r.netWeight),
    // 재고반영중량 미기록 건은 입고량으로 대체한다 (ecount 필수 항목이라 빈칸이면 업로드가 막힌다).
    stockWeight: num(r.stockWeight) ?? num(r.netWeight),
    memo: r.memo ?? '',
  }));
}

export async function buildOutboundRows({ from, to, projectId } = {}) {
  const range = dateRange(from, to);
  const outbounds = await prisma.outboundSale.findMany({
    where: {
      deletedAt: null,
      ...(projectId ? { projectId } : {}),
      ...(range ? { outboundDate: range } : {}),
    },
    include: { project: true, item: true, buyer: true },
    orderBy: { outboundDate: 'asc' },
  });

  return outbounds.map((r) => ({
    date: ymd(r.outboundDate),
    projectName: r.project?.roundName ?? '',
    vehicleType: r.vehicleType ?? '',
    vehicleNo: r.vehicleNo ?? '',
    driverName: r.driverName ?? '',
    driverPhone: r.driverPhone ?? '',
    buyerName: r.buyer?.name ?? '',
    loadingPoint: r.loadingPoint ?? '',
    itemCode: r.itemCode ?? '',
    itemName: r.item?.itemName ?? '',
    tareWeight: num(r.tareWeight),
    grossWeight: num(r.grossWeight),
    actualWeight: num(r.actualWeight),
    stockWeight: num(r.stockWeight) ?? num(r.settledWeight),
    preLossWeight: num(r.preLossWeight),
    lossWeight: num(r.lossWeight),
    settledWeight: num(r.settledWeight),
    unitPrice: num(r.unitPrice),
    amount: num(r.amount),
    vatAmount: num(r.vatAmount),
    memo: r.memo ?? '',
  }));
}

// 재고반영중량이 입고량/정산중량과 어긋나는 건은 ecount 업로드 시 거부되므로 미리 걸러낸다.
export function findWeightMismatches(rows, baseKey) {
  return rows.filter((r) => r.stockWeight != null && r[baseKey] != null && r.stockWeight !== r[baseKey]);
}

export async function buildWorkbook({ sheetName, columns, rows, filters }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'wbmanager';
  const ws = wb.addWorksheet(sheetName);

  // 재현성/감사를 위해 조회 조건과 생성 시각을 파일에 남긴다. (F-UFUSRW)
  const conditions = [
    filters.from || filters.to ? `기간: ${filters.from || '전체'} ~ ${filters.to || '전체'}` : '기간: 전체',
    `프로젝트: ${filters.projectName || '전체'}`,
    `생성: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`,
    `건수: ${rows.length}`,
  ].join('   |   ');
  ws.addRow([conditions]);
  ws.mergeCells(1, 1, 1, columns.length);
  ws.getRow(1).font = { size: 9, color: { argb: 'FF666666' } };
  ws.addRow([]);

  const headerRow = ws.addRow(columns.map((c) => c.header));
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
    cell.border = { bottom: { style: 'thin' } };
  });
  columns.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.width;
  });

  for (const row of rows) {
    ws.addRow(columns.map((c) => row[c.key] ?? ''));
  }

  return wb;
}

export { INBOUND_COLUMNS, OUTBOUND_COLUMNS };
