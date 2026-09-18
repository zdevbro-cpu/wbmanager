// 목록 화면(입고/폐기물입고/출고/폐기물반출) 엑셀 내보내기.
// 컬럼 구성은 화면 표와 같게 맞춰, 받은 파일이 화면과 다르게 보이지 않도록 한다.
import { prisma } from './prisma.js';
import { dayOf, getSettings, summarize } from './pricing.js';
import { buildWorkbook } from './ecountExport.js';

const day = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '');
const num = (v) => (v == null ? '' : Number(v));

function dateRange(from, to) {
  const range = {};
  if (from) range.gte = new Date(from);
  if (to) range.lte = new Date(`${to}T23:59:59`);
  return Object.keys(range).length ? range : null;
}

// 화면 필터(기간·프로젝트·차종·차량·운전자·품목)를 그대로 받는다.
function commonWhere({ projectId, vehicleType, vehicleNo, driverName, itemCode }) {
  return {
    deletedAt: null,
    ...(projectId ? { projectId } : {}),
    ...(vehicleType ? { vehicleType } : {}),
    ...(vehicleNo ? { vehicleNo } : {}),
    ...(driverName ? { driverName } : {}),
    ...(itemCode ? { itemCode } : {}),
  };
}

// 폐기물 화면에만 있는 필터 — 올바로/배출자/운반자/처리자. 자유 입력은 부분 일치로 찾는다.
const like = (v) => ({ contains: v, mode: 'insensitive' });

function wasteInboundWhere({ olbaro, dischargerName, transporterName, processorName }) {
  return {
    ...(olbaro ? { olbaroReported: olbaro === 'O' } : {}),
    ...(dischargerName ? { dischargerName: like(dischargerName) } : {}),
    ...(transporterName ? { transporterName: like(transporterName) } : {}),
    ...(processorName ? { processorName: like(processorName) } : {}),
  };
}

// 반출의 처리자는 거래처 마스터(buyer)다.
function wasteOutboundWhere({ olbaro, dischargerName, transporterName, processorName }) {
  return {
    ...(olbaro ? { olbaroReported: olbaro === 'O' } : {}),
    ...(dischargerName ? { dischargerName: like(dischargerName) } : {}),
    ...(transporterName ? { transporterName: like(transporterName) } : {}),
    ...(processorName ? { buyer: { name: like(processorName) } } : {}),
  };
}

const INBOUND_COLUMNS = [
  { header: '상차일', key: 'inboundDate', width: 12 },
  { header: '프로젝트명', key: 'projectName', width: 22 },
  { header: '하차지', key: 'unloadingPoint', width: 14 },
  { header: '차종', key: 'vehicleType', width: 10 },
  { header: '차량번호', key: 'vehicleNo', width: 12 },
  { header: '운전자', key: 'driverName', width: 10 },
  { header: '연락처', key: 'driverPhone', width: 14 },
  { header: '제품명', key: 'itemName', width: 16 },
  { header: '총중량(kg)', key: 'grossWeight', width: 12 },
  { header: '공차중량(kg)', key: 'tareWeight', width: 12 },
  { header: '감량(kg)', key: 'lossWeight', width: 10 },
  { header: '입고량(kg)', key: 'netWeight', width: 12 },
  { header: '재고반영중량(kg)', key: 'stockWeight', width: 14 },
  { header: '비고', key: 'memo', width: 20 },
];

const WASTE_INBOUND_COLUMNS = [
  { header: '인수일', key: 'receiveDate', width: 12 },
  { header: '인계일', key: 'handoverDate', width: 12 },
  { header: '올바로', key: 'olbaro', width: 8 },
  { header: '프로젝트명', key: 'projectName', width: 22 },
  { header: '배출자', key: 'dischargerName', width: 16 },
  { header: '하차지', key: 'unloadingPoint', width: 14 },
  { header: '차종', key: 'vehicleType', width: 10 },
  { header: '차량번호', key: 'vehicleNo', width: 12 },
  { header: '운전자', key: 'driverName', width: 10 },
  { header: '연락처', key: 'driverPhone', width: 14 },
  { header: '제품명', key: 'itemName', width: 16 },
  { header: '총중량(kg)', key: 'grossWeight', width: 12 },
  { header: '공차중량(kg)', key: 'tareWeight', width: 12 },
  { header: '감량(kg)', key: 'lossWeight', width: 10 },
  { header: '입고량(kg)', key: 'netWeight', width: 12 },
  { header: '비고', key: 'memo', width: 20 },
];

const OUTBOUND_COLUMNS = [
  { header: '계량일', key: 'outboundDate', width: 12 },
  { header: '프로젝트명', key: 'projectName', width: 22 },
  { header: '상차지', key: 'loadingPoint', width: 12 },
  { header: '차종', key: 'vehicleType', width: 10 },
  { header: '차량번호', key: 'vehicleNo', width: 12 },
  { header: '운전자', key: 'driverName', width: 10 },
  { header: '연락처', key: 'driverPhone', width: 14 },
  { header: '거래처명', key: 'vendorName', width: 18 },
  { header: '제품명', key: 'itemName', width: 16 },
  { header: '공차중량(kg)', key: 'tareWeight', width: 12 },
  { header: '총중량(kg)', key: 'grossWeight', width: 12 },
  { header: '실중량(kg)', key: 'actualWeight', width: 12 },
  { header: '거래처 감량 전 실중량(kg)', key: 'preLossWeight', width: 20 },
  { header: '감량(kg)', key: 'lossWeight', width: 10 },
  { header: '정산중량(kg)', key: 'settledWeight', width: 12 },
  { header: '재고반영중량(kg)', key: 'stockWeight', width: 14 },
  { header: '단가(원)', key: 'unitPrice', width: 12 },
  { header: '공급가액(원)', key: 'amount', width: 14 },
  { header: '부가세(원)', key: 'vatAmount', width: 12 },
  { header: '구분', key: 'category', width: 10 },
  { header: '직출', key: 'subsidiary', width: 10 },
  { header: '계산서발행', key: 'taxInvoice', width: 10 },
  { header: '입금일', key: 'paidDate', width: 12 },
  { header: '비고', key: 'memo', width: 20 },
];

const WASTE_OUTBOUND_COLUMNS = [
  { header: '상차일', key: 'outboundDate', width: 12 },
  { header: '인계일', key: 'handoverDate', width: 12 },
  { header: '올바로', key: 'olbaro', width: 8 },
  { header: '프로젝트명', key: 'projectName', width: 22 },
  { header: '배출자', key: 'dischargerName', width: 16 },
  { header: '운반자', key: 'transporterName', width: 14 },
  { header: '상차지', key: 'loadingPoint', width: 12 },
  { header: '차종', key: 'vehicleType', width: 10 },
  { header: '차량번호', key: 'vehicleNo', width: 12 },
  { header: '운전자', key: 'driverName', width: 10 },
  { header: '연락처', key: 'driverPhone', width: 14 },
  { header: '처리자', key: 'vendorName', width: 18 },
  { header: '제품명', key: 'itemName', width: 16 },
  { header: '공차중량(kg)', key: 'tareWeight', width: 12 },
  { header: '총중량(kg)', key: 'grossWeight', width: 12 },
  { header: '실중량(kg)', key: 'actualWeight', width: 12 },
  { header: '거래처 감량 전 실중량(kg)', key: 'preLossWeight', width: 20 },
  { header: '감량(kg)', key: 'lossWeight', width: 10 },
  { header: '정산중량(kg)', key: 'settledWeight', width: 12 },
  { header: '루베적용', key: 'cubicMeter', width: 10 },
  { header: '단가(원)', key: 'unitPrice', width: 12 },
  { header: '금액(원)', key: 'amount', width: 14 },
  { header: '구분', key: 'category', width: 10 },
  { header: '직출', key: 'subsidiary', width: 10 },
  { header: '이체일', key: 'transferDate', width: 12 },
  { header: '비고', key: 'memo', width: 20 },
];

const BUILDERS = {
  inbound: {
    sheetName: '입고현황',
    fileName: '입고현황',
    columns: INBOUND_COLUMNS,
    load: async (q) => {
      const range = dateRange(q.from, q.to);
      const rows = await prisma.inbound.findMany({
        where: { ...commonWhere(q), ...(range ? { inboundDate: range } : {}) },
        include: { project: true, item: true },
        orderBy: { inboundDate: 'desc' },
      });
      return rows.map((r) => ({
        inboundDate: day(r.inboundDate),
        projectName: r.project?.roundName ?? '',
        unloadingPoint: r.unloadingPoint ?? '',
        vehicleType: r.vehicleType ?? '',
        vehicleNo: r.vehicleNo ?? '',
        driverName: r.driverName ?? '',
        driverPhone: r.driverPhone ?? '',
        itemName: r.item?.itemName ?? r.itemName ?? '',
        grossWeight: num(r.grossWeight),
        tareWeight: num(r.tareWeight),
        lossWeight: num(r.lossWeight),
        netWeight: num(r.netWeight),
        stockWeight: num(r.stockWeight),
        memo: r.memo ?? '',
      }));
    },
  },

  waste_inbound: {
    sheetName: '폐기물입고현황',
    fileName: '폐기물입고현황',
    columns: WASTE_INBOUND_COLUMNS,
    load: async (q) => {
      const range = dateRange(q.from, q.to);
      const rows = await prisma.wasteInbound.findMany({
        where: {
          ...commonWhere(q),
          ...wasteInboundWhere(q),
          ...(range ? { receiveDate: range } : {}),
          ...(q.unreported === 'true' ? { OR: [{ olbaroReported: false }, { handoverDate: null }] } : {}),
        },
        include: { project: true, item: true },
        orderBy: { receiveDate: 'desc' },
      });
      return rows.map((r) => ({
        receiveDate: day(r.receiveDate),
        handoverDate: day(r.handoverDate),
        olbaro: r.olbaroReported ? 'O' : 'X',
        projectName: r.project?.roundName ?? '',
        dischargerName: r.dischargerName ?? '',
        unloadingPoint: r.unloadingPoint ?? '',
        vehicleType: r.vehicleType ?? '',
        vehicleNo: r.vehicleNo ?? '',
        driverName: r.driverName ?? '',
        driverPhone: r.driverPhone ?? '',
        itemName: r.item?.itemName ?? r.itemName ?? '',
        grossWeight: num(r.grossWeight),
        tareWeight: num(r.tareWeight),
        lossWeight: num(r.lossWeight),
        netWeight: num(r.netWeight),
        memo: r.memo ?? '',
      }));
    },
  },

  outbound_sale: {
    sheetName: '출고현황',
    fileName: '출고현황',
    columns: OUTBOUND_COLUMNS,
    load: async (q) => {
      const range = dateRange(q.from, q.to);
      const rows = await prisma.outboundSale.findMany({
        where: { ...commonWhere(q), ...(range ? { outboundDate: range } : {}) },
        include: { project: true, item: true, buyer: true },
        orderBy: { outboundDate: 'desc' },
      });
      return rows.map((r) => ({
        outboundDate: day(r.outboundDate),
        projectName: r.project?.roundName ?? '',
        loadingPoint: r.loadingPoint ?? '',
        vehicleType: r.vehicleType ?? '',
        vehicleNo: r.vehicleNo ?? '',
        driverName: r.driverName ?? '',
        driverPhone: r.driverPhone ?? '',
        vendorName: r.buyer?.name ?? '',
        itemName: r.item?.itemName ?? '',
        tareWeight: num(r.tareWeight),
        grossWeight: num(r.grossWeight),
        actualWeight: num(r.actualWeight),
        preLossWeight: num(r.preLossWeight),
        lossWeight: num(r.lossWeight),
        settledWeight: num(r.settledWeight),
        stockWeight: num(r.stockWeight),
        unitPrice: num(r.unitPrice),
        amount: num(r.amount),
        vatAmount: num(r.vatAmount),
        category: r.category ?? '',
        subsidiary: r.isSubsidiary ? 'O' : '',
        taxInvoice: r.taxInvoiceIssued ? 'O' : '',
        paidDate: day(r.paidDate),
        memo: r.memo ?? '',
      }));
    },
  },

  waste_outbound: {
    sheetName: '폐기물반출현황',
    fileName: '폐기물반출현황',
    columns: WASTE_OUTBOUND_COLUMNS,
    load: async (q) => {
      const range = dateRange(q.from, q.to);
      const rows = await prisma.wasteOutbound.findMany({
        where: {
          ...commonWhere(q),
          ...wasteOutboundWhere(q),
          ...(range ? { outboundDate: range } : {}),
          ...(q.unreported === 'true' ? { OR: [{ olbaroReported: false }, { handoverDate: null }] } : {}),
        },
        include: { project: true, item: true, buyer: true },
        orderBy: { outboundDate: 'desc' },
      });
      return rows.map((r) => ({
        outboundDate: day(r.outboundDate),
        handoverDate: day(r.handoverDate),
        olbaro: r.olbaroReported ? 'O' : 'X',
        projectName: r.project?.roundName ?? '',
        dischargerName: r.dischargerName ?? '',
        transporterName: r.transporterName ?? '',
        loadingPoint: r.loadingPoint ?? '',
        vehicleType: r.vehicleType ?? '',
        vehicleNo: r.vehicleNo ?? '',
        driverName: r.driverName ?? '',
        driverPhone: r.driverPhone ?? '',
        vendorName: r.buyer?.name ?? '',
        itemName: r.item?.itemName ?? r.itemName ?? '',
        tareWeight: num(r.tareWeight),
        grossWeight: num(r.grossWeight),
        actualWeight: num(r.actualWeight),
        preLossWeight: num(r.preLossWeight),
        lossWeight: num(r.lossWeight),
        settledWeight: num(r.weight),
        cubicMeter: num(r.cubicMeter),
        unitPrice: num(r.unitPrice),
        amount: num(r.amount),
        category: r.category ?? '',
        subsidiary: r.isSubsidiary ? 'O' : '',
        transferDate: day(r.transferDate),
        memo: r.memo ?? '',
      }));
    },
  },

  // 최신단가(PRC-01) — 화면에 걸린 필터를 그대로 받아 같은 줄을 내려받는다.
  prices: {
    sheetName: '최신단가',
    fileName: '최신단가',
    columns: [
      { header: '업체', key: 'vendorName', width: 18 },
      { header: '품목', key: 'vendorItemName', width: 20 },
      { header: '계열', key: 'series', width: 12 },
      { header: '최신단가(원)', key: 'price', width: 14 },
      { header: '구분', key: 'priceType', width: 8 },
      { header: '적용일', key: 'effectiveDate', width: 12 },
      { header: '이전단가(원)', key: 'prevPrice', width: 14 },
      { header: '변동(원)', key: 'delta', width: 12 },
      { header: '변동률(%)', key: 'deltaRate', width: 12 },
      { header: '최근 실거래일', key: 'lastRealDate', width: 14 },
      { header: '경과일', key: 'days', width: 10 },
      { header: '상태', key: 'warn', width: 12 },
    ],
    async load(query) {
      const settings = await getSettings();
      const asOf = query.asOf ? dayOf(query.asOf) : dayOf(new Date());
      const items = await prisma.vendorItem.findMany({
        where: {
          ...(query.series ? { series: query.series } : {}),
          ...(query.vendorId ? { vendorId: query.vendorId } : {}),
          ...(query.q
            ? {
                OR: [
                  { vendorItemName: { contains: query.q, mode: 'insensitive' } },
                  { vendor: { name: { contains: query.q, mode: 'insensitive' } } },
                ],
              }
            : {}),
        },
        include: { vendor: { select: { name: true } } },
      });
      const prices = await prisma.vendorPrice.findMany({
        where: { deletedAt: null, effectiveDate: { lte: new Date(`${asOf}T23:59:59.999Z`) } },
        orderBy: { effectiveDate: 'asc' },
      });
      const rows = items.map((item) => {
        const sum = summarize(
          prices.filter((p) => p.vendorItemId === item.id),
          asOf,
          settings,
        );
        return {
          vendorName: item.vendor.name,
          vendorItemName: item.vendorItemName,
          series: item.series ?? '',
          price: sum ? (sum.latest.isFree ? '무상' : sum.latest.price) : '',
          priceType: sum?.latest.priceType ?? '',
          effectiveDate: sum?.latest.date ?? '',
          prevPrice: sum?.prev?.price ?? '',
          delta: sum?.delta ?? '',
          deltaRate: sum?.deltaRate ?? '',
          lastRealDate: sum?.lastRealDate ?? '',
          days: sum?.warn.days ?? '',
          warn: sum?.warn.label ?? '거래 없음',
        };
      });
      const wanted = query.priceType;
      return (wanted ? rows.filter((r) => r.priceType === wanted) : rows).sort((a, b) =>
        a.vendorName === b.vendorName
          ? a.vendorItemName.localeCompare(b.vendorItemName, 'ko')
          : a.vendorName.localeCompare(b.vendorName, 'ko'),
      );
    },
  },
};

export function isExportType(type) {
  return Object.hasOwn(BUILDERS, type);
}

export async function buildListWorkbook(type, query) {
  const spec = BUILDERS[type];
  const rows = await spec.load(query);
  const project = query.projectId
    ? await prisma.project.findUnique({ where: { id: query.projectId } })
    : null;

  const wb = await buildWorkbook({
    sheetName: spec.sheetName,
    columns: spec.columns,
    rows,
    filters: { from: query.from, to: query.to, projectName: project?.roundName ?? null },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return { wb, fileName: `${spec.fileName}_${stamp}.xlsx`, count: rows.length };
}
