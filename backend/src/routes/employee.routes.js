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
