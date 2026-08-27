import { prisma } from './prisma.js';

// 업무 화면에서 올린 증빙을 문서로도 편입한다.
//
// 원칙 두 가지.
//  1) 분류를 사람에게 묻지 않는다. 어디서 생긴 파일인지 알면 들어갈 자리도 정해져 있다.
//     계근 등록 중에 "이 사진을 어디에 넣을까요"를 물으면 자동 연계가 아니라 수동 등록이 된다.
//  2) 파일을 다시 올리지 않는다. 드라이브에 이미 있는 파일을 문서 버전이 그대로 가리킨다.
//     같은 파일이 두 벌 쌓이면 용량도 낭비지만, 나중에 어느 쪽이 원본인지 알 수 없게 된다.
//
// 매핑에 없는 조합은 「입출고 > 미분류 > 분류 대기」로 보낸다. 갈 곳이 없으면 연계가 조용히 실패한다.
const FALLBACK_CODE = 'DOC-01-09-001';

// [업무, 서류 종류] → 분류 코드. 코드는 기본 트리 생성 시점에 정해진 값이라 이름을 바꿔도 그대로다.
const FILING_RULES = [
  { parent: 'inbound', fileType: '계량증명서', code: 'DOC-01-01-001' },
  { parent: 'inbound', fileType: '인수증', code: 'DOC-01-01-003' },
  { parent: 'outbound_sale', fileType: '계량증명서', code: 'DOC-01-02-001' },
  { parent: 'outbound_sale', fileType: '출고전표', code: 'DOC-01-02-002' },
  // '참고서류'는 무엇이 올지 정해져 있지 않다. 억지로 이름 붙은 자리에 넣지 않고 미분류로 보낸다.
  { parent: 'waste_inbound', fileType: '계량증명서', code: 'DOC-01-03-001' },
  { parent: 'waste_inbound', fileType: '올바로', code: 'DOC-01-03-003' },
  { parent: 'waste_outbound', fileType: '계량증명서', code: 'DOC-01-03-002' },
  { parent: 'waste_outbound', fileType: '올바로', code: 'DOC-01-03-003' },
  { parent: 'asset', fileType: '차량등록증', code: 'DOC-03-01-001' },
  { parent: 'asset', fileType: '보험증권', code: 'DOC-03-01-002' },
  // 계약서는 자산이 아니라 계약서끼리 모인다. 문서가 자산에도 연결되므로 자산 문서함에서는 그대로 보인다.
  { parent: 'asset', fileType: '계약서', code: 'DOC-05-01-005' },
  { parent: 'asset_maintenance', fileType: null, code: 'DOC-03-01-003' },
  { parent: 'vehicle_maintenance', fileType: null, code: 'DOC-03-01-003' },
  { parent: 'employee', fileType: null, code: 'DOC-04-03-002' },
];

// 업무 종류별로 어느 표에서 프로젝트를 찾는지. 문서를 그 프로젝트에 매달아
// 프로젝트 상세의 문서함에서도 보이게 한다.
const PROJECT_SOURCE = {
  inbound: (db, id) =>
    db.inbound.findUnique({
      where: { id },
      select: { projectId: true, inboundDate: true, vehicleNo: true, item: { select: { itemName: true } } },
    }),
  outbound_sale: (db, id) =>
    db.outboundSale.findUnique({
      where: { id },
      select: { projectId: true, outboundDate: true, vehicleNo: true, item: { select: { itemName: true } } },
    }),
  waste_inbound: (db, id) =>
    db.wasteInbound.findUnique({
      where: { id },
      select: { projectId: true, receiveDate: true, vehicleNo: true, item: { select: { itemName: true } } },
    }),
  waste_outbound: (db, id) =>
    db.wasteOutbound.findUnique({
      where: { id },
      select: { projectId: true, outboundDate: true, vehicleNo: true, item: { select: { itemName: true } } },
    }),
};

const day = (v) => (v ? new Date(v).toISOString().slice(0, 10) : null);

function ruleFor(parentType, fileType) {
  return (
    FILING_RULES.find((r) => r.parent === parentType && r.fileType === fileType) ??
    FILING_RULES.find((r) => r.parent === parentType && r.fileType === null)
  );
}

async function nextDocNo(tx, typeCode) {
  const year = new Date().getFullYear();
  const prefix = `${typeCode ?? 'DOC'}-${year}-`;
  const last = await tx.document.findFirst({
    where: { docNo: { startsWith: prefix } },
    orderBy: { docNo: 'desc' },
    select: { docNo: true },
  });
  const seq = last ? Number(String(last.docNo).slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

/**
 * 방금 올린 첨부를 문서로 편입한다.
 * 실패해도 예외를 던지지 않는다 — 편입이 안 됐다고 계근 등록이 막히면 안 된다.
 */
export async function fileAttachmentAsDocument({ attachment, parentType, parentId, appUserId }) {
  try {
    const rule = ruleFor(parentType, attachment.fileType);
    const code = rule?.code ?? FALLBACK_CODE;

    const type =
      (await prisma.documentType.findUnique({ where: { code } })) ??
      (await prisma.documentType.findUnique({ where: { code: FALLBACK_CODE } }));
    if (!type) return null;

    const retentionUntil = type.retentionMonths
      ? new Date(new Date().setMonth(new Date().getMonth() + type.retentionMonths))
      : null;

    let projectId = null;
    let source = null;
    const finder = PROJECT_SOURCE[parentType];
    if (finder && parentId) {
      source = await finder(prisma, parentId);
      projectId = source?.projectId ?? null;
    }

    // 파일명만으로는 감사 때 찾을 수 없다. 무엇을 계근한 서류인지 제목에 남긴다.
    // 예: 계근표(입고) 2026-08-24 220호4205 고철
    const docDate = day(source?.inboundDate ?? source?.outboundDate ?? source?.receiveDate);
    const title =
      source && docDate
        ? [type.name, docDate, source.vehicleNo, source.item?.itemName].filter(Boolean).join(' ')
        : (attachment.fileName ?? attachment.fileType ?? '증빙');

    return await prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          docNo: await nextDocNo(tx, type.code),
          typeId: type.id,
          title,
          description: attachment.fileName ?? null,
          ownerId: appUserId ?? null,
          // 문서일자는 계근한 날이다. 등록한 날이 아니라 그날로 찾게 된다.
          meta: docDate ? { docDate } : undefined,
          retentionUntil,
        },
      });

      // 드라이브에 있는 파일을 그대로 가리킨다. 다시 올리지 않는다.
      const version = await tx.documentVersion.create({
        data: {
          documentId: doc.id,
          versionNo: 1,
          storageKind: 'gdrive',
          storageKey: attachment.driveFileId,
          fileName: attachment.fileName,
          uploadedBy: appUserId ?? null,
        },
      });
      await tx.document.update({ where: { id: doc.id }, data: { currentVersionId: version.id } });

      // 어느 업무에서 나온 문서인지 이어 둔다. 업무 화면의 문서함이 이 연결로 목록을 뽑는다.
      const links = [{ documentId: doc.id, entityType: parentType, entityId: parentId }];
      if (projectId) links.push({ documentId: doc.id, entityType: 'project', entityId: projectId });
      await tx.documentLink.createMany({ data: links, skipDuplicates: true });

      return doc;
    });
  } catch (err) {
    console.error('[dms] 자동 편입 실패:', err.message);
    return null;
  }
}
