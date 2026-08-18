import { prisma } from './prisma.js';

// 입고·폐기물입고·출고·폐기물반출·선별을 하나의 통합 원장 형태로 정규화해서 반환한다.
// filters: { from, to, projectId, vendorId, itemCode, type }
export async function queryLedger(filters = {}) {
  const { from, to, projectId, vendorId, itemCode, type } = filters;

  const dateRange = {};
  if (from) dateRange.gte = new Date(from);
  if (to) dateRange.lte = new Date(to);

  const rows = [];

  if (!type || type === 'inbound') {
    const inbounds = await prisma.inbound.findMany({
      where: {
        deletedAt: null,
        ...(projectId ? { projectId } : {}),
        ...(itemCode ? { itemCode } : {}),
        ...(Object.keys(dateRange).length ? { inboundDate: dateRange } : {}),
      },
      include: { project: true, item: true, attachments: true },
      orderBy: { inboundDate: 'desc' },
    });
    rows.push(
      ...inbounds.map((r) => ({
        type: 'inbound',
        id: r.id,
        date: r.inboundDate,
        projectId: r.projectId,
        projectName: r.project?.roundName ?? null,
        siteName: r.project?.siteName ?? null,
        vendorId: null,
        vendorName: null,
        itemCode: r.itemCode,
        itemName: r.item?.itemName ?? r.itemName,
        weight: r.netWeight,
        amount: null,
        attachmentCount: r.attachments.length,
      })),
    );
  }

  if (!type || type === 'waste_inbound') {
    const wasteInbounds = await prisma.wasteInbound.findMany({
      where: {
        deletedAt: null,
        ...(projectId ? { projectId } : {}),
        ...(itemCode ? { itemCode } : {}),
        ...(Object.keys(dateRange).length ? { receiveDate: dateRange } : {}),
      },
      include: { project: true, item: true, attachments: true },
      orderBy: { receiveDate: 'desc' },
    });
    rows.push(
      ...wasteInbounds.map((r) => ({
        type: 'waste_inbound',
        id: r.id,
        date: r.receiveDate,
        projectId: r.projectId,
        projectName: r.project?.roundName ?? null,
        siteName: r.project?.siteName ?? null,
        vendorId: null,
        vendorName: null,
        itemCode: r.itemCode,
        itemName: r.item?.itemName ?? r.itemName,
        weight: r.netWeight,
        amount: null,
        attachmentCount: r.attachments.length,
      })),
    );
  }

  if (!type || type === 'sorting') {
    const sortings = await prisma.sorting.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(itemCode ? { itemCode } : {}),
        ...(Object.keys(dateRange).length ? { sortDate: dateRange } : {}),
      },
      include: { project: true, item: true },
      orderBy: { sortDate: 'desc' },
    });
    rows.push(
      ...sortings.map((r) => ({
        type: 'sorting',
        id: r.id,
        date: r.sortDate,
        projectId: r.projectId,
        projectName: r.project?.roundName ?? null,
        siteName: r.project?.siteName ?? null,
        vendorId: null,
        vendorName: null,
        itemCode: r.itemCode,
        itemName: r.item?.itemName ?? null,
        weight: r.sortWeight,
        amount: null,
        attachmentCount: 0,
      })),
    );
  }

  if (!type || type === 'outbound_sale') {
    const outbounds = await prisma.outboundSale.findMany({
      where: {
        deletedAt: null,
        ...(projectId ? { projectId } : {}),
        ...(vendorId ? { buyerId: vendorId } : {}),
        ...(itemCode ? { itemCode } : {}),
        ...(Object.keys(dateRange).length ? { outboundDate: dateRange } : {}),
      },
      include: { project: true, item: true, buyer: true, attachments: true },
      orderBy: { outboundDate: 'desc' },
    });
    rows.push(
      ...outbounds.map((r) => ({
        type: 'outbound_sale',
        id: r.id,
        date: r.outboundDate,
        projectId: r.projectId,
        projectName: r.project?.roundName ?? null,
        siteName: r.project?.siteName ?? null,
        vendorId: r.buyerId,
        vendorName: r.buyer?.name ?? null,
        itemCode: r.itemCode,
        itemName: r.item?.itemName ?? null,
        weight: r.settledWeight,
        actualWeight: r.actualWeight,
        amount: r.amount,
        paidDate: r.paidDate,
        memo: r.memo,
        attachmentCount: r.attachments.length,
      })),
    );
  }

  if (!type || type === 'waste_outbound') {
    const wasteOutbounds = await prisma.wasteOutbound.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(vendorId ? { buyerId: vendorId } : {}),
        ...(itemCode ? { itemCode } : {}),
        ...(Object.keys(dateRange).length ? { outboundDate: dateRange } : {}),
      },
      include: { project: true, item: true, buyer: true, attachments: true },
      orderBy: { outboundDate: 'desc' },
    });
    rows.push(
      ...wasteOutbounds.map((r) => ({
        type: 'waste_outbound',
        id: r.id,
        date: r.outboundDate,
        projectId: r.projectId,
        projectName: r.project?.roundName ?? null,
        siteName: r.project?.siteName ?? null,
        vendorId: r.buyerId,
        vendorName: r.buyer?.name ?? null,
        itemCode: r.itemCode,
        itemName: r.item?.itemName ?? r.itemName,
        weight: r.weight,
        actualWeight: r.actualWeight,
        amount: r.amount,
        paidDate: r.transferDate,
        memo: r.memo,
        attachmentCount: r.attachments.length,
      })),
    );
  }

  rows.sort((a, b) => new Date(b.date) - new Date(a.date));
  return rows;
}

const DETAIL_LOOKUP = {
  inbound: (id) =>
    prisma.inbound.findUnique({ where: { id }, include: { project: true, item: true, attachments: true } }),
  waste_inbound: (id) =>
    prisma.wasteInbound.findUnique({ where: { id }, include: { project: true, item: true, attachments: true } }),
  sorting: (id) =>
    prisma.sorting.findUnique({ where: { id }, include: { project: true, item: true } }),
  outbound_sale: (id) =>
    prisma.outboundSale.findUnique({
      where: { id },
      include: { project: true, item: true, buyer: true, attachments: true },
    }),
  waste_outbound: (id) =>
    prisma.wasteOutbound.findUnique({
      where: { id },
      include: { project: true, item: true, buyer: true, attachments: true },
    }),
};

export async function getLedgerDetail(type, id) {
  const lookup = DETAIL_LOOKUP[type];
  if (!lookup) return null;
  return lookup(id);
}
