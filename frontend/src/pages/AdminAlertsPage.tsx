import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, Truck, Award, GraduationCap } from 'lucide-react';
import { api } from '../api/client';
import { formatPhone } from '../lib/phone';
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
import type { ExpiringAlerts, ExpiringItem, Employee } from '../types';

const TYPE_LABEL: Record<string, string> = {
  vehicle_inspection: '차량검사',
  certification: '자격증',
  training: '교육',
};

const TYPE_ICON: Record<string, typeof Truck> = {
  vehicle_inspection: Truck,
  certification: Award,
  training: GraduationCap,
};

export function AdminAlertsPage() {
  const [threshold, setThreshold] = useState(30);
  const [alerts, setAlerts] = useState<ExpiringAlerts | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const search = () => {
    api.get<ExpiringAlerts>(`/api/alerts/expiring?days=${threshold}`).then(setAlerts);
  };

  useEffect(() => {
    search();
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
        <EmployeeRegister onRegistered={() => api.get<Employee[]>('/api/employees').then(setEmployees)} />
        <CertificationRegister employees={employees} onRegistered={search} />
      </div>

      {/* 차량/중장비 등록·정비이력·검사관리는 시스템 관리 > 차량/장비 관리 탭으로 이동했다. */}
      <p className="mt-8 text-[13px] text-text-sub">
        차량/중장비 등록·정비이력·검사 문서는{' '}
        <Link to="/vehicles" className="font-semibold text-primary hover:underline">
          관리 &gt; 차량/장비 정비·이동
        </Link>
        에서 관리합니다.
      </p>
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
                    {(() => {
                      const Icon = TYPE_ICON[i.type] ?? Award;
                      return <Icon size={13} />;
                    })()}
                    {TYPE_LABEL[i.type] ?? i.type}
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

function EmployeeRegister({ onRegistered }: { onRegistered: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await api.post('/api/employees', { name, phone: phone || undefined });
    setName('');
    setPhone('');
    onRegistered();
  };

  return (
    <div>
      <h2 className={`${sectionTitleCls} mb-2`}>임직원 등록</h2>
      <form onSubmit={handleSubmit} className="flex w-[260px] flex-col gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" className={inputCls} />
        {/* 입출고 등록에서 운전자를 고르면 이 연락처가 자동으로 채워진다. */}
        <input
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          inputMode="numeric"
          placeholder="연락처 (010-0000-0000)"
          className={inputCls}
        />
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
