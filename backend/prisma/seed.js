// 데모 데이터 — 화면·집계·보고서를 실제로 눌러 보기 위한 표본.
// 이름·품목·금액은 원본 자료(원방_거래처별 스크랩 출고 현황_Sample.xlsx, 대표이사 손익보고)에서 따왔다.
//
//   node prisma/seed.js          데모 데이터 적재
//   node prisma/seed.js --clear  데모 데이터 삭제(아래에 정의된 것만)
//
// 지우기 기준을 이름으로 잡아 두었으므로, 실제 업무 데이터와 이름이 겹치지 않게 관리한다.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PROJECT_NAMES = ['포스코_KM_안산', '동우PL1린텍_크로스_평택', '삼성전자_이텍솔루션_안성'];
const VENDOR_NAMES = ['세화철강', '대신에스티에스', '다옴금속', '다문산업', '투플러스', '주원', '도솔환경산업', '케이엠티엘에스', '크로스특수', '포스코'];
const ITEMS = [
  { itemCode: 'FE-01', category: 'FE', itemName: '고철', basePrice: 490 },
  { itemCode: 'STS-304', category: 'STS', itemName: 'STS304', basePrice: 2050 },
  { itemCode: 'AL-01', category: 'AL', itemName: '알루미늄', basePrice: 4400 },
  { itemCode: 'CU-01', category: 'CU', itemName: '전선(구리)', basePrice: 8900 },
  { itemCode: 'W-PANEL', category: '폐기물', itemName: '폐판넬', basePrice: 50 },
  { itemCode: 'W-CONC', category: '폐기물', itemName: '폐콘크리트', basePrice: 20 },
  { itemCode: 'W-SYN', category: '폐기물', itemName: '폐합성수지', basePrice: 170 },
];
const EMPLOYEES = ['김태정', '이민수', '박기술', '최안전'];
const WORKERS = ['정해철', '오상근', '한민규', '서동일'];
const ASSET_NOS = ['V-2026-901', 'V-2026-902', 'E-2026-901'];

const day = (offset) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - offset);
  return d;
};
const iso = (d) => d.toISOString();
// 날짜별로 물량이 달라야 추이·농도 그래프가 의미를 갖는다.
const wave = (i, base, amp) => Math.round(base + Math.sin(i / 2.3) * amp + (i % 3) * amp * 0.2);

async function clear() {
  const projects = await prisma.project.findMany({ where: { roundName: { in: PROJECT_NAMES } } });
  const projectIds = projects.map((p) => p.id);

  if (projectIds.length) {
    await prisma.inventoryLedger.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.report.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.attachment.deleteMany({
      where: { OR: [{ inbound: { projectId: { in: projectIds } } }, { outboundSale: { projectId: { in: projectIds } } }] },
    });
    await prisma.sorting.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.outboundSale.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.wasteOutbound.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.inbound.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.wasteInbound.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.transport.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.labor.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.workerAttendance.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.itemPriceHistory.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  }

  await prisma.worker.deleteMany({ where: { name: { in: WORKERS } } });

  const assets = await prisma.asset.findMany({ where: { assetNo: { in: ASSET_NOS } } });
  const assetIds = assets.map((a) => a.id);
  if (assetIds.length) {
    await prisma.assetMaintenance.deleteMany({ where: { assetId: { in: assetIds } } });
    await prisma.assetMovement.deleteMany({ where: { assetId: { in: assetIds } } });
    await prisma.assetSchedule.deleteMany({ where: { assetId: { in: assetIds } } });
    await prisma.assetVehicle.deleteMany({ where: { assetId: { in: assetIds } } });
    await prisma.assetEquipment.deleteMany({ where: { assetId: { in: assetIds } } });
    await prisma.asset.deleteMany({ where: { id: { in: assetIds } } });
  }

  const employees = await prisma.employee.findMany({ where: { name: { in: EMPLOYEES } } });
  const employeeIds = employees.map((e) => e.id);
  if (employeeIds.length) {
    await prisma.employeeCertification.deleteMany({ where: { employeeId: { in: employeeIds } } });
    await prisma.employeeTraining.deleteMany({ where: { employeeId: { in: employeeIds } } });
    await prisma.employee.deleteMany({ where: { id: { in: employeeIds } } });
  }

  await prisma.itemPriceHistory.deleteMany({ where: { itemCode: { in: ITEMS.map((i) => i.itemCode) } } });
  await prisma.itemMaster.deleteMany({ where: { itemCode: { in: ITEMS.map((i) => i.itemCode) } } });
  await prisma.vendor.deleteMany({ where: { name: { in: VENDOR_NAMES } } });

  console.log('데모 데이터를 삭제했습니다.');
}

async function seed() {
  // ── 기준정보 ──
  const vendors = {};
  for (const name of VENDOR_NAMES) {
    vendors[name] =
      (await prisma.vendor.findFirst({ where: { name } })) ??
      (await prisma.vendor.create({ data: { name, vendorType: name.includes('환경') || name === '투플러스' || name === '주원' ? '폐기물업체' : '매각처' } }));
  }

  for (const item of ITEMS) {
    await prisma.itemMaster.upsert({ where: { itemCode: item.itemCode }, update: {}, create: item });
  }
  await prisma.itemMaster.upsert({
    where: { itemCode: 'UNCLASSIFIED' },
    update: {},
    create: { itemCode: 'UNCLASSIFIED', category: '미분류', itemName: '미분류' },
  });

  // ── 임직원 (자격 만료·교육 예정이 알림에 걸리도록 날짜를 흩뿌린다) ──
  const employees = {};
  const empSpec = [
    { name: '김태정', phone: '010-3311-8084', department: '운영팀', position: '반장', cert: ['지게차운전기능사', 12], training: ['산업안전보건교육', '의무', 20] },
    { name: '이민수', phone: '010-9992-4447', department: '운영팀', position: '기사', cert: ['대형면허', -5], training: ['폐기물처리교육', '보수', 95] },
    { name: '박기술', phone: '010-2211-3344', department: '기술팀', position: '과장', cert: ['폐기물처리기사', 200], training: ['산업안전보건교육', '의무', 5] },
    { name: '최안전', phone: '010-7788-1122', department: '안전팀', position: '대리', cert: ['산업안전기사', 45], training: ['관리감독자교육', '의무', 210] },
  ];
  for (const [idx, e] of empSpec.entries()) {
    employees[e.name] =
      (await prisma.employee.findFirst({ where: { name: e.name } })) ??
      (await prisma.employee.create({
        data: {
          empCode: `EMP-2026-9${String(idx + 1).padStart(2, '0')}`,
          name: e.name,
          phone: e.phone,
          department: e.department,
          position: e.position,
          hireDate: iso(day(600 + idx * 90)),
          certifications: {
            create: [{ certName: e.cert[0], acquiredDate: iso(day(700)), expiryDate: iso(day(-e.cert[1])) }],
          },
          trainings: {
            create: [
              {
                trainingName: e.training[0],
                trainingType: e.training[1],
                trainingDate: iso(day(360 - e.training[2])),
                cycleMonths: 12,
                nextDueDate: iso(day(-e.training[2])),
              },
            ],
          },
        },
      }));
  }

  // ── 프로젝트 ──
  const projects = {};
  const projSpec = [
    { name: PROJECT_NAMES[0], roundNo: '26-1차', orderer: '포스코', contractor: '케이엠티엘에스', site: '안산', region: '경기 안산', purchase: 141_400_000, contract: 180_000_000, weight: 130_000, start: 120, end: -60 },
    { name: PROJECT_NAMES[1], roundNo: '26-2차', orderer: null, contractor: '크로스특수', site: '평택', region: '경기 평택', purchase: 62_000_000, contract: 80_000_000, weight: 60_000, start: 80, end: -30 },
    { name: PROJECT_NAMES[2], roundNo: '26-3차', orderer: null, contractor: '크로스특수', site: '안성', region: '경기 안성', purchase: 38_000_000, contract: 45_000_000, weight: 30_000, start: 40, end: -90 },
  ];
  for (const [idx, p] of projSpec.entries()) {
    projects[p.name] =
      (await prisma.project.findFirst({ where: { roundName: p.name } })) ??
      (await prisma.project.create({
        data: {
          projectCode: `P-2026-9${String(idx + 1).padStart(2, '0')}`,
          roundName: p.name,
          roundNo: p.roundNo,
          ordererId: p.orderer ? vendors[p.orderer].id : null,
          contractorId: p.contractor ? vendors[p.contractor].id : null,
          buyerId: vendors['세화철강'].id,
          siteName: p.site,
          region: p.region,
          dischargerName: p.contractor,
          contractAmount: p.contract,
          purchasePrice: p.purchase,
          contractWeight: p.weight,
          settlementCycle: '월별',
          managerEmpId: employees['박기술'].id,
          startDate: iso(day(p.start)),
          endDate: iso(day(p.end)),
          status: '진행',
        },
      }));
  }

  // ── 자산 (차량 2 / 장비 1) ──
  const assetSpec = [
    { assetNo: ASSET_NOS[0], type: 'VEHICLE', name: '암롤트럭 86노1445', category: '화물', plate: '86노1445', vType: '화물', fuel: '경유', insurance: 25, inspection: 70 },
    { assetNo: ASSET_NOS[1], type: 'VEHICLE', name: '집게차 96거5789', category: '특수', plate: '96거5789', vType: '특수', fuel: '경유', insurance: 120, inspection: -10 },
    { assetNo: ASSET_NOS[2], type: 'EQUIPMENT', name: '지게차 3톤', category: '지게차', spec: '3.0t', power: '엔진', cycle: 6, inspection: 15 },
  ];
  const assets = {};
  for (const a of assetSpec) {
    const existing = await prisma.asset.findUnique({ where: { assetNo: a.assetNo } });
    if (existing) {
      assets[a.assetNo] = existing;
      continue;
    }
    assets[a.assetNo] = await prisma.asset.create({
      data: {
        assetNo: a.assetNo,
        assetType: a.type,
        category: a.category,
        name: a.name,
        ownerDept: '운영팀',
        managerEmpId: employees['김태정'].id,
        location: '원방 야적장',
        ownershipType: '자가',
        acquiredAt: iso(day(900)),
        acquireCost: a.type === 'VEHICLE' ? 85_000_000 : 32_000_000,
        usefulLifeMonth: 60,
        status: '가용',
        ...(a.type === 'VEHICLE'
          ? {
              vehicle: {
                create: {
                  plateNo: a.plate,
                  vehicleType: a.vType,
                  fuelType: a.fuel,
                  yearModel: '2021',
                  currentMileage: 128_400,
                  insuranceCompany: 'DB손해보험',
                  insuranceEnd: iso(day(-a.insurance)),
                  inspectionNext: iso(day(-a.inspection)),
                },
              },
              schedules: {
                create: [
                  { scheduleType: '보험만료', dueDate: iso(day(-a.insurance)) },
                  { scheduleType: '정기검사', dueDate: iso(day(-a.inspection)) },
                ],
              },
            }
          : {
              equipment: {
                create: {
                  spec: a.spec,
                  powerType: a.power,
                  requiresLicense: true,
                  licenseType: '지게차운전기능사',
                  isLegalInspection: true,
                  inspectionCycleMonth: a.cycle,
                  inspectionNext: iso(day(-a.inspection)),
                },
              },
              schedules: { create: [{ scheduleType: '정기점검', dueDate: iso(day(-a.inspection)) }] },
            }),
        maintenances: {
          create: [
            {
              maintType: '정기점검',
              vendorId: vendors['크로스특수'].id,
              requestedAt: iso(day(45)),
              completedAt: iso(day(43)),
              mileageAt: 126_000,
              symptom: '정기 점검',
              action: '엔진오일·필터 교체',
              parts: '엔진오일, 오일필터',
              cost: 320_000,
              status: '완료',
            },
          ],
        },
        movements: {
          create: [{ moveDate: iso(day(30)), fromSite: '원방 야적장', toSite: '안산 현장' }],
        },
      },
    });
  }

  // ── 물량 트랜잭션 ──
  const itemPool = ['FE-01', 'STS-304', 'AL-01', 'CU-01'];
  const wastePool = ['W-PANEL', 'W-CONC', 'W-SYN'];
  const salePartners = ['세화철강', '대신에스티에스', '다옴금속', '다문산업'];
  const wastePartners = ['투플러스', '주원', '도솔환경산업'];

  let inboundCount = 0;
  for (let i = 0; i < 45; i += 1) {
    const project = projects[PROJECT_NAMES[i % 3]];
    const d = day(60 - Math.floor(i * 1.3));
    const itemCode = itemPool[i % itemPool.length];
    const gross = wave(i, 24_000, 4_000);
    const tare = 13_500;
    const net = gross - tare;

    const inbound = await prisma.inbound.create({
      data: {
        projectId: project.id,
        inboundDate: iso(d),
        unloadingPoint: '원방',
        vehicleType: i % 2 ? '암롤트럭' : '집게차',
        vehicleNo: i % 2 ? '86노1445' : '96거5789',
        driverName: i % 2 ? '김태정' : '이민수',
        driverPhone: i % 2 ? '010-3311-8084' : '010-9992-4447',
        itemCode,
        grossWeight: gross,
        tareWeight: tare,
        netWeight: net,
        stockWeight: net,
      },
    });
    await prisma.inventoryLedger.create({
      data: { projectId: project.id, itemCode, direction: 'IN', weight: net, ledgerDate: iso(d), refType: 'inbound', refId: inbound.id },
    });
    inboundCount += 1;
  }

  let wasteInCount = 0;
  for (let i = 0; i < 14; i += 1) {
    const project = projects[PROJECT_NAMES[i % 3]];
    const d = day(58 - i * 4);
    const itemCode = wastePool[i % wastePool.length];
    const gross = wave(i, 20_000, 3_000);
    const tare = 13_800;
    const net = gross - tare;

    const wi = await prisma.wasteInbound.create({
      data: {
        projectId: project.id,
        receiveDate: iso(d),
        handoverDate: iso(d),
        olbaroReported: i % 4 !== 0,
        dischargerName: '크로스특수',
        unloadingPoint: '투플러스',
        vehicleType: '집게차',
        vehicleNo: '96거5789',
        driverName: '이민수',
        driverPhone: '010-9992-4447',
        itemCode,
        grossWeight: gross,
        tareWeight: tare,
        netWeight: net,
      },
    });
    await prisma.inventoryLedger.create({
      data: { projectId: project.id, itemCode, direction: 'IN', weight: net, ledgerDate: iso(d), refType: 'waste_inbound', refId: wi.id },
    });
    wasteInCount += 1;
  }

  let saleCount = 0;
  for (let i = 0; i < 32; i += 1) {
    const project = projects[PROJECT_NAMES[i % 3]];
    const d = day(55 - Math.floor(i * 1.7));
    const itemCode = itemPool[i % itemPool.length];
    const item = ITEMS.find((x) => x.itemCode === itemCode);
    const gross = wave(i, 21_000, 3_500);
    const tare = 13_200;
    const settled = gross - tare;
    const amount = settled * item.basePrice;
    const buyer = vendors[salePartners[i % salePartners.length]];

    const sale = await prisma.outboundSale.create({
      data: {
        projectId: project.id,
        itemCode,
        outboundDate: iso(d),
        buyerId: buyer.id,
        loadingPoint: '원방',
        vehicleType: '집게차',
        vehicleNo: '96거5789',
        driverName: '김태정',
        driverPhone: '010-3311-8084',
        unitPrice: item.basePrice,
        grossWeight: gross,
        tareWeight: tare,
        actualWeight: settled,
        settledWeight: settled,
        stockWeight: settled,
        amount,
        vatAmount: Math.round(amount * 0.1),
        category: '출고',
        taxInvoiceIssued: i % 3 === 0,
        isPaid: i % 4 === 0,
        paidDate: i % 4 === 0 ? iso(d) : null,
      },
    });
    await prisma.inventoryLedger.create({
      data: { projectId: project.id, itemCode, direction: 'OUT', weight: settled, ledgerDate: iso(d), refType: 'outbound_sale', refId: sale.id },
    });
    saleCount += 1;
  }

  let wasteOutCount = 0;
  for (let i = 0; i < 12; i += 1) {
    const project = projects[PROJECT_NAMES[i % 3]];
    const d = day(50 - i * 4);
    const itemCode = wastePool[i % wastePool.length];
    const item = ITEMS.find((x) => x.itemCode === itemCode);
    const gross = wave(i, 19_000, 2_500);
    const tare = 13_600;
    const settled = gross - tare;
    const buyer = vendors[wastePartners[i % wastePartners.length]];

    const wo = await prisma.wasteOutbound.create({
      data: {
        projectId: project.id,
        outboundDate: iso(d),
        handoverDate: iso(d),
        olbaroReported: i % 3 !== 0,
        buyerId: buyer.id,
        itemCode,
        dischargerName: '크로스특수',
        transporterName: '원방',
        loadingPoint: '현장',
        vehicleType: '암롤트럭',
        vehicleNo: '86노1445',
        driverName: '이민수',
        driverPhone: '010-9992-4447',
        grossWeight: gross,
        tareWeight: tare,
        actualWeight: settled,
        weight: settled,
        unitPrice: item.basePrice,
        amount: settled * item.basePrice,
        category: '출고',
      },
    });
    await prisma.inventoryLedger.create({
      data: { projectId: project.id, itemCode, direction: 'OUT', weight: settled, ledgerDate: iso(d), refType: 'waste_outbound', refId: wo.id },
    });
    wasteOutCount += 1;
  }

  // ── 선별(재분류) — 재고를 늘리지 않고 품목만 바꾼다(OUT + IN) ──
  let sortingCount = 0;
  for (let i = 0; i < 9; i += 1) {
    const project = projects[PROJECT_NAMES[i % 3]];
    const d = day(48 - i * 5);
    const sourceItemCode = 'FE-01';
    const itemCode = ['STS-304', 'AL-01', 'CU-01'][i % 3];
    const weight = wave(i, 3_000, 800);

    const sorting = await prisma.sorting.create({
      data: { projectId: project.id, sortDate: iso(d), sourceItemCode, itemCode, sortWeight: weight },
    });
    await prisma.inventoryLedger.createMany({
      data: [
        { projectId: project.id, itemCode: sourceItemCode, direction: 'OUT', weight, ledgerDate: iso(d), refType: 'sorting', refId: sorting.id },
        { projectId: project.id, itemCode, direction: 'IN', weight, ledgerDate: iso(d), refType: 'sorting', refId: sorting.id },
      ],
    });
    sortingCount += 1;
  }

  // ── 품목 추정단가 이력 — 재고평가 단가의 근거 ──
  for (const item of ITEMS) {
    await prisma.itemPriceHistory.create({
      data: { itemCode: item.itemCode, price: item.basePrice, effectiveDate: iso(day(60)) },
    });
    await prisma.itemPriceHistory.create({
      data: { itemCode: item.itemCode, price: Math.round(item.basePrice * 1.05), effectiveDate: iso(day(20)) },
    });
  }

  // ── 작업자·출역 (공수) ──
  const workers = {};
  for (const [idx, name] of WORKERS.entries()) {
    workers[name] =
      (await prisma.worker.findFirst({ where: { name } })) ??
      (await prisma.worker.create({
        data: { name, affiliation: idx % 2 ? '직영' : '본사', dailyWage: 220_000 },
      }));
  }
  for (let i = 0; i < 24; i += 1) {
    const project = projects[PROJECT_NAMES[i % 3]];
    await prisma.workerAttendance.create({
      data: {
        projectId: project.id,
        workerId: workers[WORKERS[i % WORKERS.length]].id,
        workDate: iso(day(40 - i)),
        manDays: i % 4 === 0 ? 0.5 : 1,
      },
    });
  }

  // ── 비용 ──
  for (let i = 0; i < 12; i += 1) {
    const project = projects[PROJECT_NAMES[i % 3]];
    const d = day(50 - i * 4);
    await prisma.transport.create({
      data: {
        projectId: project.id,
        transportDate: iso(d),
        vehicleNo: '86노1445',
        vehicleType: '암롤트럭',
        weight: 20_000,
        origin: '현장',
        destination: '원방',
        supplyAmount: 450_000,
        taxAmount: 45_000,
      },
    });
    await prisma.labor.create({
      data: {
        projectId: project.id,
        workDate: iso(d),
        totalManDays: 6,
        laborCost: 1_320_000,
        mealCost: 60_000,
        fuelCost: 180_000,
        totalAmount: 1_560_000,
      },
    });
  }

  // ── 보고서 — 보관함에서 바로 열어 볼 수 있게 며칠치를 발행해 둔다 ──
  const { buildDailyReport, buildPnlReport } = await import('../src/lib/reportBuilder.js');
  const { queryLedger } = await import('../src/lib/ledgerQuery.js');
  const { getProjectPnl } = await import('../src/lib/pnl.js');

  let reportCount = 0;
  for (const offset of [1, 3, 7]) {
    const date = day(offset).toISOString().slice(0, 10);
    const rows = await queryLedger({ from: date, to: date });
    const outboundRows = rows.filter((r) => r.type === 'outbound_sale' || r.type === 'waste_outbound');
    const groups = Object.values(projects).map((p) => ({
      projectId: p.id,
      projectName: p.roundName,
      siteName: p.siteName ?? null,
      rows: outboundRows.filter((r) => r.projectId === p.id),
    }));
    const built = buildDailyReport({ date, groups });
    await prisma.report.create({
      data: {
        reportType: 'daily',
        projectId: projects[PROJECT_NAMES[0]].id,
        reportDate: iso(day(offset)),
        title: built.title,
        content: built.content,
        summary: built.summary,
        payload: { date, groups, summary: built.summary },
      },
    });
    reportCount += 1;
  }

  for (const name of PROJECT_NAMES) {
    const pnl = await getProjectPnl(projects[name].id);
    const reportDate = day(0).toISOString().slice(0, 10);
    const built = buildPnlReport(pnl, { reportDate });
    await prisma.report.create({
      data: {
        reportType: 'pnl',
        projectId: projects[name].id,
        reportDate: iso(day(0)),
        title: built.title,
        content: built.content,
        summary: built.summary,
        payload: { ...pnl, reportDate },
      },
    });
    reportCount += 1;
  }

  console.log('데모 데이터를 적재했습니다.');
  console.table({
    프로젝트: PROJECT_NAMES.length,
    거래처: VENDOR_NAMES.length,
    품목: ITEMS.length,
    임직원: EMPLOYEES.length,
    작업자: WORKERS.length,
    자산: ASSET_NOS.length,
    입고: inboundCount,
    폐기물입고: wasteInCount,
    선별: sortingCount,
    매각: saleCount,
    폐기물반출: wasteOutCount,
    보고서: reportCount,
  });
}

const mode = process.argv.includes('--clear') ? 'clear' : 'seed';

try {
  if (mode === 'clear') await clear();
  else await seed();
} catch (err) {
  console.error('실패:', err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
