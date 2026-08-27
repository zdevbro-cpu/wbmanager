import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma.js';
import { uploadToDrive } from '../lib/drive.js';
import { distanceMeters } from '../lib/attendance.js';
import { kstDayString } from '../lib/date.js';
import { attendManDays } from '../lib/attendCode.js';

const router = Router();
// 셀카 한 장. 폰 사진이 커도 담기도록 넉넉히 두되, 통짜 동영상은 막는다.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

// 마감한 달에는 찍을 수 없다. 이미 낸 집계가 뒤에서 바뀌면 안 된다.
async function assertOpen(month) {
  const s = await prisma.laborSettlement.findUnique({ where: { month } });
  if (s?.status === 'closed') {
    const err = new Error(`${month}은 마감된 달입니다.`);
    err.status = 409;
    throw err;
  }
}

function fail(res, e) {
  const status = e.status ?? 500;
  if (status === 500) console.error('[attendance]', e.message);
  res.status(status).json({ error: status === 500 ? '처리하지 못했습니다.' : e.message });
}

// 오늘 내 기록 — 누가 찍는지, 동의는 받았는지, 오늘 무엇이 찍혔는지.
router.get('/me', async (req, res) => {
  try {
    const date = kstDayString(req.query.date);
    const employeeId = await resolveEmployeeId(req);

    const employee = employeeId
      ? await prisma.employee.findUnique({
          where: { id: employeeId },
          select: { id: true, name: true, employmentType: true, department: true, faceConsentAt: true, photoDriveId: true },
        })
      : null;

    const today = employee
      ? await prisma.labor.findFirst({
          where: { employeeId: employee.id, workDate: new Date(`${date}T00:00:00.000Z`) },
        })
      : null;

    res.json({
      date,
      employee,
      consented: Boolean(employee?.faceConsentAt),
      hasPhoto: Boolean(employee?.photoDriveId),
      today,
    });
  } catch (e) {
    fail(res, e);
  }
});

// 찍는 사람은 로그인한 계정에서 정한다 — 현장에서 남의 이름으로 찍는 일이 없어야 한다.
// 계정에 연결이 없으면 같은 이름의 임직원을 한 번 찾아 연결해 두고, 그 뒤로는 그대로 쓴다.
async function resolveEmployeeId(req) {
  if (!req.appUser?.id) return null;
  const user = await prisma.appUser.findUnique({
    where: { id: req.appUser.id },
    select: { employeeId: true, name: true, email: true },
  });
  if (user?.employeeId) return user.employeeId;

  const name = (user?.name ?? '').trim();
  if (!name) return null;
  const found = await prisma.employee.findFirst({ where: { name } });
  if (!found) return null;

  await prisma.appUser.update({ where: { id: req.appUser.id }, data: { employeeId: found.id } });
  return found.id;
}

// 출근·퇴근 — 셀카와 위치를 함께 받는다.
// form-data: photo, employeeId, projectId, lat, lng, consent, kind(in|out)
router.post('/in', upload.single('photo'), (req, res) => stamp(req, res, 'in'));
router.post('/out', upload.single('photo'), (req, res) => stamp(req, res, 'out'));

async function stamp(req, res, kind) {
  try {
    const { projectId } = req.body;
    // 본문에 담긴 이름은 믿지 않는다. 누구인지는 계정에서 정한다.
    const employeeId = await resolveEmployeeId(req);
    if (!employeeId) {
      return res.status(400).json({ error: '계정에 임직원 정보가 연결되어 있지 않습니다. 관리자에게 연결을 요청하세요.' });
    }
    if (!projectId) return res.status(400).json({ error: '현장을 고르세요.' });
    if (!req.file) return res.status(400).json({ error: '사진을 찍어야 등록됩니다.' });

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ error: '임직원을 찾을 수 없습니다.' });

    // 얼굴 사진은 처음 한 번 동의를 받고, 그 시각을 남겨 두 번 묻지 않는다.
    if (!employee.faceConsentAt) {
      if (req.body.consent !== 'true') {
        return res.status(400).json({ error: '얼굴 사진 사용에 동의해야 등록할 수 있습니다.' });
      }
      await prisma.employee.update({ where: { id: employee.id }, data: { faceConsentAt: new Date() } });
    }

    const date = kstDayString(req.body.date);
    const month = date.slice(0, 7);
    if (!MONTH.test(month)) return res.status(400).json({ error: '날짜가 올바르지 않습니다.' });
    await assertOpen(month);

    const lat = req.body.lat === '' || req.body.lat == null ? null : Number(req.body.lat);
    const lng = req.body.lng === '' || req.body.lng == null ? null : Number(req.body.lng);

    // 현장 기준점. 화면에 입력칸을 두지 않는다 —
    // 그 현장에서 처음 찍힌 출근 위치를 기준으로 삼고, 그 뒤로는 반경 안인지만 본다.
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    let distance = null;
    if (lat != null && lng != null && project) {
      if (project.siteLat == null || project.siteLng == null) {
        await prisma.project.update({ where: { id: project.id }, data: { siteLat: lat, siteLng: lng } });
        distance = 0;
      } else {
        distance = distanceMeters(project.siteLat, project.siteLng, lat, lng);
      }
    }
    const radius = project?.geoRadius ?? 100;
    const outside = distance != null && distance > radius;

    const day = new Date(`${date}T00:00:00.000Z`);
    const existing = await prisma.labor.findFirst({ where: { employeeId, workDate: day } });

    const now = new Date();
    const base = {
      employeeId,
      projectId,
      workDate: day,
      settleMonth: month,
      workerName: employee.name,
      workerType: employee.employmentType ?? '정규직',
      // 현장에서 올라온 것은 사무실이 확인하기 전까지 임시저장이다.
      isDraft: true,
      // 사람이 보고 확정할 몫으로 남긴다. 자동 판독은 별도로 붙인다.
      faceVerdict: 'unsure',
      faceNote: outside ? `현장에서 ${distance}m 떨어진 곳에서 찍음(허용 ${radius}m)` : null,
    };

    const data =
      kind === 'in'
        ? {
            ...base,
            checkInAt: now,
            checkInLat: lat,
            checkInLng: lng,
            checkInDistance: distance,
            // 정규직은 근태로, 그 외는 공수로 센다.
            ...(existing?.attendCode || existing?.totalManDays
              ? {}
              : (employee.employmentType ?? '정규직') === '정규직'
                ? { attendCode: '출근' }
                : { totalManDays: 1 }),
          }
        : { ...base, checkOutAt: now, checkOutLat: lat, checkOutLng: lng };

    const row = existing
      ? await prisma.labor.update({ where: { id: existing.id }, data })
      : await prisma.labor.create({ data: { ...data, createdById: req.appUser?.id ?? null } });

    // 셀카는 지금 쓰는 첨부 구조에 담는다. 월 마감 때 이 연결을 따라 지워진다.
    const uploaded = await uploadToDrive({
      buffer: req.file.buffer,
      fileName: `출퇴근_${employee.name}_${date}_${kind === 'in' ? '출근' : '퇴근'}.jpg`,
      mimeType: req.file.mimetype || 'image/jpeg',
    });
    await prisma.attachment.create({
      data: {
        driveFileId: uploaded.driveFileId,
        fileName: uploaded.fileName,
        fileType: kind === 'in' ? '출근사진' : '퇴근사진',
        webViewLink: uploaded.webViewLink,
        laborId: row.id,
      },
    });

    res.status(201).json({ ...row, outside, radius });
  } catch (e) {
    fail(res, e);
  }
}

// 본사 — 사무실 출퇴근이 붙을 자리. 이름으로 찾고 없으면 만든다.
async function ensureHqProject() {
  const found = await prisma.project.findFirst({ where: { roundName: '본사' } });
  if (found) return found.id;
  const created = await prisma.project.create({ data: { roundName: '본사', status: '진행' } });
  return created.id;
}

// 사무실 출퇴근 단말 — 태블릿 카메라나 USB 스캐너로 사번 QR을 읽어 그 자리에서 찍는다.
// 셀카·위치를 묻지 않는다. 단말이 사무실에 붙박이라 어디서 찍었는지가 이미 정해져 있고,
// 눈앞에서 사람이 찍는 것을 보기 때문이다. 대신 어느 단말에서 왔는지는 계정으로 남는다.
router.post('/gate', async (req, res) => {
  try {
    const empCode = String(req.body.empCode ?? '').trim();
    const { projectId, kind, attendCode } = req.body;
    if (!empCode) return res.status(400).json({ error: '사번을 읽지 못했습니다.' });
    if (!projectId) return res.status(400).json({ error: '현장을 고르세요.' });

    // 사무실 출퇴근은 현장이 아니라 본사에 붙는다. 프로젝트가 없으면 그때 하나 만든다.
    const siteId = projectId === 'HQ' ? await ensureHqProject() : projectId;

    const employee = await prisma.employee.findUnique({ where: { empCode } });
    if (!employee) return res.status(404).json({ error: `등록되지 않은 사번입니다 (${empCode})` });

    const date = kstDayString();
    const month = date.slice(0, 7);
    await assertOpen(month);

    const day = new Date(`${date}T00:00:00.000Z`);
    const existing = await prisma.labor.findFirst({ where: { employeeId: employee.id, workDate: day } });

    // 무엇을 찍을지 화면이 정해 보낸다. 안 보내면 오늘 출근이 이미 찍혔는지로 정한다.
    const stampKind = kind === 'out' || (!kind && existing?.checkInAt) ? 'out' : 'in';
    const now = new Date();
    const regular = (employee.employmentType ?? '정규직') === '정규직';
    const code = attendCode || (regular ? '출근' : null);

    const base = {
      employeeId: employee.id,
      projectId: siteId,
      workDate: day,
      settleMonth: month,
      workerName: employee.name,
      workerType: employee.employmentType ?? '정규직',
    };

    const data =
      stampKind === 'in'
        ? {
            ...base,
            checkInAt: now,
            ...(code ? { attendCode: code, totalManDays: attendManDays(code) } : {}),
            ...(!regular && !existing?.totalManDays ? { totalManDays: 1 } : {}),
          }
        : { ...base, checkOutAt: now, ...(attendCode ? { attendCode, totalManDays: attendManDays(attendCode) } : {}) };

    const row = existing
      ? await prisma.labor.update({ where: { id: existing.id }, data })
      : await prisma.labor.create({ data: { ...data, createdById: req.appUser?.id ?? null } });

    res.status(201).json({
      kind: stampKind,
      name: employee.name,
      empCode: employee.empCode,
      employmentType: employee.employmentType,
      attendCode: row.attendCode,
      at: stampKind === 'in' ? row.checkInAt : row.checkOutAt,
      checkInAt: row.checkInAt,
      checkOutAt: row.checkOutAt,
    });
  } catch (e) {
    fail(res, e);
  }
});

export default router;
