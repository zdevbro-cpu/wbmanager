import { useVehicles, useEmployees, useCommonCodes } from '../hooks/useMasters';
import { inputCls } from './ui/classes';
import { formatPhone } from '../lib/phone';
import { isPlateNo } from '../lib/plate';

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
  const { vehicles } = useVehicles();
  const { employees } = useEmployees();
  const { labels: codeVehicleTypes } = useCommonCodes('차종');
  const vehicleTypes = codeVehicleTypes.length > 0 ? codeVehicleTypes : DEFAULT_VEHICLE_TYPES;

  const handleVehicleChange = (no: string) => {
    setVehicleNo(no);
    const vehicle = vehicles.find((v) => v.vehicleNo === no);
    if (vehicle?.vehicleType) setVehicleType(vehicle.vehicleType);
  };

  // 이미 목록에 있는 번호이거나 번호 꼴을 갖췄으면 저장 시 목록에 올라간다.
  const isNewPlateOk =
    vehicles.some((v) => v.vehicleNo === vehicleNo.trim()) || isPlateNo(vehicleNo);

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
        {/* 목록에서 고르거나 직접 적는다. 새 번호는 이 건을 저장할 때 차량 목록에 올라간다. */}
        <input
          list="vehicle-plate-options"
          value={vehicleNo}
          onChange={(e) => handleVehicleChange(e.target.value)}
          placeholder="선택하거나 직접 입력"
          className={inputCls}
        />
        {/* 번호 꼴이 아니면 차량 목록에 올리지 않는다. 적다 만 값이 목록에 남지 않게 하기 위해서다. */}
        {vehicleNo.trim() && !isNewPlateOk && (
          <p className="mt-1 text-[12px] text-text-faint">
            차량번호 형식이 아니어서 차량 목록에는 추가되지 않습니다. 이 건에는 적은 그대로 저장됩니다.
          </p>
        )}
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
