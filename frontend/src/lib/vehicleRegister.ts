import { api } from '../api/client';
import { isPlateNo, normalizePlate } from './plate';

// 계근 등록에서 적은 차량번호를 차량 목록에 올린다.
// 저장이 끝난 뒤에만 부른다 — 입력하다 만 값이나 취소한 입력은 목록에 남지 않아야 한다.
// 번호 꼴이 아니면 올리지 않는다. 입출고 기록에는 적은 그대로 남는다.
export async function registerVehicleAfterSave(plateNo?: string | null, vehicleType?: string | null) {
  const no = normalizePlate(plateNo ?? '');
  if (!no || !isPlateNo(no)) return;
  try {
    await api.post('/api/assets/quick-vehicle', { plateNo: no, vehicleType: vehicleType || undefined });
  } catch {
    // 목록 등록에 실패해도 입출고 저장은 이미 끝났다. 조용히 넘어간다.
  }
}
