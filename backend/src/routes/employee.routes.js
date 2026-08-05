import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { toISO } from '../lib/date.js';

const router = Router();

// 사번 자동 채번 — EMP-{연도}-{3자리 일련번호}. 근태 QR이 이 값을 담는다.
async function nextEmpCode(tx, hireDate) {
  const year = String(new Date(hireDate ?? Date.now()).getFullYear());
  const prefix = `EMP-${year}-`;
  const last = await tx.employee.findFirst({
    where: { empCode: { startsWith: prefix } },
    orderBy: { empCode: 'desc' },
    select: { empCode: true },
  });
  const seq = last ? Number(last.empCode.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

// 다음 교육 예정일 = 이수일 + 주기(개월). 직접 입력한 예정일이 있으면 그 값을 우선한다.
function resolveNextDue({ nextDueDate, trainingDate, cycleMonths }) {
  if (nextDueDate) return toISO(nextDueDate);
  if (!trainingDate || !cycleMonths) return undefined;
  const due = new Date(trainingDate);
  due.setMonth(due.getMonth() + Number(cycleMonths));
  return due.toISOString();
}

router.get('/', async (req, res) => {
  const employees = await prisma.employee.findMany({
    orderBy: { name: 'asc' },
    include: { certifications: { orderBy: { expiryDate: 'asc' } }, trainings: { orderBy: { trainingDate: 'desc' } } },
  });
  res.json(employees);
});

router.get('/:id', async (req, res) => {
  const employee = await prisma.employee.findUnique({
    where: { id: req.params.id },
    include: {
      certifications: { orderBy: [{ expiryDate: 'desc' }, { acquiredDate: 'desc' }] },
      trainings: { orderBy: [{ nextDueDate: 'desc' }, { trainingDate: 'desc' }] },
    },
  });
  if (!employee) return res.status(404).json({ error: '임직원을 찾을 수 없습니다.' });
  res.json(employee);
});

// 임직원 등록 시 자격사항·교육이력을 함께 받는다(certifications / trainings 배열).
router.post('/', async (req, res) => {
  const { name, certifications, trainings, ...rest } = req.body;
  if (!name) return res.status(400).json({ error: 'name은 필수입니다.' });

  const certRows = (certifications ?? []).filter((c) => c?.certName);
  const trainingRows = (trainings ?? []).filter((t) => t?.trainingName);

  const employee = await prisma.$transaction(async (tx) =>
    tx.employee.create({
      data: {
        ...rest,
        name,
        empCode: rest.empCode || (await nextEmpCode(tx, rest.hireDate)),
        hireDate: toISO(rest.hireDate),
        ...(certRows.length
          ? {
              certifications: {
                create: certRows.map((c) => ({
                  certName: c.certName,
                  certType: c.certType || null,
                  acquiredDate: toISO(c.acquiredDate),
                  expiryDate: toISO(c.expiryDate),
                })),
              },
            }
          : {}),
        ...(trainingRows.length
          ? {
              trainings: {
                create: trainingRows.map((t) => ({
                  trainingName: t.trainingName,
                  trainingType: t.trainingType,
                  trainingDate: toISO(t.trainingDate),
                  cycleMonths: t.cycleMonths ? Number(t.cycleMonths) : undefined,
                  nextDueDate: resolveNextDue(t),
                })),
              },
            }
          : {}),
      },
      include: { certifications: true, trainings: true },
    }),
  );
  res.status(201).json(employee);
});

// 기본정보 수정. 사번(empCode)은 근태 QR 식별자로 쓰이므로 바꾸지 않는다.
// 보낸 항목만 반영해, 일부만 고쳐도 나머지가 지워지지 않게 한다.
router.patch('/:id', async (req, res) => {
  const { name, phone, department, position, hireDate } = req.body;
  if (name !== undefined && !String(name).trim()) {
    return res.status(400).json({ error: '성명은 비울 수 없습니다.' });
  }

  const employee = await prisma.employee.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(phone !== undefined ? { phone: phone || null } : {}),
      ...(department !== undefined ? { department: department || null } : {}),
      ...(position !== undefined ? { position: position || null } : {}),
      ...(hireDate !== undefined ? { hireDate: toISO(hireDate) } : {}),
    },
    include: {
      certifications: { orderBy: [{ expiryDate: 'desc' }, { acquiredDate: 'desc' }] },
      trainings: { orderBy: [{ nextDueDate: 'desc' }, { trainingDate: 'desc' }] },
    },
  });
  res.json(employee);
});

// 임직원 삭제 — 자격/교육 이력을 함께 지우고, 자산 책임자 지정은 비운다.
router.delete('/:id', async (req, res) => {
  const deleted = await prisma.$transaction(async (tx) => {
    await tx.employeeCertification.deleteMany({ where: { employeeId: req.params.id } });
    await tx.employeeTraining.deleteMany({ where: { employeeId: req.params.id } });
    await tx.asset.updateMany({ where: { managerEmpId: req.params.id }, data: { managerEmpId: null } });
    return tx.employee.delete({ where: { id: req.params.id } });
  });
  res.json(deleted);
});

// 이력 행 오타 정정. 갱신은 새 행으로 쌓는 것이 원칙이고, 이 경로는 잘못 적은 값을 고치는 용도다.
router.patch('/:id/certifications/:certId', async (req, res) => {
  const { certName, certType, acquiredDate, expiryDate } = req.body;
  if (certName !== undefined && !String(certName).trim()) {
    return res.status(400).json({ error: '자격증명은 비울 수 없습니다.' });
  }

  const cert = await prisma.employeeCertification.update({
    where: { id: req.params.certId },
    data: {
      ...(certName !== undefined ? { certName } : {}),
      ...(certType !== undefined ? { certType: certType || null } : {}),
      ...(acquiredDate !== undefined ? { acquiredDate: toISO(acquiredDate) } : {}),
      ...(expiryDate !== undefined ? { expiryDate: toISO(expiryDate) } : {}),
    },
  });
  res.json(cert);
});

router.patch('/:id/trainings/:trainingId', async (req, res) => {
  const { trainingName, trainingType, trainingDate, cycleMonths, nextDueDate } = req.body;
  if (trainingName !== undefined && !String(trainingName).trim()) {
    return res.status(400).json({ error: '교육명은 비울 수 없습니다.' });
  }

  const current = await prisma.employeeTraining.findUnique({ where: { id: req.params.trainingId } });
  if (!current) return res.status(404).json({ error: '교육 이력을 찾을 수 없습니다.' });

  // 이수일이나 주기를 고쳤는데 예정일을 직접 주지 않았다면 다시 계산한다.
  const resolvedDue = resolveNextDue({
    nextDueDate,
    trainingDate: trainingDate ?? current.trainingDate,
    cycleMonths: cycleMonths ?? current.cycleMonths,
  });

  const training = await prisma.employeeTraining.update({
    where: { id: req.params.trainingId },
    data: {
      ...(trainingName !== undefined ? { trainingName } : {}),
      ...(trainingType !== undefined ? { trainingType: trainingType || null } : {}),
      ...(trainingDate !== undefined ? { trainingDate: toISO(trainingDate) } : {}),
      ...(cycleMonths !== undefined ? { cycleMonths: cycleMonths ? Number(cycleMonths) : null } : {}),
      ...(resolvedDue !== undefined ? { nextDueDate: resolvedDue } : {}),
    },
  });
  res.json(training);
});

router.delete('/:id/certifications/:certId', async (req, res) => {
  const deleted = await prisma.employeeCertification.delete({ where: { id: req.params.certId } });
  res.json(deleted);
});

router.delete('/:id/trainings/:trainingId', async (req, res) => {
  const deleted = await prisma.employeeTraining.delete({ where: { id: req.params.trainingId } });
  res.json(deleted);
});

router.post('/:id/certifications', async (req, res) => {
  const { certName } = req.body;
  if (!certName) return res.status(400).json({ error: 'certName은 필수입니다.' });
  const cert = await prisma.employeeCertification.create({
    data: {
      ...req.body,
      employeeId: req.params.id,
      acquiredDate: toISO(req.body.acquiredDate),
      expiryDate: toISO(req.body.expiryDate),
    },
  });
  res.status(201).json(cert);
});

router.get('/:id/certifications', async (req, res) => {
  const certs = await prisma.employeeCertification.findMany({
    where: { employeeId: req.params.id },
    orderBy: { expiryDate: 'asc' },
  });
  res.json(certs);
});

router.post('/:id/trainings', async (req, res) => {
  const { trainingName } = req.body;
  if (!trainingName) return res.status(400).json({ error: 'trainingName은 필수입니다.' });
  const training = await prisma.employeeTraining.create({
    data: {
      ...req.body,
      employeeId: req.params.id,
      trainingDate: toISO(req.body.trainingDate),
      cycleMonths: req.body.cycleMonths ? Number(req.body.cycleMonths) : undefined,
      nextDueDate: resolveNextDue(req.body),
    },
  });
  res.status(201).json(training);
});

router.get('/:id/trainings', async (req, res) => {
  const trainings = await prisma.employeeTraining.findMany({
    where: { employeeId: req.params.id },
    orderBy: { trainingDate: 'desc' },
  });
  res.json(trainings);
});

export default router;
