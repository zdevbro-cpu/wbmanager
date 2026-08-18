import { useVehicles, useEmployees, useCommonCodes } from '../hooks/useMasters';
import { inputCls } from './ui/classes';
import { formatPhone } from '../lib/phone';

// 차종 목록 — 공통코드(그룹: 차종)에서 관리한다. 공통코드가 비어 있으면 원본 엑셀 사용값으로 대체한다.
const DEFAULT_VEHICLE_TYPES = ['집게차', '카고', '암롤트럭', '방통차', '1톤트럭', '트레일러', '기타'];

interface Props {
  vehicleType: string;
  setVehicleType: (v: string) => void;
  vehicleNo: string;
  setVehicleNo: (v: string) => void;
  driverName: string;
  setDriverName: (v: string) => void;
  driverPhone: string;
  setDriverPhone: (v: string) => void;
}

// 입고/폐기물입고/출고 공통 — 차량번호는 차량등록관리, 운전자는 임직원 목록에서 선택한다.
// 차량을 고르면 차종이, 운전자를 고르면 연락처가 자동으로 채워지며 이후 수정할 수 있다.
export function VehicleDriverFields({
  vehicleType,
  setVehicleType,
  vehicleNo,
  setVehicleNo,
  driverName,
  setDriverName,
  driverPhone,
  setDriverPhone,
}: Props) {
  const { vehicles, quickCreate } = useVehicles();
  const { employees } = useEmployees();
  const { labels: codeVehicleTypes } = useCommonCodes('차종');
  const vehicleTypes = codeVehicleTypes.length > 0 ? codeVehicleTypes : DEFAULT_VEHICLE_TYPES;

  const handleVehicleChange = (no: string) => {
    setVehicleNo(no);
    const vehicle = vehicles.find((v) => v.vehicleNo === no);
    if (vehicle?.vehicleType) setVehicleType(vehicle.vehicleType);
  };

  // 목록에 없는 번호를 적고 칸을 벗어나면 차량으로 등록해 다음부터 목록에 뜨게 한다.
  const registerIfNew = async () => {
    const no = vehicleNo.trim();
    if (!no || vehicles.some((v) => v.vehicleNo === no)) return;
    try {
      await quickCreate(no, vehicleType || undefined);
    } catch {
      // 등록에 실패해도 입력값은 그대로 두어 저장을 막지 않는다.
    }
  };

  const handleDriverChange = (name: string) => {
    setDriverName(name);
    const employee = employees.find((e) => e.name === name);
    if (employee?.phone) setDriverPhone(employee.phone);
  };

  // 2열 그리드의 셀로 그대로 들어가도록 각 항목을 독립 블록으로 내보낸다.
  return (
    <>
      <div>
        <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">차량번호</label>
        {/* 목록에서 고르거나 직접 적는다. 새 번호는 칸을 벗어날 때 차량으로 등록된다. */}
        <input
          list="vehicle-plate-options"
          value={vehicleNo}
          onChange={(e) => handleVehicleChange(e.target.value)}
          onBlur={registerIfNew}
          placeholder="선택하거나 직접 입력"
          className={inputCls}
        />
        <datalist id="vehicle-plate-options">
          {vehicles.map((v) => (
            <option key={v.id} value={v.vehicleNo}>
              {v.vehicleType ?? ''}
            </option>
          ))}
        </datalist>
      </div>

      <div>
        <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">차종</label>
        <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className={inputCls}>
          <option value="">선택</option>
          {vehicleTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
          {vehicleType && !vehicleTypes.includes(vehicleType) && <option value={vehicleType}>{vehicleType}</option>}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">운전자</label>
        <select value={driverName} onChange={(e) => handleDriverChange(e.target.value)} className={inputCls}>
          <option value="">선택</option>
          {employees.map((e) => (
            <option key={e.id} value={e.name}>
              {e.name}
            </option>
          ))}
        </select>
        {employees.length === 0 && (
          <p className="mt-1 text-[12px] text-text-faint">관리 &gt; 임직원 관리에서 먼저 등록하세요.</p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">연락처</label>
        <input
          value={driverPhone}
          onChange={(e) => setDriverPhone(formatPhone(e.target.value))}
          placeholder="010-0000-0000"
          className={inputCls}
        />
      </div>
    </>
  );
}
