import { useVehicles, useEmployees } from '../hooks/useMasters';
import { inputCls } from './ui/classes';

// 차종 목록 — 원본 엑셀 입출고 시트 실제 사용값
const VEHICLE_TYPES = ['집게차', '카고', '암롤트럭', '방통차', '1톤트럭', '트레일러', '기타'];

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

  const handleVehicleChange = (no: string) => {
    setVehicleNo(no);
    const vehicle = vehicles.find((v) => v.vehicleNo === no);
    if (vehicle?.vehicleType) setVehicleType(vehicle.vehicleType);
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
        <select value={vehicleNo} onChange={(e) => handleVehicleChange(e.target.value)} className={inputCls}>
          <option value="">선택</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.vehicleNo}>
              {v.vehicleNo}
              {v.vehicleType ? ` (${v.vehicleType})` : ''}
            </option>
          ))}
        </select>
        {vehicles.length === 0 && (
          <p className="mt-1 text-[12px] text-text-faint">시스템 관리 &gt; 차량/장비 관리에서 먼저 등록하세요.</p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">차종</label>
        <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className={inputCls}>
          <option value="">선택</option>
          {VEHICLE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
          {vehicleType && !VEHICLE_TYPES.includes(vehicleType) && <option value={vehicleType}>{vehicleType}</option>}
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
          <p className="mt-1 text-[12px] text-text-faint">시스템 관리 &gt; 임직원 관리에서 먼저 등록하세요.</p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">연락처</label>
        <input
          value={driverPhone}
          onChange={(e) => setDriverPhone(e.target.value)}
          placeholder="010-0000-0000"
          className={inputCls}
        />
      </div>
    </>
  );
}
