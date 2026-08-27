import { prisma } from './prisma.js';
import { trashInDrive } from './drive.js';

// 마감한 달의 출퇴근 셀카를 지운다.
//
// 얼굴 사진은 본인 확인에만 쓰는 것이고, 그 확인이 끝나면 남길 이유가 없다.
// 집계에 쓰는 숫자(공수·근태·시각·거리)는 그대로 남고 사진만 사라진다.
// 드라이브에서 지우지 못해도 우리 쪽 연결은 끊는다 — 사진에 닿을 길을 남기지 않는다.
export async function purgeMonthSelfies(month) {
  return purgeSelfies({ labor: { settleMonth: month } });
}

// 하루 기록을 지울 때 그 날의 셀카도 함께 지운다.
// 기록이 사라졌는데 사진만 드라이브에 남아 있으면 지운 것이 아니다.
export async function purgeLaborSelfies(laborId) {
  return purgeSelfies({ laborId });
}

async function purgeSelfies(where) {
  const photos = await prisma.attachment.findMany({
    where,
    select: { id: true, driveFileId: true },
  });
  if (!photos.length) return 0;

  for (const photo of photos) {
    try {
      await trashInDrive(photo.driveFileId);
    } catch (e) {
      console.error('[attendance] 셀카 삭제 실패:', photo.driveFileId, e.message);
    }
  }
  await prisma.attachment.deleteMany({ where: { id: { in: photos.map((p) => p.id) } } });
  return photos.length;
}

// 두 좌표 사이 거리(m). 현장 기준점에서 얼마나 떨어져 찍었는지 보는 데만 쓴다.
export function distanceMeters(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some((v) => typeof v !== 'number' || Number.isNaN(v))) return null;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
