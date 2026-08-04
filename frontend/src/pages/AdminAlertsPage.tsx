import { useEffect, useState } from 'react';
import { BellRing, Truck, Award } from 'lucide-react';
import { api } from '../api/client';
import { Badge } from '../components/ui/Badge';
import {
  pageTitleCls,
  sectionTitleCls,
  primaryBtnCls,
  inputCls,
  tableWrapCls,
  thCls,
  tdCls,
  trCls,
} from '../components/ui/classes';
import type { ExpiringAlerts, ExpiringItem, Vehicle, Employee } from '../types';

const TYPE_LABEL: Record<string, string> = {
  vehicle_inspection: '차량검사',
  certification: '자격증',
};

export function AdminAlertsPage() {
  const [threshold, setThreshold] = useState(30);
  const [alerts, setAlerts] = useState<ExpiringAlerts | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const search = () => {
    api.get<ExpiringAlerts>(`/api/alerts/expiring?days=${threshold}`).then(setAlerts);
  };

  useEffect(() => {
    search();
    api.get<Vehicle[]>('/api/vehicles').then(setVehicles);
    api.get<Employee[]>('/api/employees').then(setEmployees);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threshold]);

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <BellRing size={20} className="text-primary" />
        <h1 className={pageTitleCls}>총무 만료 알림 대시보드</h1>
      </div>

      <div className="mb-5 flex items-center gap-2">
        <label className="text-[13px] text-text-mid">임박 기준(D-day):</label>
        <input
          type="number"
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className={`${inputCls} w-[90px]`}
        />
      </div>

      {alerts && (
        <>
          <AlertGroup title={`만료 초과 (${alerts.overdue.length}건)`} items={alerts.overdue} tone="danger" />
          <AlertGroup title={`만료 임박 (${alerts.imminent.length}건)`} items={alerts.imminent} tone="warning" />
        </>
      )}

      <div className="mt-8 flex flex-wrap gap-10">
        <VehicleRegister onRegistered={search} />
        <EmployeeRegister onRegistered={() => api.get<Employee[]>('/api/employees').then(setEmployees)} />
        <CertificationRegister employees={employees} onRegistered={search} />
      </div>

      <div className="mt-8">
        <h2 className={`${sectionTitleCls} mb-2`}>등록된 차량/중장비</h2>
        <ul className="space-y-1">
          {vehicles.map((v) => (
            <li key={v.id} className="text-[13px] text-text-mid">
              {v.vehicleNo} ({v.vehicleType ?? '-'}) — 검사만료:{' '}
              <span className="tabular">{v.inspectionExpiry ? v.inspectionExpiry.slice(0, 10) : '미등록'}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AlertGroup({ title, items, tone }: { title: string; items: ExpiringItem[]; tone: 'danger' | 'warning' }) {
  const color = tone === 'danger' ? 'text-danger' : 'text-warning';
  const badgeTone = tone === 'danger' ? 'red' : 'amber';
  return (
    <div className="mb-6">
      <h2 className={`mb-2 text-[16px] font-extrabold ${color}`}>{title}</h2>
      <div className={`${tableWrapCls} max-w-[700px]`}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-border">
              <th className={thCls}>구분</th>
              <th className={thCls}>대상</th>
              <th className={thCls}>만료일</th>
              <th className={thCls}>D-day</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={`${i.type}-${i.targetId}`} className={trCls}>
                <td className={tdCls}>
                  <span className="inline-flex items-center gap-1.5">
                    {i.type === 'vehicle_inspection' ? <Truck size={13} /> : <Award size={13} />}
                    {TYPE_LABEL[i.type]}
                  </span>
                </td>
                <td className={tdCls}>{i.targetName}</td>
                <td className={`${tdCls} tabular`}>{new Date(i.expiryDate).toISOString().slice(0, 10)}</td>
                <td className={tdCls}>
                  <Badge tone={badgeTone}>{i.daysLeft >= 0 ? `D-${i.daysLeft}` : `D+${-i.daysLeft}`}</Badge>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-[13px] text-text-faint">
                  해당 없음
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VehicleRegister({ onRegistered }: { onRegistered: () => void }) {
  const [vehicleNo, setVehicleNo] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [inspectionExpiry, setInspectionExpiry] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleNo) return;
    await api.post('/api/vehicles', { vehicleNo, vehicleType: vehicleType || undefined, inspectionExpiry: inspectionExpiry || undefined });
    setVehicleNo('');
    setVehicleType('');
    setInspectionExpiry('');
    onRegistered();
  };

  return (
    <div>
      <h2 className={`${sectionTitleCls} mb-2`}>차량/중장비 등록</h2>
      <form onSubmit={handleSubmit} className="flex w-[260px] flex-col gap-2">
        <input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} placeholder="차량번호" className={inputCls} />
        <input
          value={vehicleType}
          onChange={(e) => setVehicleType(e.target.value)}
          placeholder="구분(법인차량/중장비/어테치)"
          className={inputCls}
        />
        <input type="date" value={inspectionExpiry} onChange={(e) => setInspectionExpiry(e.target.value)} className={inputCls} />
        <button type="submit" className={primaryBtnCls}>
          등록
        </button>
      </form>
    </div>
  );
}

function EmployeeRegister({ onRegistered }: { onRegistered: () => void }) {
  const [name, setName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await api.post('/api/employees', { name });
    setName('');
    onRegistered();
  };

  return (
    <div>
      <h2 className={`${sectionTitleCls} mb-2`}>임직원 등록</h2>
      <form onSubmit={handleSubmit} className="flex w-[260px] flex-col gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" className={inputCls} />
        <button type="submit" className={primaryBtnCls}>
          등록
        </button>
      </form>
    </div>
  );
}

function CertificationRegister({ employees, onRegistered }: { employees: Employee[]; onRegistered: () => void }) {
  const [employeeId, setEmployeeId] = useState('');
  const [certName, setCertName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !certName) return;
    await api.post(`/api/employees/${employeeId}/certifications`, { certName, expiryDate: expiryDate || undefined });
    setCertName('');
    setExpiryDate('');
    onRegistered();
  };

  return (
    <div>
      <h2 className={`${sectionTitleCls} mb-2`}>자격증 등록</h2>
      <form onSubmit={handleSubmit} className="flex w-[260px] flex-col gap-2">
        <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputCls}>
          <option value="">임직원 선택</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <input value={certName} onChange={(e) => setCertName(e.target.value)} placeholder="자격증명" className={inputCls} />
        <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className={inputCls} />
        <button type="submit" className={primaryBtnCls}>
          등록
        </button>
      </form>
    </div>
  );
}
