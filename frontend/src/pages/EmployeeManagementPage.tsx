import { useCallback, useEffect, useState } from 'react';
import { Users, Plus, Trash2, QrCode as QrIcon, CheckCircle2, Eye } from 'lucide-react';
import { api } from '../api/client';
import { formatPhone } from '../lib/phone';
import { useCommonCodes } from '../hooks/useMasters';
import { FormModal } from '../components/FormModal';
import { QrCode } from '../components/QrCode';
import { EmployeeDetailModal } from './EmployeeDetailModal';
import { Badge } from '../components/ui/Badge';
import {
  pageTitleCls,
  sectionTitleCls,
  primaryBtnCls,
  outlineBtnCls,
  inputCls,
  tableWrapCls,
  thCls,
  tdCls,
  trCls,
} from '../components/ui/classes';
import type { Employee } from '../types';

interface CertRow {
  certName: string;
  acquiredDate: string;
  expiryDate: string;
}

interface TrainingRow {
  trainingName: string;
  trainingType: string;
  trainingDate: string;
  cycleMonths: string;
  nextDueDate: string;
}

// 다음 교육 예정일 = 이수일 + 주기(개월)
function addMonths(date: string, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

const emptyCert: CertRow = { certName: '', acquiredDate: '', expiryDate: '' };
const emptyTraining: TrainingRow = {
  trainingName: '',
  trainingType: '의무',
  trainingDate: '',
  cycleMonths: '12',
  nextDueDate: '',
};

const TRAINING_TYPES = ['의무', '보수'];

// 남은 일수 — 예정일이 오늘이면 0, 지났으면 음수
function daysLeft(due?: string | null) {
  if (!due) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(due.slice(0, 10));
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

// D-100 형태로 표시하고, D-30 이내부터는 경고색으로 알린다.
function DDay({ due }: { due?: string | null }) {
  const left = daysLeft(due);
  if (left === null) return <span className="text-text-faint">-</span>;
  if (left < 0) return <Badge tone="red">D+{Math.abs(left)} 경과</Badge>;
  if (left === 0) return <Badge tone="red">D-DAY</Badge>;
  if (left <= 30) return <Badge tone="red">D-{left}</Badge>;
  return <Badge tone="slate">D-{left}</Badge>;
}

// 갱신될 때마다 행이 쌓이므로 목록에는 최신 1건만 보여 주고 나머지는 건수 배지로 알린다.
function latestCert(emp: Employee) {
  return [...(emp.certifications ?? [])].sort(
    (a, b) => new Date(b.expiryDate ?? b.acquiredDate ?? 0).getTime() - new Date(a.expiryDate ?? a.acquiredDate ?? 0).getTime(),
  )[0];
}

function latestTraining(emp: Employee) {
  return [...(emp.trainings ?? [])].sort(
    (a, b) => new Date(b.nextDueDate ?? b.trainingDate ?? 0).getTime() - new Date(a.nextDueDate ?? a.trainingDate ?? 0).getTime(),
  )[0];
}

function MoreBadge({ total }: { total: number }) {
  if (total <= 1) return null;
  return <Badge tone="slate">+{total - 1}</Badge>;
}

export function EmployeeManagementPage({ embedded = false }: { embedded?: boolean }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [open, setOpen] = useState(false);
  const [qrTarget, setQrTarget] = useState<Employee | null>(null);
  const [detail, setDetail] = useState<Employee | null>(null);

  const remove = async (emp: Employee) => {
    if (!window.confirm(`${emp.name} 임직원을 삭제하시겠습니까? 자격사항·교육이력도 함께 삭제됩니다.`)) return;
    await api.del(`/api/employees/${emp.id}`);
    setDetail(null);
    reload();
  };

  const reload = useCallback(() => {
    api.get<Employee[]>('/api/employees').then(setEmployees);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        {!embedded && <Users size={20} className="text-primary" />}
        {!embedded && <h1 className={pageTitleCls}>임직원 관리</h1>}
        <span className={embedded ? sectionTitleCls : 'ml-1 text-[13px] text-text-sub'}>
          {embedded ? '임직원 목록' : `${employees.length}명`}
        </span>
        <button type="button" onClick={() => setOpen(true)} className={`${primaryBtnCls} ml-auto`}>
          <Plus size={15} /> 임직원 등록
        </button>
      </div>

      <div className={`${tableWrapCls} overflow-x-auto`}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={thCls}>사번</th>
              <th className={thCls}>성명</th>
              <th className={thCls}>연락처</th>
              <th className={thCls}>부서/직급</th>
              <th className={thCls}>입사일</th>
              <th className={thCls}>자격사항(만료일)</th>
              <th className={thCls}>교육(구분 · 다음 예정)</th>
              <th className={thCls}>관리</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id} className={trCls}>
                <td className={`${tdCls} tabular whitespace-nowrap`}>{emp.empCode ?? '-'}</td>
                <td className={tdCls}>{emp.name}</td>
                <td className={`${tdCls} tabular`}>{emp.phone ?? '-'}</td>
                <td className={tdCls}>{[emp.department, emp.position].filter(Boolean).join(' / ') || '-'}</td>
                <td className={`${tdCls} tabular`}>{emp.hireDate ? emp.hireDate.slice(0, 10) : '-'}</td>
                <td className={`${tdCls} whitespace-nowrap`}>
                  {(() => {
                    const c = latestCert(emp);
                    if (!c) return '-';
                    return (
                      <span className="inline-flex items-center gap-1.5">
                        {c.certName}
                        {c.expiryDate && <span className="text-text-faint">~{c.expiryDate.slice(0, 10)}</span>}
                        <DDay due={c.expiryDate} />
                        <MoreBadge total={emp.certifications?.length ?? 0} />
                      </span>
                    );
                  })()}
                </td>
                <td className={`${tdCls} whitespace-nowrap`}>
                  {(() => {
                    const t = latestTraining(emp);
                    if (!t) return '-';
                    return (
                      <span className="inline-flex items-center gap-1.5">
                        {t.trainingType && <Badge tone={t.trainingType === '의무' ? 'amber' : 'blue'}>{t.trainingType}</Badge>}
                        {t.trainingName}
                        {t.nextDueDate && <span className="text-text-faint">{t.nextDueDate.slice(0, 10)}</span>}
                        <DDay due={t.nextDueDate} />
                        <MoreBadge total={emp.trainings?.length ?? 0} />
                      </span>
                    );
                  })()}
                </td>
                <td className={`${tdCls} whitespace-nowrap`}>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      title="상세"
                      onClick={() => setDetail(emp)}
                      className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-text-strong"
                    >
                      <Eye size={15} />
                    </button>
                    {emp.empCode && (
                      <button
                        type="button"
                        title="근태 QR"
                        onClick={() => setQrTarget(emp)}
                        className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-text-strong"
                      >
                        <QrIcon size={15} />
                      </button>
                    )}
                    <button
                      type="button"
                      title="삭제"
                      onClick={() => remove(emp)}
                      className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td className={`${tdCls} text-text-faint`} colSpan={8}>
                  등록된 임직원이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detail && (
        <EmployeeDetailModal
          employeeId={detail.id}
          onClose={() => setDetail(null)}
          onChanged={reload}
          onDelete={() => remove(detail)}
        />
      )}

      {qrTarget && (
        <FormModal title={`${qrTarget.name} 근태 QR`} icon={QrIcon} onClose={() => setQrTarget(null)}>
          <div className="flex flex-col items-center gap-3 py-2">
            <QrCode
              value={qrTarget.empCode ?? ''}
              fileName={`${qrTarget.empCode}_${qrTarget.name}`}
              size={200}
              caption={`${qrTarget.name}${qrTarget.department ? ` · ${qrTarget.department}` : ''}`}
            />
            <p className="text-center text-[12.5px] text-text-faint">
              근태 단말이나 휴대폰으로 스캔하면 사번이 읽힙니다. 출퇴근 기록에 이 QR을 사용하세요.
            </p>
          </div>
        </FormModal>
      )}

      {open && (
        <FormModal title="임직원 등록" icon={Users} onClose={() => setOpen(false)}>
          <EmployeeForm onCreated={reload} />
        </FormModal>
      )}
    </div>
  );
}

// 기본정보 + 자격사항 + 교육이력을 한 번에 등록한다.
function EmployeeForm({ onCreated }: { onCreated: () => void }) {
  const [created, setCreated] = useState<Employee | null>(null);
  const { labels: certOptions } = useCommonCodes('자격증 종류');
  const { labels: trainingOptions } = useCommonCodes('교육 과정');
  const { labels: departmentOptions } = useCommonCodes('부서');
  const { labels: positionOptions } = useCommonCodes('직급');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [hireDate, setHireDate] = useState('');
  const [certs, setCerts] = useState<CertRow[]>([{ ...emptyCert }]);
  const [trainings, setTrainings] = useState<TrainingRow[]>([{ ...emptyTraining }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setName('');
    setPhone('');
    setDepartment('');
    setPosition('');
    setHireDate('');
    setCerts([{ ...emptyCert }]);
    setTrainings([{ ...emptyTraining }]);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const employee = await api.post<Employee>('/api/employees', {
        name,
        phone: phone || undefined,
        department: department || undefined,
        position: position || undefined,
        hireDate: hireDate || undefined,
        certifications: certs
          .filter((c) => c.certName.trim())
          .map((c) => ({
            certName: c.certName,
            acquiredDate: c.acquiredDate || undefined,
            expiryDate: c.expiryDate || undefined,
          })),
        trainings: trainings
          .filter((t) => t.trainingName.trim())
          .map((t) => ({
            trainingName: t.trainingName,
            trainingType: t.trainingType || undefined,
            trainingDate: t.trainingDate || undefined,
            cycleMonths: t.cycleMonths ? Number(t.cycleMonths) : undefined,
            // 비워 두면 이수일 + 주기로 서버가 산출한다.
            nextDueDate: t.nextDueDate || undefined,
          })),
      });
      setCreated(employee);
      reset();
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      <p className="text-[13px] text-text-sub">
        자격증 종류·교육 과정·부서·직급 목록은 시스템 관리 &gt; 공통코드 관리에서 관리합니다.
      </p>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">성명</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">연락처</label>
              <input
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                inputMode="numeric"
                placeholder="010-0000-0000"
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">부서</label>
              <input list="emp-departments" value={department} onChange={(e) => setDepartment(e.target.value)} className={inputCls} />
              <datalist id="emp-departments">
                {departmentOptions.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">직급</label>
              <input list="emp-positions" value={position} onChange={(e) => setPosition(e.target.value)} className={inputCls} />
              <datalist id="emp-positions">
                {positionOptions.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">입사일</label>
              <input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[13px] font-semibold text-text-mid">
                자격사항 <span className="font-normal text-text-faint">— 자격증명 / 취득일 / 만료일</span>
              </label>
              <button type="button" onClick={() => setCerts([...certs, { ...emptyCert }])} className="text-[12px] font-bold text-primary">
                <Plus size={12} className="inline" /> 행 추가
              </button>
            </div>
            <datalist id="emp-certs">
              {certOptions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <div className="space-y-2">
              {certs.map((c, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,140px)_minmax(0,140px)_24px] items-center gap-2">
                  <input
                    list="emp-certs"
                    value={c.certName}
                    onChange={(e) => setCerts(certs.map((r, ri) => (ri === i ? { ...r, certName: e.target.value } : r)))}
                    placeholder="자격증명"
                    className={`${inputCls} min-w-0`}
                  />
                  <input
                    type="date"
                    value={c.acquiredDate}
                    onChange={(e) => setCerts(certs.map((r, ri) => (ri === i ? { ...r, acquiredDate: e.target.value } : r)))}
                    title="취득일"
                    aria-label="취득일"
                    className={`${inputCls} min-w-0`}
                  />
                  <input
                    type="date"
                    value={c.expiryDate}
                    onChange={(e) => setCerts(certs.map((r, ri) => (ri === i ? { ...r, expiryDate: e.target.value } : r)))}
                    title="만료일"
                    aria-label="만료일"
                    className={`${inputCls} min-w-0`}
                  />
                  <button
                    type="button"
                    onClick={() => setCerts(certs.length === 1 ? [{ ...emptyCert }] : certs.filter((_, ri) => ri !== i))}
                    className="text-danger"
                    title="행 삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[13px] font-semibold text-text-mid">
                교육이력 <span className="font-normal text-text-faint">— 교육명 / 구분 / 이수일 / 주기(개월) / 다음 예정일(자동)</span>
              </label>
              <button
                type="button"
                onClick={() => setTrainings([...trainings, { ...emptyTraining }])}
                className="text-[12px] font-bold text-primary"
              >
                <Plus size={12} className="inline" /> 행 추가
              </button>
            </div>
            <datalist id="emp-trainings">
              {trainingOptions.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <div className="space-y-2">
              {trainings.map((t, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_84px_minmax(0,132px)_72px_minmax(0,132px)_24px] items-center gap-2">
                  <input
                    list="emp-trainings"
                    value={t.trainingName}
                    onChange={(e) =>
                      setTrainings(trainings.map((r, ri) => (ri === i ? { ...r, trainingName: e.target.value } : r)))
                    }
                    placeholder="교육명"
                    className={`${inputCls} min-w-0`}
                  />
                  <select
                    value={t.trainingType}
                    onChange={(e) =>
                      setTrainings(trainings.map((r, ri) => (ri === i ? { ...r, trainingType: e.target.value } : r)))
                    }
                    title="구분"
                    aria-label="교육 구분"
                    className={`${inputCls} min-w-0 px-2`}
                  >
                    {TRAINING_TYPES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={t.trainingDate}
                    onChange={(e) =>
                      setTrainings(trainings.map((r, ri) => (ri === i ? { ...r, trainingDate: e.target.value } : r)))
                    }
                    title="이수일"
                    aria-label="이수일"
                    className={`${inputCls} min-w-0`}
                  />
                  <input
                    type="number"
                    min="1"
                    value={t.cycleMonths}
                    onChange={(e) =>
                      setTrainings(trainings.map((r, ri) => (ri === i ? { ...r, cycleMonths: e.target.value } : r)))
                    }
                    title="교육 주기(개월)"
                    aria-label="교육 주기(개월)"
                    placeholder="주기"
                    className={`${inputCls} min-w-0 px-2`}
                  />
                  <input
                    type="date"
                    value={t.nextDueDate}
                    onChange={(e) =>
                      setTrainings(trainings.map((r, ri) => (ri === i ? { ...r, nextDueDate: e.target.value } : r)))
                    }
                    title="다음 교육 예정일 — 비우면 이수일 + 주기로 자동 산출"
                    aria-label="다음 교육 예정일"
                    placeholder={t.trainingDate && t.cycleMonths ? addMonths(t.trainingDate, Number(t.cycleMonths)) : ''}
                    className={`${inputCls} min-w-0`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setTrainings(trainings.length === 1 ? [{ ...emptyTraining }] : trainings.filter((_, ri) => ri !== i))
                    }
                    className="text-danger"
                    title="행 삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

      {created && (
        <div className="flex items-center gap-5 rounded-[10px] border border-border bg-input p-4">
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-success">
              <CheckCircle2 size={15} /> {created.name} 등록 완료
            </p>
            <p className="text-[12.5px] text-text-sub">
              사번이 <span className="tabular font-bold text-text-strong">{created.empCode}</span> 로 자동 채번되었습니다.
              아래 QR을 저장해 근태(출퇴근) 확인에 사용하세요.
            </p>
          </div>
          <div className="ml-auto">
            <QrCode value={created.empCode ?? ''} fileName={`${created.empCode}_${created.name}`} size={140} />
          </div>
        </div>
      )}

      {error && <p className="text-[13px] text-danger">{error}</p>}

      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <button type="button" onClick={reset} className={outlineBtnCls}>
          초기화
        </button>
        <button type="submit" disabled={submitting} className={primaryBtnCls}>
          {submitting ? '등록 중...' : '등록'}
        </button>
      </div>
    </form>
  );
}
