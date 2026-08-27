import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { toISO } from '../lib/date.js';
import { rememberCodes } from '../lib/rememberCodes.js';
import { attendManDays } from '../lib/attendCode.js';
import { requireAdmin } from '../middleware/auth.js';
import { purgeMonthSelfies, purgeLaborSelfies } from '../lib/attendance.js';

const router = Router();

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

// 이 서버에는 공용 오류 처리기가 없다. 여기서 만든 오류는 여기서 답한다.
function fail(res, e) {
  const status = e.status ?? 500;
  if (status === 500) console.error('[labor]', e.message);
  res.status(status).json({ error: status === 500 ? '처리하지 못했습니다.' : e.message });
}

// 'YYYY-MM-DD…' 에서 달을 뽑는다. 날짜 문자열을 그대로 쓰기 때문에
// 시차로 하루가 밀려 엉뚱한 달에 붙는 일이 없다.
function monthOf(workDate) {
  const s = String(workDate ?? '');
  return MONTH.test(s.slice(0, 7)) ? s.slice(0, 7) : null;
}

// 마감한 달은 손대지 못한다. 마감 뒤에 숫자가 바뀌면 이미 낸 집계와 어긋난다.
async function assertOpen(month) {
  if (!month) return;
  const s = await prisma.laborSettlement.findUnique({ where: { month } });
  if (s?.status === 'closed') {
    const err = new Error(`${month}은 마감된 달입니다. 수정하려면 마감을 먼저 열어야 합니다.`);
    err.status = 409;
    throw err;
  }
}

// 월 조회. month를 주면 그 달만, 없으면 지금까지처럼 전체를 준다.
router.get('/', async (req, res) => {
  const { projectId, month, employeeId } = req.query;
  const rows = await prisma.labor.findMany({
    where: {
      ...(projectId ? { projectId } : {}),
      ...(employeeId ? { employeeId } : {}),
      ...(month && MONTH.test(month) ? { settleMonth: month } : {}),
    },
    orderBy: [{ workDate: 'desc' }, { workerName: 'asc' }],
  });
  res.json(rows);
});

// 그 달이 열려 있는지 — 화면에서 입력을 잠글지 정하는 값이다.
router.get('/settlement', async (req, res) => {
  const { month } = req.query;
  if (!MONTH.test(month ?? '')) return res.status(400).json({ error: 'month는 YYYY-MM 형식입니다.' });
  const row = await prisma.laborSettlement.findUnique({ where: { month } });
  res.json(row ?? { month, status: 'open' });
});

// 마감. 관리자만 한다.
// 마감과 함께 그 달의 출퇴근 셀카를 지운다 — 집계는 남고 얼굴 사진은 남지 않는다.
router.post('/settlement/close', requireAdmin, async (req, res) => {
  const { month, memo } = req.body ?? {};
  if (!MONTH.test(month ?? '')) return res.status(400).json({ error: 'month는 YYYY-MM 형식입니다.' });

  const draft = await prisma.labor.count({ where: { settleMonth: month, isDraft: true } });
  if (draft > 0) {
    return res.status(400).json({ error: `확인하지 않은 임시저장이 ${draft}건 있습니다. 먼저 정상등록으로 처리해 주세요.` });
  }

  const purged = await purgeMonthSelfies(month);
  const row = await prisma.laborSettlement.upsert({
    where: { month },
    update: {
      status: 'closed',
      closedById: req.appUser?.id ?? null,
      closedAt: new Date(),
      photoPurgedAt: new Date(),
      ...(memo !== undefined ? { memo } : {}),
    },
    create: {
      month,
      status: 'closed',
      closedById: req.appUser?.id ?? null,
      closedAt: new Date(),
      photoPurgedAt: new Date(),
      memo: memo ?? null,
    },
  });
  res.json({ ...row, purgedPhotos: purged });
});

// 마감 열기. 관리자만 한다. 지워진 사진은 돌아오지 않는다.
router.post('/settlement/open', requireAdmin, async (req, res) => {
  const { month } = req.body ?? {};
  if (!MONTH.test(month ?? '')) return res.status(400).json({ error: 'month는 YYYY-MM 형식입니다.' });
  const row = await prisma.laborSettlement.upsert({
    where: { month },
    update: { status: 'open', closedById: null, closedAt: null },
    create: { month, status: 'open' },
  });
  res.json(row);
});

// 달력에서 한 칸을 채운다 — 한 사람의 하루.
// 같은 사람·같은 날이 이미 있으면 고치고, 없으면 만든다.
router.put('/cell', async (req, res) => {
  try {
    const { employeeId, workDate } = req.body ?? {};
    if (!employeeId || !workDate) return res.status(400).json({ error: 'employeeId, workDate는 필수입니다.' });

    const month = monthOf(workDate);
    await assertOpen(month);

    const day = toISO(workDate);
    const existing = await prisma.labor.findFirst({ where: { employeeId, workDate: day } });
    const data = buildCell(req.body, month, day);

    // 단가·식대·기타비용을 적지 않았으면 그 사람에게 정해 둔 값으로 채운다.
    // 승인 자리에서 한 번 적어 두면 공수표에서는 날짜와 근태만 고르면 되게 하려는 것이다.
    const person = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (person) {
      if (data.unitCost == null && person.unitCost != null) data.unitCost = person.unitCost;
      if (data.mealCost == null && person.mealCost != null) data.mealCost = person.mealCost;
      if (data.suppliesCost == null && person.etcCost != null) data.suppliesCost = person.etcCost;
      if (data.totalManDays != null && data.unitCost != null && req.body.laborCost == null) {
        data.laborCost = Math.round(Number(data.totalManDays) * Number(data.unitCost));
      }
      if (req.body.totalAmount == null) {
        data.totalAmount =
          Number(data.laborCost ?? 0) + Number(data.mealCost ?? 0) + Number(data.suppliesCost ?? 0) || null;
      }
    }

    const row = existing
      ? await prisma.labor.update({ where: { id: existing.id }, data })
      : await prisma.labor.create({ data: { ...data, createdById: req.appUser?.id ?? null } });

    await rememberCodes([['작업자', req.body.workerName]]);
    res.json(row);
  } catch (e) {
    fail(res, e);
  }
});

// 칸에서 보내는 값만 반영한다. 보내지 않은 항목은 건드리지 않는다.
function buildCell(body, month, day) {
  const pick = [
    'projectId',
    'workerName',
    'workerType',
    'attendCode',
    'totalManDays',
    'unitCost',
    'laborCost',
    'mealCost',
    'toolCost',
    'fuelCost',
    'suppliesCost',
    'totalAmount',
    'isDraft',
  ];
  const data = { employeeId: body.employeeId, workDate: day, settleMonth: month };
  for (const k of pick) if (body[k] !== undefined) data[k] = body[k] === '' ? null : body[k];

  // 근태코드만 고른 경우(정규직) 그 코드 몫의 공수를 대신 넣는다.
  // 반차를 골라도 공수가 비어 있으면 인건비에 아무것도 안 잡히기 때문이다.
  // 공수를 손으로 적어 보냈으면 그 값을 그대로 둔다.
  if (data.attendCode && data.totalManDays == null) {
    const derived = attendManDays(data.attendCode);
    if (derived != null) data.totalManDays = derived;
  }
  // 공수와 단가가 모두 있으면 인건비도 함께 맞춘다.
  if (data.totalManDays != null && data.unitCost != null && data.laborCost == null) {
    data.laborCost = Math.round(Number(data.totalManDays) * Number(data.unitCost));
  }
  return data;
}

router.post('/', async (req, res) => {
  try {
    const { projectId, workDate } = req.body;
    if (!projectId || !workDate) return res.status(400).json({ error: 'projectId, workDate는 필수입니다.' });
    const month = monthOf(workDate);
    await assertOpen(month);
    const row = await prisma.labor.create({
      data: { ...req.body, workDate: toISO(workDate), settleMonth: month, createdById: req.appUser?.id ?? null },
    });
    await rememberCodes([['작업자', req.body.workerName]]);
    res.status(201).json(row);
  } catch (e) {
    fail(res, e);
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const body = { ...req.body };
    delete body.id;
    delete body.project;
    delete body.employee;
    delete body.attachments;

    const existing = await prisma.labor.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'not found' });
    await assertOpen(existing.settleMonth);
    if (body.workDate) await assertOpen(monthOf(body.workDate));

    const row = await prisma.labor.update({
      where: { id: req.params.id },
      data: {
        ...body,
        ...(body.workDate ? { workDate: toISO(body.workDate), settleMonth: monthOf(body.workDate) } : {}),
      },
    });
    await rememberCodes([['작업자', req.body.workerName]]);
    res.json(row);
  } catch (e) {
    fail(res, e);
  }
});

// 이름만 적혀 있던 지난 자료를 임직원에 붙인다. 붙고 나면 달력에서 고칠 수 있다.
// 관리자만 한다 — 누구의 공수인지 바꾸는 일이기 때문이다.
router.put('/link', requireAdmin, async (req, res) => {
  try {
    const { workerName, employeeId, month } = req.body ?? {};
    if (!workerName || !employeeId) return res.status(400).json({ error: 'workerName, employeeId는 필수입니다.' });

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ error: '임직원을 찾을 수 없습니다.' });

    const { count } = await prisma.labor.updateMany({
      where: {
        workerName,
        employeeId: null,
        ...(month && MONTH.test(month) ? { settleMonth: month } : {}),
      },
      data: { employeeId, workerName: employee.name, workerType: employee.employmentType ?? undefined },
    });
    res.json({ count });
  } catch (e) {
    fail(res, e);
  }
});

// 지우는 것은 관리자만 한다. 지운 공수는 되돌릴 수 없고 셀카도 함께 사라진다.
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const existing = await prisma.labor.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'not found' });
    await assertOpen(existing.settleMonth);
    // 사진을 먼저 치운다. 줄이 사라지면 사진을 찾아갈 길이 없어진다.
    await purgeLaborSelfies(existing.id);
    await prisma.labor.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) {
    fail(res, e);
  }
});

export default router;
