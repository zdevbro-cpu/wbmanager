/**
 * 시범운영 자료 정리 — 한시적 (2026-10-23 합의)
 *
 * 시범운영(~2026-12-31) 동안 쌓이는 시험 자료를 마스터만 남기고 비운다.
 * 기간 중 두세 번 더 쓸 수 있어 남겨 두지만, 상시 기능은 아니다 —
 * 화면에 단추를 만들지 않았고, 2027-01-01 실운영이 시작되면 스스로 막힌다.
 * 그날 전에 이 파일과 짝이 되는 워크플로를 지운다.
 *
 * 쓰는 법
 *   node scripts/one-off-clear-operational-data.mjs                      미리보기(기본)
 *   node scripts/one-off-clear-operational-data.mjs --profile=full       미리보기(자산까지)
 *   node scripts/one-off-clear-operational-data.mjs --execute --confirm=초기화
 *
 * 묶음
 *   standard  거래처 · 품목 · 공통코드 · 문서분류 · 임직원 · 사용자 · 권한 ·
 *             근로자 · 외부기사 · 자산 · 차량을 남긴다.
 *   full      위에서 자산 · 차량까지 비운다(관리대장으로 새로 넣을 때).
 */
import { PrismaClient } from '@prisma/client';
import { trashInDrive } from '../src/lib/drive.js';

const prisma = new PrismaClient();
const arg = (name, fallback = null) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const has = (name) => process.argv.includes(`--${name}`);

// 시범운영 기간에만 쓴다. 2027-01-01 실운영이 시작되면 스스로 막는다.
// 그날 이후에는 이 파일과 .github/workflows/one-off-clear-data.yml 을 지운다.
const EXPIRES = '2027-01-01'; // 한국 시각 기준, 이 날짜부터 거부
const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const daysLeft = () => Math.ceil((new Date(`${EXPIRES}T00:00:00Z`) - new Date(`${kstToday()}T00:00:00Z`)) / 86400000);

const profile = arg('profile', 'standard');
const execute = has('execute');
const confirm = arg('confirm');
// 구글 드라이브의 파일도 휴지통으로 보낸다. --keep-drive 를 주면 파일은 그대로 둔다.
const trashDrive = !has('keep-drive');

if (!['standard', 'full'].includes(profile)) {
  console.error(`알 수 없는 묶음: ${profile} (standard 또는 full)`);
  process.exit(1);
}

// 남기는 것 — 여기 없는 표는 모두 비운다.
const KEEP = [
  '거래처(vendor)',
  '품목(item_master)',
  '공통코드(common_code)',
  '문서분류(document_type)',
  '임직원(employee · 자격 · 교육)',
  '사용자 계정(app_user)',
  '권한(permission · permission_screen)',
  '근로자(worker)',
  '외부 기사(external_driver)',
  '시세(market_rate)',
  '단가 설정(price_setting)',
  ...(profile === 'standard' ? ['자산(asset 및 이력)', '차량(vehicle 및 이력)'] : []),
];

// 지우는 순서 — 참조하는 쪽이 먼저다. 순서를 어기면 외래키에 걸려 멈춘다.
// [표시이름, 지우는 함수]
const steps = (tx, keepAssets) => {
  // 자산·차량을 남길 때는 거기 붙은 증빙도 남긴다.
  const attachmentWhere = keepAssets
    ? { assetId: null, assetMaintenanceId: null, vehicleId: null, vehicleMaintenanceId: null }
    : {};

  const base = [
    ['재고원장', () => tx.inventoryLedger.deleteMany({})],
    ['운반비', () => tx.transport.deleteMany({})],
    ['증빙 파일 기록', () => tx.attachment.deleteMany({ where: attachmentWhere })],
    ['문서 첨부', () => tx.documentAttachment.deleteMany({})],
    ['문서 연결', () => tx.documentLink.deleteMany({})],
    ['문서 판(버전)', () => tx.documentVersion.deleteMany({})],
    ['문서', () => tx.document.deleteMany({})],
    ['발행 보고서', () => tx.report.deleteMany({})],
    ['선별', () => tx.sorting.deleteMany({})],
    ['재고 보정', () => tx.inventoryAdjust.deleteMany({})],
    ['이동', () => tx.inventoryMove.deleteMany({})],
    ['출고', () => tx.outboundSale.deleteMany({})],
    ['폐기물 반출', () => tx.wasteOutbound.deleteMany({})],
    ['폐기물 수집', () => tx.wasteInbound.deleteMany({})],
    ['입고', () => tx.inbound.deleteMany({})],
    ['공수 수정이력', () => tx.laborEdit.deleteMany({})],
    ['공수', () => tx.labor.deleteMany({})],
    ['공수 계획', () => tx.laborPlan.deleteMany({})],
    ['공수 마감', () => tx.laborSettlement.deleteMany({})],
    ['근로자 출퇴근', () => tx.workerAttendance.deleteMany({})],
    ['단가 알림', () => tx.priceNotice.deleteMany({})],
    ['단가', () => tx.vendorPrice.deleteMany({})],
    ['거래처 품목', () => tx.vendorItem.deleteMany({})],
    ['프로젝트별 단가 이력', () => tx.itemPriceHistory.deleteMany({})],
    ['변경 기록', () => tx.auditLog.deleteMany({})],
    ['현장(프로젝트)', () => tx.project.deleteMany({})],
  ];

  if (keepAssets) return base;
  return [
    ...base,
    ['어태치 연결', () => tx.assetFit.deleteMany({})],
    ['자산 이동', () => tx.assetMovement.deleteMany({})],
    ['자산 정비', () => tx.assetMaintenance.deleteMany({})],
    ['자산 일정', () => tx.assetSchedule.deleteMany({})],
    ['자산 차량상세', () => tx.assetVehicle.deleteMany({})],
    ['자산 장비상세', () => tx.assetEquipment.deleteMany({})],
    ['자산', () => tx.asset.deleteMany({})],
    ['차량 이동', () => tx.vehicleMovement.deleteMany({})],
    ['차량 정비', () => tx.vehicleMaintenance.deleteMany({})],
    ['차량', () => tx.vehicle.deleteMany({})],
  ];
};

// 지울 행이 들고 있는 드라이브 파일 아이디를 모은다.
// 증빙(attachment)과 문서 판(document_version)이 파일을 들고 있다.
// 임직원 사진은 마스터라 건드리지 않는다.
async function driveFileIds(keepAssets) {
  const attachmentWhere = keepAssets
    ? { assetId: null, assetMaintenanceId: null, vehicleId: null, vehicleMaintenanceId: null }
    : {};
  const [atts, versions] = await Promise.all([
    prisma.attachment.findMany({ where: attachmentWhere, select: { driveFileId: true } }),
    prisma.documentVersion.findMany({ select: { storageKey: true } }),
  ]);
  const ids = new Set();
  for (const a of atts) if (a.driveFileId) ids.add(a.driveFileId);
  for (const v of versions) if (v.storageKey) ids.add(v.storageKey);
  return [...ids];
}

async function preview(keepAssets) {
  const attachmentWhere = keepAssets
    ? { assetId: null, assetMaintenanceId: null, vehicleId: null, vehicleMaintenanceId: null }
    : {};
  const rows = [
    ['입고', await prisma.inbound.count()],
    ['폐기물 수집', await prisma.wasteInbound.count()],
    ['출고', await prisma.outboundSale.count()],
    ['폐기물 반출', await prisma.wasteOutbound.count()],
    ['이동', await prisma.inventoryMove.count()],
    ['재고 보정', await prisma.inventoryAdjust.count()],
    ['선별', await prisma.sorting.count()],
    ['재고원장', await prisma.inventoryLedger.count()],
    ['운반비', await prisma.transport.count()],
    ['증빙 파일 기록', await prisma.attachment.count({ where: attachmentWhere })],
    ['문서', await prisma.document.count()],
    ['발행 보고서', await prisma.report.count()],
    ['공수', await prisma.labor.count()],
    ['공수 계획', await prisma.laborPlan.count()],
    ['근로자 출퇴근', await prisma.workerAttendance.count()],
    ['단가', await prisma.vendorPrice.count()],
    ['거래처 품목', await prisma.vendorItem.count()],
    ['변경 기록', await prisma.auditLog.count()],
    ['현장(프로젝트)', await prisma.project.count()],
  ];
  if (!keepAssets) {
    rows.push(['자산', await prisma.asset.count()], ['차량', await prisma.vehicle.count()]);
  }
  const keep = [
    ['거래처', await prisma.vendor.count()],
    ['품목', await prisma.itemMaster.count()],
    ['임직원', await prisma.employee.count()],
    ['사용자 계정', await prisma.appUser.count()],
    ['공통코드', await prisma.commonCode.count()],
    ['문서분류', await prisma.documentType.count()],
    ...(keepAssets ? [['자산', await prisma.asset.count()], ['차량', await prisma.vehicle.count()]] : []),
  ];
  return { rows, keep };
}

const pad = (s, n) => String(s).padEnd(n);

async function main() {
  // 기한이 지나면 미리보기조차 하지 않는다. 운영이 시작된 뒤에 남아 있을 물건이 아니다.
  if (kstToday() >= EXPIRES) {
    console.error(`\n이 작업은 ${EXPIRES}부터 쓸 수 없습니다. 시범운영 기간(~2026-12-31)에만 쓰는 1회용입니다.`);
    console.error('이 파일과 .github/workflows/one-off-clear-data.yml 을 지워 주세요.\n');
    process.exitCode = 1;
    return;
  }

  const keepAssets = profile === 'standard';
  const { rows, keep } = await preview(keepAssets);
  const total = rows.reduce((s, [, n]) => s + n, 0);

  console.log(`\n묶음: ${profile}  (${keepAssets ? '자산·차량은 남김' : '자산·차량도 비움'})`);
  console.log(`쓸 수 있는 기간: ${EXPIRES} 전까지 — 오늘 기준 ${daysLeft()}일 남음`);
  console.log('\n■ 지울 것');
  for (const [name, n] of rows) if (n) console.log('   ', pad(name, 18), String(n).padStart(7), '건');
  console.log('   ', pad('합계', 18), String(total).padStart(7), '건');

  const driveIds = await driveFileIds(keepAssets);
  console.log('   ', pad('구글 드라이브 파일', 18), String(driveIds.length).padStart(7), '개',
    trashDrive ? '(휴지통으로 보냄)' : '(--keep-drive — 그대로 둠)');

  console.log('\n■ 남길 것 (마스터)');
  for (const [name, n] of keep) console.log('   ', pad(name, 18), String(n).padStart(7), '건');
  console.log('    그 밖에', KEEP.length, '종류를 남깁니다.');

  if (!execute) {
    console.log('\n미리보기입니다. 아무것도 지우지 않았습니다.');
    console.log('정말 지우려면 --execute --confirm=초기화 를 함께 주세요.\n');
    return;
  }
  if (confirm !== '초기화') {
    console.error('\n확인 문구가 다릅니다. --confirm=초기화 가 있어야 실행합니다.\n');
    process.exitCode = 1;
    return;
  }
  // 드라이브를 비우기로 했는데 자격이 없으면 여기서 멈춘다.
  // 행을 다 지운 뒤에 알면 파일을 찾아갈 길이 없어진다.
  if (trashDrive && driveIds.length) {
    const missing = ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_REFRESH_TOKEN'].filter(
      (k) => !process.env[k],
    );
    if (missing.length) {
      console.error(`\n구글 드라이브 자격이 없습니다: ${missing.join(', ')}`);
      console.error('파일을 남겨 두려면 --keep-drive 를 주세요. 아무것도 지우지 않았습니다.\n');
      process.exitCode = 1;
      return;
    }
  }

  // 위에서 이미 모아 두었다 — 행을 지우고 나면 파일을 찾아갈 길이 없으므로 그대로 쓴다.
  console.log('\n■ 지웁니다 — 한 트랜잭션으로 돌며, 한 곳이라도 실패하면 전부 되돌립니다.');
  const done = [];
  await prisma.$transaction(
    async (tx) => {
      for (const [name, fn] of steps(tx, keepAssets)) {
        const { count } = await fn();
        if (count) done.push([name, count]);
      }
    },
    { timeout: 600000, maxWait: 30000 },
  );
  for (const [name, n] of done) console.log('   ', pad(name, 18), String(n).padStart(7), '건 지움');

  // 파일은 DB가 다 지워진 뒤에 치운다. 거꾸로 하면 DB가 되돌아가도 파일은 돌아오지 않는다.
  if (trashDrive && driveIds.length) {
    console.log(`\n■ 구글 드라이브 파일 ${driveIds.length}개를 휴지통으로 보냅니다.`);
    let ok = 0;
    const failed = [];
    for (const id of driveIds) {
      try {
        await trashInDrive(id);
        ok += 1;
        if (ok % 50 === 0) console.log('   ', ok, '개…');
      } catch (e) {
        failed.push(`${id}: ${e.message}`);
      }
    }
    console.log('   ', pad('휴지통으로 보냄', 18), String(ok).padStart(7), '개');
    if (failed.length) {
      console.log('   ', pad('보내지 못함', 18), String(failed.length).padStart(7), '개 — 이미 없거나 권한이 없는 것입니다.');
      for (const f of failed.slice(0, 10)) console.log('       ', f);
    }
    console.log('\n휴지통은 30일 뒤 비워집니다. 바로 비우려면 드라이브에서 휴지통을 비우세요.\n');
  } else {
    console.log('\n끝났습니다. 구글 드라이브의 파일은 그대로 남아 있습니다.\n');
  }
}

main()
  .catch((e) => {
    console.error('\n실패했습니다. 아무것도 바뀌지 않았습니다.\n', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
