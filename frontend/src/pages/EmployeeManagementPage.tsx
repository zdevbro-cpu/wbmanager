import { useCallback, useEffect, useState } from 'react';
import { Users, Plus, Trash2, CheckCircle2, Eye, RotateCcw } from 'lucide-react';
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
  cardCls,
  tableWrapCls,
  thCls,
  tdCls,
  trCls,
} from '../components/ui/classes';
import type { Employee } from '../types';
import { DateField } from '../components/ui/DateField';

interface CertRow {
  certName: string;
  certType: string;
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

const CERT_TYPES = ['국가기술자격', '면허', '교육이수증', '기타'];
const emptyCert: CertRow = { certName: '', certType: CERT_TYPES[0], acquiredDate: '', expiryDate: '' };
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

// 자격·교육은 여러 건을 동시에 보유·이수한다. 1건만 대표로 보이거나 몇 건을 접어 두면
// 만료가 임박한 건이 가려져 D-day를 놓친다. 임박한 순으로 정렬해 보유한 만큼 전부 편다.
function byUrgency<T>(rows: T[], due: (r: T) => string | null | undefined) {
  return [...rows].sort((a, b) => {
    // 기한이 없는 건은 급할 게 없으므로 뒤로 보낸다.
    const da = due(a) ? new Date(due(a) as string).getTime() : Number.POSITIVE_INFINITY;
    const db = due(b) ? new Date(due(b) as string).getTime() : Number.POSITIVE_INFINITY;
    return da - db;
  });
}

const sortedCerts = (emp: Employee) =>
  byUrgency(emp.certifications ?? [], (c) => c.expiryDate ?? c.acquiredDate);

const sortedTrainings = (emp: Employee) =>
  byUrgency(emp.trainings ?? [], (t) => t.nextDueDate ?? t.trainingDate);


// 공수표는 이 구분과 상관없이 모두 담는다. 정규직은 근태로, 그 밖은 공수로 센다.
export const EMPLOYMENT_TYPES = ['정규직', '계약직', '일용직', '프리랜서', '현장직', '타사직원'];

export function EmployeeManagementPage({ embedded = false }: { embedded?: boolean }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [q, setQ] = useState('');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [expiring, setExpiring] = useState('');
  const [open, setOpen] = useState(false);
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

  // 자격증 만료·교육 예정이 30일 안쪽인 사람을 찾는다. 알림 화면과 같은 기준이다.
  const hasExpiring = (emp: Employee) => {
    const soon = (v?: string | null) => {
      const left = daysLeft(v);
      return left != null && left <= 30;
    };
    return (
      (emp.certifications ?? []).some((c) => soon(c.expiryDate)) ||
      (emp.trainings ?? []).some((t) => soon(t.nextDueDate))
    );
  };

  const visible = employees.filter((emp) => {
    const keyword = q.trim().toLowerCase();
    if (keyword) {
      const hay = [emp.empCode, emp.name, emp.phone, emp.companyName].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(keyword)) return false;
    }
    if (department && emp.department !== department) return false;
    if (position && emp.position !== position) return false;
    if (employmentType && emp.employmentType !== employmentType) return false;
    if (expiring === 'true' && !hasExpiring(emp)) return false;
    if (expiring === 'false' && hasExpiring(emp)) return false;
    return true;
  });

  const used = (pick: (e: Employee) => string | null | undefined) =>
    [...new Set(employees.map(pick).filter(Boolean))].sort() as string[];

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        {!embedded && <Users size={20} className="text-primary" />}
        {!embedded && <h1 className={pageTitleCls}>임직원 관리</h1>}
        <span className={embedded ? sectionTitleCls : 'ml-1 text-[13px] text-text-sub'}>
          {embedded
            ? '임직원 목록'
            : visible.length === employees.length
              ? `${employees.length}명`
              : `${visible.length}명 / 전체 ${employees.length}명`}
        </span>
        <button type="button" onClick={() => setOpen(true)} className={`${primaryBtnCls} ml-auto`}>
          <Plus size={15} /> 임직원 등록
        </button>
      </div>

      <div
        className={`${cardCls} mb-4 grid items-center gap-2 px-4 py-2.5`}
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="사번 · 성명 · 연락처"
          className={`${inputCls} w-full min-w-0`}
        />
        <select value={department} onChange={(e) => setDepartment(e.target.value)} className={`${inputCls} w-full min-w-0`}>
          <option value="">부서 전체</option>
          {used((e) => e.department).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select value={position} onChange={(e) => setPosition(e.target.value)} className={`${inputCls} w-full min-w-0`}>
          <option value="">직급 전체</option>
          {used((e) => e.position).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={employmentType}
          onChange={(e) => setEmploymentType(e.target.value)}
          className={`${inputCls} w-full min-w-0`}
        >
          <option value="">구분 전체</option>
          {EMPLOYMENT_TYPES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select value={expiring} onChange={(e) => setExpiring(e.target.value)} className={`${inputCls} w-full min-w-0`}>
          <option value="">자격·교육 전체</option>
          <option value="true">30일 내 만료·예정</option>
          <option value="false">해당 없음</option>
        </select>
        {(q || department || position || employmentType || expiring) && (
          <button
            type="button"
            onClick={() => {
              setQ('');
              setDepartment('');
              setPosition('');
              setEmploymentType('');
              setExpiring('');
            }}
            className={`${outlineBtnCls} h-[38px] w-full min-w-0 justify-center px-2`}
          >
            <RotateCcw size={15} /> 초기화
          </button>
        )}
      </div>

      <div className={`${tableWrapCls} overflow-x-auto`}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={thCls}>사번</th>
              <th className={thCls}>성명</th>
              <th className={thCls}>연락처</th>
              <th className={thCls}>회사명</th>
              <th className={thCls}>구분</th>
              <th className={thCls}>부서/직급</th>
              <th className={thCls}>입사일</th>
              <th className={thCls}>자격사항(만료일)</th>
              <th className={thCls}>교육(구분 · 다음 예정)</th>
              <th className={thCls}>관리</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((emp) => (
              <tr key={emp.id} className={trCls}>
                <td className={`${tdCls} tabular whitespace-nowrap`}>{emp.empCode ?? '-'}</td>
                <td className={tdCls}>{emp.name}</td>
                <td className={`${tdCls} tabular`}>{emp.phone ?? '-'}</td>
                <td className={tdCls}>{emp.companyName ?? '-'}</td>
                <td className={tdCls}>{emp.employmentType ?? '-'}</td>
                <td className={tdCls}>{[emp.department, emp.position].filter(Boolean).join(' / ') || '-'}</td>
                <td className={`${tdCls} tabular`}>{emp.hireDate ? emp.hireDate.slice(0, 10) : '-'}</td>
                <td className={`${tdCls} whitespace-nowrap`}>
                  {(() => {
                    const all = sortedCerts(emp);
                    if (all.length === 0) return '-';
                    return (
                      <div className="space-y-1">
                        {all.map((c) => (
                          <div key={c.id} className="flex items-center gap-1.5">
                            {c.certType && <Badge tone="slate">{c.certType}</Badge>}
                            {c.certName}
                            {c.expiryDate && <span className="text-text-faint">~{c.expiryDate.slice(0, 10)}</span>}
                            <DDay due={c.expiryDate} />
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </td>
                <td className={`${tdCls} whitespace-nowrap`}>
                  {(() => {
                    const all = sortedTrainings(emp);
                    if (all.length === 0) return '-';
                    return (
                      <div className="space-y-1">
                        {all.map((t) => (
                          <div key={t.id} className="flex items-center gap-1.5">
                            {t.trainingType && (
                              <Badge tone={t.trainingType === '의무' ? 'amber' : 'blue'}>{t.trainingType}</Badge>
                            )}
                            {t.trainingName}
                            {t.nextDueDate && <span className="text-text-faint">{t.nextDueDate.slice(0, 10)}</span>}
                            <DDay due={t.nextDueDate} />
                          </div>
                        ))}
                      </div>
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
            {visible.length === 0 && (
              <tr>
                <td className={`${tdCls} text-text-faint`} colSpan={10}>
                  {employees.length === 0 ? '등록된 임직원이 없습니다.' : '조건에 맞는 임직원이 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detail && (
        <EmployeeDetailModal
          employeeId={detail.id}
          initial={detail}
          onClose={() => setDetail(null)}
          onChanged={reload}
          onDelete={() => remove(detail)}
        />
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
  const [companyName, setCompanyName] = useState('');
  const [employmentType, setEmploymentType] = useState('정규직');
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
    setEmploymentType('정규직');
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
        companyName: companyName || undefined,
        employmentType: employmentType || undefined,
        department: department || undefined,
        position: position || undefined,
        hireDate: hireDate || undefined,
        certifications: certs
          .filter((c) => c.certName.trim())
          .map((c) => ({
            certName: c.certName,
            certType: c.certType || undefined,
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
            <div className="flex-1">
              {/* 공수표·인건비 집계에서 갈라 보는 값이다. */}
              <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">고용 구분</label>
              <select
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                className={inputCls}
              >
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              {/* 원방 현장에 있어도 소속이 다른 인원이 있어 회사명을 따로 받는다. */}
              <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">회사명</label>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="원방 / 크로스특수 등"
                className={inputCls}
              />
            </div>
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
              <DateField value={hireDate} onChange={(e) => setHireDate(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[13px] font-semibold text-text-mid">
                자격사항 <span className="font-normal text-text-faint">— 자격증명 / 구분 / 취득일 / 만료일</span>
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
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,124px)_minmax(0,140px)_minmax(0,140px)_24px] items-center gap-2">
                  <input
                    list="emp-certs"
                    value={c.certName}
                    onChange={(e) => setCerts(certs.map((r, ri) => (ri === i ? { ...r, certName: e.target.value } : r)))}
                    placeholder="자격증명"
                    className={`${inputCls} min-w-0`}
                  />
                  <select
                    value={c.certType}
                    onChange={(e) => setCerts(certs.map((r, ri) => (ri === i ? { ...r, certType: e.target.value } : r)))}
                    aria-label="구분"
                    className={`${inputCls} min-w-0 px-2`}
                  >
                    {CERT_TYPES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <DateField
                    value={c.acquiredDate}
                    onChange={(e) => setCerts(certs.map((r, ri) => (ri === i ? { ...r, acquiredDate: e.target.value } : r)))}
                    title="취득일"
                    aria-label="취득일"
                    className={`${inputCls} min-w-0`}
                  />
                  <DateField
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
                  <DateField
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
                  <DateField
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
