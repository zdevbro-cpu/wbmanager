import { Router } from 'express';
import archiver from 'archiver';
import { prisma } from '../lib/prisma.js';
import { downloadFromDrive } from '../lib/drive.js';
import { toISO, kstDayString } from '../lib/date.js';

// 일괄 다운로드(ZIP) — 리뷰회의 4-1 · 5-8, 대상확인서 회신 2026-10-23
//
// 받기를 누르면 넣을 파일이 모두 체크된 채로 뜨고, 뺄 것만 체크를 푼다.
// 그래서 길이 둘이다. 먼저 /preview로 목록을 주고, 고른 것만 /download로 묶는다.
//
// 회신으로 정해진 것
//   넣을 것  P1 문서관리 입출고 · P5 입고 첨부 · P6 출고 첨부 · V1 자산 서류
//   뺀 것    P2~P4 · P7 폐기물 수집 · P8 폐기물 반출 · P9 출고보고서 · P10 셀카 · V2 · V3
//   H1 최신판만   H2 기간 고름   H3 종류별 폴더   H4 날짜_종류_원래이름
//   H5 목록표 함께   H7 관리자·운영자만

const router = Router();

// 받을 수 있는 사람 — 관리자와 운영자뿐이다(H7).
function requireDownloader(req, res, next) {
  const ok = req.appUser?.role === 'admin' || ['admin', 'operator'].includes(req.appUser?.roleKey ?? '');
  if (!ok) return res.status(403).json({ error: '일괄 다운로드는 관리자·운영자만 받을 수 있습니다.' });
  next();
}
router.use(requireDownloader);

// 프로젝트에서 묶을 묶음. 회신에서 고르신 셋만 둔다.
const PROJECT_GROUPS = ['문서관리-입출고', '입고 첨부', '출고 첨부'];

// 파일 이름이 겹치지 않게 「날짜_종류_원래이름」으로 붙인다(H4).
// 윈도우가 싫어하는 글자는 밑줄로 바꾼다 — 받아서 풀 때 깨지지 않게.
const safe = (s) => String(s ?? '').replace(/[\\/:*?"<>|]/g, '_').trim();
const nameFor = (f) => `${f.date ?? '날짜없음'}_${safe(f.kind)}_${safe(f.fileName || '첨부')}`;

// 문서관리에서 「입출고」로 묶는 분류 — 입고·출고·폐기물·집계보고·미분류.
const INOUT_PREFIXES = ['DOC-01-'];

async function collectProject(projectId, { from, to }) {
  const range = {};
  if (from) range.gte = toISO(from);
  if (to) range.lte = toISO(`${to} 23:59:59`);
  const inRange = Object.keys(range).length ? range : undefined;
  const files = [];

  // P1 — 문서관리의 입출고 분류 중 이 현장에 걸린 것. 최신판만 담는다(H1).
  const docs = await prisma.document.findMany({
    where: {
      deletedAt: null,
      links: { some: { entityType: 'project', entityId: projectId } },
      ...(inRange ? { createdAt: inRange } : {}),
    },
    include: {
      type: { select: { code: true, name: true } },
      versions: { orderBy: { versionNo: 'desc' }, take: 1 },
    },
  });
  for (const d of docs) {
    if (!INOUT_PREFIXES.some((p) => (d.type?.code ?? '').startsWith(p))) continue;
    const v = d.versions[0];
    if (!v?.storageKey) continue;
    files.push({
      key: `doc:${d.id}`,
      group: '문서관리-입출고',
      kind: d.type?.name ?? '문서',
      fileName: v.fileName ?? d.title,
      date: kstDayString(d.createdAt),
      driveFileId: v.storageKey,
      note: d.docNo ?? '',
    });
  }

  // P5 · P6 — 입고와 출고 등록에 붙인 증빙.
  const [inbounds, outbounds] = await Promise.all([
    prisma.inbound.findMany({
      where: { projectId, deletedAt: null, ...(inRange ? { inboundDate: inRange } : {}) },
      include: { attachments: true },
    }),
    prisma.outboundSale.findMany({
      where: { projectId, deletedAt: null, ...(inRange ? { outboundDate: inRange } : {}) },
      include: { attachments: true },
    }),
  ]);
  for (const r of inbounds) {
    for (const a of r.attachments) {
      files.push({
        key: `att:${a.id}`,
        group: '입고 첨부',
        kind: a.fileType ?? '증빙',
        fileName: a.fileName,
        date: kstDayString(r.inboundDate),
        driveFileId: a.driveFileId,
        note: r.vehicleNo ?? '',
      });
    }
  }
  for (const r of outbounds) {
    for (const a of r.attachments) {
      files.push({
        key: `att:${a.id}`,
        group: '출고 첨부',
        kind: a.fileType ?? '증빙',
        fileName: a.fileName,
        date: kstDayString(r.outboundDate),
        driveFileId: a.driveFileId,
        note: r.vehicleNo ?? '',
      });
    }
  }
  return files;
}

// V1 — 자산에 올린 차량등록증·보험증권·검사증·제원표.
async function collectAsset(assetId) {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: { attachments: true, vehicle: { select: { plateNo: true } } },
  });
  if (!asset) return { asset: null, files: [] };
  const files = asset.attachments.map((a) => ({
    key: `att:${a.id}`,
    group: '자산 서류',
    kind: a.fileType ?? '서류',
    fileName: a.fileName,
    date: kstDayString(a.uploadedAt),
    driveFileId: a.driveFileId,
    note: asset.vehicle?.plateNo ?? asset.assetNo,
  }));
  return { asset, files };
}

// 목록 — 화면은 이 결과를 모두 체크한 채로 띄운다.
router.get('/project/:id/preview', async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: '현장을 찾을 수 없습니다.' });
  const files = await collectProject(req.params.id, req.query);
  res.json({ title: project.roundName, groups: PROJECT_GROUPS, files });
});

router.get('/asset/:id/preview', async (req, res) => {
  const { asset, files } = await collectAsset(req.params.id);
  if (!asset) return res.status(404).json({ error: '자산을 찾을 수 없습니다.' });
  res.json({ title: `${asset.assetNo} ${asset.name}`, groups: ['자산 서류'], files });
});

// 고른 것만 묶어 내려보낸다.
// 드라이브에서 한 건씩 받아 바로 흘려 넣는다 — 서버에 쌓아 두지 않는다.
async function stream(res, title, files) {
  if (files.length === 0) return res.status(400).json({ error: '받을 파일이 없습니다.' });

  const zip = archiver('zip', { zlib: { level: 6 } });
  const stamp = kstDayString(new Date());
  const fileName = `${safe(title)}_${stamp}.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);

  // 한 건이 깨져도 나머지는 받으시게 한다. 받지 못한 것은 목록표에 적어 둔다.
  const failed = [];
  zip.on('warning', (e) => console.error('[zip] 경고:', e.message));
  zip.on('error', (e) => {
    console.error('[zip]', e.message);
    res.destroy();
  });
  zip.pipe(res);

  const used = new Set();
  for (const f of files) {
    try {
      const { stream: body } = await downloadFromDrive(f.driveFileId);
      // 종류별 폴더에 넣고(H3), 같은 이름이 겹치면 번호를 붙인다.
      let entry = `${safe(f.group)}/${nameFor(f)}`;
      let n = 2;
      while (used.has(entry)) entry = `${safe(f.group)}/${nameFor(f)} (${n++})`;
      used.add(entry);
      zip.append(body, { name: entry });
    } catch (e) {
      failed.push({ ...f, error: e.message });
    }
  }

  // H5 — 무엇이 들어 있는지 한눈에 보도록 목록표를 함께 넣는다.
  const header = '묶음,종류,파일이름,날짜,비고,상태';
  const line = (f, state) =>
    [f.group, f.kind, f.fileName ?? '', f.date ?? '', f.note ?? '', state]
      .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
      .join(',');
  const rows = files.map((f) => line(f, failed.some((x) => x.key === f.key) ? '받지 못함' : '들어 있음'));
  // 엑셀이 한글을 깨뜨리지 않도록 BOM을 붙인다.
  zip.append(`﻿${[header, ...rows].join('\r\n')}\r\n`, { name: '목록표.csv' });

  await zip.finalize();
}

router.post('/project/:id', async (req, res) => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return res.status(404).json({ error: '현장을 찾을 수 없습니다.' });
    const all = await collectProject(req.params.id, req.body);
    const pick = Array.isArray(req.body.keys) ? new Set(req.body.keys) : null;
    await stream(res, project.roundName, pick ? all.filter((f) => pick.has(f.key)) : all);
  } catch (e) {
    console.error('[zip/project]', e.message);
    if (!res.headersSent) res.status(500).json({ error: '묶지 못했습니다.' });
  }
});

router.post('/asset/:id', async (req, res) => {
  try {
    const { asset, files } = await collectAsset(req.params.id);
    if (!asset) return res.status(404).json({ error: '자산을 찾을 수 없습니다.' });
    const pick = Array.isArray(req.body.keys) ? new Set(req.body.keys) : null;
    await stream(res, `${asset.assetNo}_${asset.name}`, pick ? files.filter((f) => pick.has(f.key)) : files);
  } catch (e) {
    console.error('[zip/asset]', e.message);
    if (!res.headersSent) res.status(500).json({ error: '묶지 못했습니다.' });
  }
});

export default router;
