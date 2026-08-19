import { Router } from 'express';
import crypto from 'node:crypto';
import multer from 'multer';
import { prisma } from '../lib/prisma.js';
import { uploadToDrive, downloadFromDrive } from '../lib/drive.js';
import { clientIp } from '../middleware/audit.js';
import { decodeUploadName } from '../lib/fileName.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// 문서 분류 트리 — 대(1)·중(2)·소(3) 3단 고정.
// 코드 체계는 설계 3.2를 따른다: DOC-{영역2}-{중2}-{소3}
// 예) DOC-01-01-001 = 입출고 > 입고 증빙 > 계근표(입고)
const pad = (n, width) => String(n).padStart(width, '0');

function codeOf(parent, seq) {
  if (!parent) return `DOC-${pad(seq, 2)}`;
  return `${parent.code}-${pad(seq, parent.level === 1 ? 2 : 3)}`;
}

// 같은 부모 아래 다음 순번. 코드 끝자리를 보고 이어 붙인다.
async function nextSeq(parentId) {
  const siblings = await prisma.documentType.findMany({
    where: { parentId: parentId ?? null },
    select: { code: true },
  });
  const last = siblings.reduce((max, s) => {
    const tail = Number(String(s.code).split('-').pop());
    return Number.isFinite(tail) && tail > max ? tail : max;
  }, 0);
  return last + 1;
}

// 설계 3.1 표를 그대로 옮긴 기본 트리. 비어 있을 때 한 번만 넣는다.
const DEFAULT_TREE = [
  {
    name: '입출고',
    children: [
      { name: '입고 증빙', children: ['계근표(입고)', '매입 거래명세서', '인수증'] },
      { name: '출고 증빙', children: ['계근표(출고)', '출고전표', '매출 거래명세서'] },
      { name: '폐기물', children: ['폐기물 입고전표', '반출확인서', '올바로 인계서'] },
      {
        name: '집계·보고',
        children: ['자동집계 결과표', '재고실사표', '재고평가 명세', '손익보고서', '출고보고서'],
      },
    ],
  },
  {
    name: '현장 관리',
    children: [
      { name: '프로젝트(차수)', children: ['현장개설 승인서', '매입계약서', '단가합의서', '차수종료 정산서'] },
      { name: '폐기물·올바로', children: ['배출자 신고필증', '처리업체 계약서', '올바로 실적보고'] },
      { name: '알림·이력', children: ['이상알림 처리내역', '예외처리 보고서'] },
    ],
  },
  {
    name: '자산',
    children: [
      { name: '차량', children: ['차량등록증', '보험증권', '정비이력', '유류 정산서'] },
      { name: '장비', children: ['장비 사양서', '임대차계약서', '안전검사 필증'] },
    ],
  },
  {
    name: '임직원',
    children: [
      { name: '채용·계약', children: ['근로계약서', '신분증 사본', '통장 사본'] },
      { name: '근태·공수', children: ['공수체크표', '출역일보', '임금대장'] },
      { name: '안전·자격', children: ['안전교육 이수증', '자격증', '건강진단 결과'] },
    ],
  },
];

async function seedDefaultTree() {
  const count = await prisma.documentType.count();
  if (count > 0) return false;

  for (const [i, top] of DEFAULT_TREE.entries()) {
    const area = await prisma.documentType.create({
      data: { level: 1, code: `DOC-${pad(i + 1, 2)}`, name: top.name, sortOrder: i },
    });
    for (const [j, mid] of top.children.entries()) {
      const middle = await prisma.documentType.create({
        data: { parentId: area.id, level: 2, code: `${area.code}-${pad(j + 1, 2)}`, name: mid.name, sortOrder: j },
      });
      for (const [k, leaf] of mid.children.entries()) {
        await prisma.documentType.create({
          data: {
            parentId: middle.id,
            level: 3,
            code: `${middle.code}-${pad(k + 1, 3)}`,
            name: leaf,
            sortOrder: k,
          },
        });
      }
    }
  }
  return true;
}

// 트리 전체 — 화면에서 그대로 펼칠 수 있게 중첩해서 준다.
router.get('/types', async (req, res) => {
  await seedDefaultTree();

  const rows = await prisma.documentType.findMany({
    orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }],
  });
  const counts = await prisma.document.groupBy({
    by: ['typeId'],
    where: { deletedAt: null },
    _count: { _all: true },
  });
  const docCount = Object.fromEntries(counts.map((c) => [c.typeId, c._count._all]));

  const byId = new Map(rows.map((r) => [r.id, { ...r, docCount: docCount[r.id] ?? 0, children: [] }]));
  const tree = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId).children.push(node);
    else tree.push(node);
  }
  res.json(tree);
});

// 분류 추가 — parentId가 없으면 대분류, 있으면 그 아래 한 단계.
router.post('/types', async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  const parentId = req.body?.parentId || null;
  if (!name) return res.status(400).json({ error: '분류명은 필수입니다.' });

  let parent = null;
  if (parentId) {
    parent = await prisma.documentType.findUnique({ where: { id: parentId } });
    if (!parent) return res.status(404).json({ error: '상위 분류를 찾을 수 없습니다.' });
    if (parent.level >= 3) {
      return res.status(400).json({ error: '분류는 대·중·소 3단까지입니다. 더 나누려면 태그를 쓰세요.' });
    }
  }

  const dup = await prisma.documentType.findFirst({ where: { parentId: parentId ?? null, name } });
  if (dup) return res.status(409).json({ error: '같은 위치에 같은 이름의 분류가 있습니다.' });

  const seq = await nextSeq(parentId);
  const created = await prisma.documentType.create({
    data: {
      parentId,
      level: parent ? parent.level + 1 : 1,
      code: codeOf(parent, seq),
      name,
      sortOrder: seq,
      retentionMonths: req.body?.retentionMonths ?? null,
      requirePhysicalCopy: Boolean(req.body?.requirePhysicalCopy),
      defaultAclLevel: req.body?.defaultAclLevel || null,
      origin: req.body?.origin || 'UPLOAD',
    },
  });
  res.status(201).json(created);
});

router.patch('/types/:id', async (req, res) => {
  const data = {};
  if (req.body?.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) return res.status(400).json({ error: '분류명은 비울 수 없습니다.' });
    data.name = name;
  }
  for (const key of ['retentionMonths', 'defaultAclLevel', 'origin', 'sortOrder']) {
    if (req.body?.[key] !== undefined) data[key] = req.body[key] === '' ? null : req.body[key];
  }
  if (req.body?.requirePhysicalCopy !== undefined) data.requirePhysicalCopy = Boolean(req.body.requirePhysicalCopy);

  const updated = await prisma.documentType.update({ where: { id: req.params.id }, data });
  res.json(updated);
});

// 분류 삭제 — 하위 분류는 함께 지운다. 문서가 매달린 분류는 막는다.
router.delete('/types/:id', async (req, res) => {
  const node = await prisma.documentType.findUnique({ where: { id: req.params.id } });
  if (!node) return res.status(404).json({ error: '분류를 찾을 수 없습니다.' });

  // 자기 자신과 후손 전체를 모은다(3단 고정이라 두 번만 내려가면 된다).
  const kids = await prisma.documentType.findMany({ where: { parentId: node.id }, select: { id: true } });
  const grandKids = kids.length
    ? await prisma.documentType.findMany({ where: { parentId: { in: kids.map((k) => k.id) } }, select: { id: true } })
    : [];
  const ids = [node.id, ...kids.map((k) => k.id), ...grandKids.map((g) => g.id)];

  const used = await prisma.document.count({ where: { typeId: { in: ids }, deletedAt: null } });
  if (used > 0) {
    return res.status(409).json({ error: `이 분류에 문서 ${used}건이 있어 삭제할 수 없습니다. 문서를 옮기거나 지운 뒤 다시 시도하세요.` });
  }

  await prisma.documentType.delete({ where: { id: node.id } });  // 하위는 CASCADE
  res.json({ deleted: ids.length });
});



/* ── 문서 ──────────────────────────────────────────────────
   설계 5장. 파일은 앱 서버를 거쳐 드라이브에 올리고, DB가 문서의 단일 진실 원천이다.
   수정은 덮어쓰지 않고 새 버전을 쌓는다. */

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

// 문서 이력 — 누가 언제 무엇을 열고 바꿨는지 남긴다(설계 2.6).
// 열람·다운로드까지 남기는 것이 목적이라 요청 흐름을 막지 않도록 실패해도 넘어간다.
function recordDocAudit(req, { documentId, action, detail }) {
  prisma.auditLog
    .create({
      data: {
        appUserId: req.appUser?.id ?? null,
        email: req.appUser?.email ?? null,
        action,
        method: req.method,
        path: (req.originalUrl ?? '').slice(0, 300),
        statusCode: 200,
        ip: clientIp(req),
        userAgent: (req.headers['user-agent'] ?? '').slice(0, 300) || null,
        summary: detail ? String(detail).slice(0, 200) : null,
        entityType: 'document',
        entityId: documentId,
      },
    })
    .catch((err) => console.error('[dms] 이력 기록 실패:', err.message));
}

// 문서번호 — 분류 코드 + 연도 + 순번. 사람이 읽고 부르는 번호다.
async function nextDocNo(typeCode) {
  const year = new Date().getFullYear();
  const prefix = `${typeCode ?? 'DOC'}-${year}-`;
  const last = await prisma.document.findFirst({
    where: { docNo: { startsWith: prefix } },
    orderBy: { docNo: 'desc' },
    select: { docNo: true },
  });
  const seq = last ? Number(String(last.docNo).slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

// 목록 — 분류·프로젝트·검색어로 좁힌다. 프로젝트는 연결(document_link)로 건다.
router.get('/documents', async (req, res) => {
  const { typeId, projectId, q, includeSubtree, includeReports } = req.query;

  let typeIds;
  if (typeId) {
    typeIds = [typeId];
    // 상위 분류를 고르면 그 아래 문서까지 함께 본다(3단 고정이라 두 번만 내려간다).
    if (includeSubtree !== 'false') {
      const kids = await prisma.documentType.findMany({ where: { parentId: typeId }, select: { id: true } });
      const grandKids = kids.length
        ? await prisma.documentType.findMany({ where: { parentId: { in: kids.map((k) => k.id) } }, select: { id: true } })
        : [];
      typeIds = [typeId, ...kids.map((k) => k.id), ...grandKids.map((g) => g.id)];
    }
  }

  const docs = await prisma.document.findMany({
    where: {
      deletedAt: null,
      ...(typeIds ? { typeId: { in: typeIds } } : {}),
      ...(projectId ? { links: { some: { entityType: 'project', entityId: projectId } } } : {}),
      ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { docNo: { contains: q, mode: 'insensitive' } }] } : {}),
      // 계근표는 건당 수천 장이라 문서 목록에 올리지 않는다. 해당 거래의 첨부로만 본다(설계 3.5).
      // 분류를 콕 집어 고른 경우에만 보여 준다.
      ...(typeId ? {} : { type: { name: { not: { contains: '계근표' } } } }),
    },
    include: { type: true, versions: { orderBy: { versionNo: 'desc' } }, links: true },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });

  // 프로젝트명은 화면에서 바로 쓰이므로 함께 채워 준다.
  const projectIds = [...new Set(docs.flatMap((d) => d.links.filter((l) => l.entityType === 'project').map((l) => l.entityId)))];
  const projects = projectIds.length
    ? await prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, roundName: true } })
    : [];
  const nameOf = Object.fromEntries(projects.map((p) => [p.id, p.roundName]));

  const documents = docs.map(({ links, ...d }) => ({
    ...d,
    origin: 'UPLOAD',
    versions: d.versions.map((v) => ({ ...v, byteSize: v.byteSize == null ? null : Number(v.byteSize) })),
    projects: links
      .filter((l) => l.entityType === 'project')
      .map((l) => ({ id: l.entityId, name: nameOf[l.entityId] ?? null })),
  }));

  // 발행 보고서도 같은 목록에서 본다. 파일은 발행 시점 데이터로 그때그때 만들므로 버전은 없다.
  // 분류를 고른 조회에서는 섞지 않는다(그 분류의 문서만 보려는 것이라).
  let reports = [];
  // 보고서는 보관함에서 본다. 필요하면 includeReports=true로 켠다.
  if (!typeId && includeReports === 'true') {
    const rows = await prisma.report.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
      },
      include: { project: { select: { id: true, roundName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    reports = rows.map((r) => ({
      id: `report:${r.id}`,
      docNo: null,
      title: r.title,
      origin: 'SYSTEM',
      reportType: r.reportType,
      typeId: null,
      type: { name: r.reportType === 'pnl' ? '손익 보고' : '출고 보고', code: 'REPORT' },
      createdAt: r.createdAt,
      meta: { docDate: r.reportDate ? r.reportDate.toISOString().slice(0, 10) : null },
      versions: [],
      projects: r.project ? [{ id: r.project.id, name: r.project.roundName }] : [],
    }));
  }

  res.json(
    [...documents, ...reports].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  );
});

// 등록 — 메타와 첫 파일을 함께 받는다.
router.post('/documents', upload.single('file'), async (req, res) => {
  const { title, typeId, projectId, description, docDate } = req.body;
  if (!req.file) return res.status(400).json({ error: '파일은 필수입니다.' });
  if (!typeId) return res.status(400).json({ error: '문서 분류는 필수입니다.' });

  const type = await prisma.documentType.findUnique({ where: { id: typeId } });
  if (!type) return res.status(404).json({ error: '문서 분류를 찾을 수 없습니다.' });

  const docTitle = String(title ?? '').trim() || decodeUploadName(req.file.originalname);
  const checksum = sha256(req.file.buffer);

  const { driveFileId, fileName } = await uploadToDrive({
    buffer: req.file.buffer,
    fileName: decodeUploadName(req.file.originalname),
    mimeType: req.file.mimetype,
  });

  // 보존 만료일은 분류의 보존연한에서 산출한다(설계 3.3).
  const retentionUntil = type.retentionMonths
    ? new Date(new Date().setMonth(new Date().getMonth() + type.retentionMonths))
    : null;

  const saved = await prisma.$transaction(async (tx) => {
    const doc = await tx.document.create({
      data: {
        docNo: await nextDocNo(type.code),
        typeId,
        title: docTitle,
        description: description || null,
        ownerId: req.appUser?.id ?? null,
        meta: docDate ? { docDate } : undefined,
        retentionUntil,
      },
    });
    const version = await tx.documentVersion.create({
      data: {
        documentId: doc.id,
        versionNo: 1,
        storageKind: 'gdrive',
        storageKey: driveFileId,
        fileName,
        mimeType: req.file.mimetype,
        byteSize: BigInt(req.file.size),
        checksumSha256: checksum,
        uploadedBy: req.appUser?.id ?? null,
      },
    });
    await tx.document.update({ where: { id: doc.id }, data: { currentVersionId: version.id } });
    if (projectId) {
      await tx.documentLink.create({
        data: { documentId: doc.id, entityType: 'project', entityId: projectId, relation: 'attachment' },
      });
    }
    return doc;
  });

  recordDocAudit(req, { documentId: saved.id, action: 'doc_create', detail: `${type.name} / ${docTitle}` });
  res.status(201).json(saved);
});

// 새 버전 — 같은 파일이면 거부해 불필요한 버전 증식을 막는다(설계 2.3).
router.post('/documents/:id/versions', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '파일은 필수입니다.' });

  const doc = await prisma.document.findUnique({
    where: { id: req.params.id },
    include: { versions: { orderBy: { versionNo: 'desc' }, take: 1 } },
  });
  if (!doc || doc.deletedAt) return res.status(404).json({ error: '문서를 찾을 수 없습니다.' });

  const checksum = sha256(req.file.buffer);
  if (doc.versions[0]?.checksumSha256 === checksum) {
    return res.status(409).json({ error: '직전 버전과 같은 파일입니다. 새 버전을 만들지 않았습니다.' });
  }

  const { driveFileId, fileName } = await uploadToDrive({
    buffer: req.file.buffer,
    fileName: decodeUploadName(req.file.originalname),
    mimeType: req.file.mimetype,
  });

  const version = await prisma.$transaction(async (tx) => {
    const created = await tx.documentVersion.create({
      data: {
        documentId: doc.id,
        versionNo: (doc.versions[0]?.versionNo ?? 0) + 1,
        storageKind: 'gdrive',
        storageKey: driveFileId,
        fileName,
        mimeType: req.file.mimetype,
        byteSize: BigInt(req.file.size),
        checksumSha256: checksum,
        changeNote: req.body?.changeNote || null,
        uploadedBy: req.appUser?.id ?? null,
      },
    });
    await tx.document.update({ where: { id: doc.id }, data: { currentVersionId: created.id } });
    return created;
  });

  recordDocAudit(req, {
    documentId: doc.id,
    action: 'doc_version',
    detail: `v${version.versionNo} ${req.body?.changeNote ?? ''}`.trim(),
  });
  res.status(201).json({ ...version, byteSize: Number(version.byteSize) });
});

// 열람·다운로드 — 드라이브 링크를 노출하지 않고 앱이 중계한다(설계 1장 원칙 2).
router.get('/documents/:id/content', async (req, res) => {
  const doc = await prisma.document.findUnique({
    where: { id: req.params.id },
    include: { versions: { orderBy: { versionNo: 'desc' } } },
  });
  if (!doc || doc.deletedAt) return res.status(404).json({ error: '문서를 찾을 수 없습니다.' });

  const wanted = req.query.versionNo ? Number(req.query.versionNo) : null;
  const version = wanted ? doc.versions.find((v) => v.versionNo === wanted) : doc.versions[0];
  if (!version?.storageKey) return res.status(404).json({ error: '파일이 없습니다.' });

  try {
    const { stream, mimeType } = await downloadFromDrive(version.storageKey);
    const encoded = encodeURIComponent(version.fileName ?? 'document');
    res.setHeader('Content-Type', mimeType || version.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="document"; filename*=UTF-8''${encoded}`);
    recordDocAudit(req, { documentId: doc.id, action: 'doc_download', detail: `v${version.versionNo} ${version.fileName ?? ''}`.trim() });
    stream.pipe(res);
  } catch (err) {
    console.error('[dms] 다운로드 실패:', err.message);
    res.status(502).json({ error: '드라이브에서 파일을 가져오지 못했습니다.' });
  }
});

// 업무 화면용 — "이 프로젝트(자산·임직원) 문서 전부"
router.get('/entities/:type/:id/documents', async (req, res) => {
  const links = await prisma.documentLink.findMany({
    where: { entityType: req.params.type, entityId: req.params.id },
    include: { document: { include: { type: true, versions: { orderBy: { versionNo: 'desc' } } } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(
    links
      .filter((l) => l.document && !l.document.deletedAt)
      .map((l) => ({
        ...l.document,
        versions: l.document.versions.map((v) => ({ ...v, byteSize: v.byteSize == null ? null : Number(v.byteSize) })),
      })),
  );
});


// 상세 — 버전 이력과 연결된 업무까지 함께 준다.
router.get('/documents/:id', async (req, res) => {
  const doc = await prisma.document.findUnique({
    where: { id: req.params.id },
    include: { type: true, versions: { orderBy: { versionNo: 'desc' } }, links: true },
  });
  if (!doc || doc.deletedAt) return res.status(404).json({ error: '문서를 찾을 수 없습니다.' });

  const projectIds = doc.links.filter((l) => l.entityType === 'project').map((l) => l.entityId);
  const projects = projectIds.length
    ? await prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, roundName: true } })
    : [];

  const { links, ...rest } = doc;
  res.json({
    ...rest,
    versions: doc.versions.map((v) => ({ ...v, byteSize: v.byteSize == null ? null : Number(v.byteSize) })),
    projects: projects.map((p) => ({ id: p.id, name: p.roundName })),
  });
});

// 메타 수정 — 제목·비고·분류·문서일자·실물 보관 여부를 고친다.
// 파일은 여기서 바꾸지 않는다. 파일 교체는 새 버전이다(설계 2.3).
router.patch('/documents/:id', async (req, res) => {
  const { title, description, typeId, docDate, physicalStatus, physicalLocation, projectId } = req.body ?? {};

  const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!doc || doc.deletedAt) return res.status(404).json({ error: '문서를 찾을 수 없습니다.' });

  const meta = { ...(doc.meta ?? {}) };
  if (docDate !== undefined) meta.docDate = docDate || null;
  // 실물(원본) 확인 상태 — 스캔본만 있는지, 원본을 어디에 두었는지 남긴다.
  if (physicalStatus !== undefined) meta.physicalStatus = physicalStatus || null;
  if (physicalLocation !== undefined) meta.physicalLocation = physicalLocation || null;
  if (physicalStatus === '확인') meta.physicalCheckedAt = new Date().toISOString().slice(0, 10);

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.document.update({
      where: { id: doc.id },
      data: {
        ...(title !== undefined ? { title: String(title).trim() || doc.title } : {}),
        ...(description !== undefined ? { description: description || null } : {}),
        ...(typeId !== undefined && typeId ? { typeId } : {}),
        meta,
      },
    });

    // 프로젝트 연결은 하나만 유지한다 — 바꾸면 이전 연결을 지우고 새로 건다.
    if (projectId !== undefined) {
      await tx.documentLink.deleteMany({ where: { documentId: doc.id, entityType: 'project' } });
      if (projectId) {
        await tx.documentLink.create({
          data: { documentId: doc.id, entityType: 'project', entityId: projectId, relation: 'attachment' },
        });
      }
    }
    return saved;
  });

  recordDocAudit(req, { documentId: doc.id, action: 'doc_update', detail: updated.title });
  res.json(updated);
});

// 업무 연결 추가 — 자산·임직원 화면에서 등록한 문서를 그 레코드에 붙인다.
router.post('/documents/:id/links', async (req, res) => {
  const { entityType, entityId, relation } = req.body ?? {};
  if (!entityType || !entityId) return res.status(400).json({ error: 'entityType, entityId는 필수입니다.' });
  const link = await prisma.documentLink.upsert({
    where: {
      documentId_entityType_entityId_relation: {
        documentId: req.params.id,
        entityType,
        entityId,
        relation: relation || 'attachment',
      },
    },
    update: {},
    create: { documentId: req.params.id, entityType, entityId, relation: relation || 'attachment' },
  });
  res.status(201).json({ ...link, id: Number(link.id) });
});

// 소프트 삭제 — 드라이브 파일은 남긴다. 되돌릴 여지를 두기 위해서다.
router.delete('/documents/:id', async (req, res) => {
  const doc = await prisma.document.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
  recordDocAudit(req, { documentId: doc.id, action: 'doc_delete', detail: doc.title });
  res.json({ ok: true });
});

// 문서 이력 — 등록·수정·버전·열람 기록을 시간순으로 준다.
router.get('/documents/:id/audit', async (req, res) => {
  const rows = await prisma.auditLog.findMany({
    where: { entityType: 'document', entityId: req.params.id },
    include: { appUser: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(rows);
});

export default router;
