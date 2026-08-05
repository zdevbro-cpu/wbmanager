import { useCallback, useEffect, useState } from 'react';
import { Users, Plus, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { useCommonCodes } from '../hooks/useMasters';
import {
  pageTitleCls,
  sectionTitleCls,
  cardPadCls,
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
  trainingDate: string;
}

const emptyCert: CertRow = { certName: '', acquiredDate: '', expiryDate: '' };
const emptyTraining: TrainingRow = { trainingName: '', trainingDate: '' };

export function EmployeeManagementPage({ embedded = false }: { embedded?: boolean }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
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

  const reload = useCallback(() => {
    api.get<Employee[]>('/api/employees').then(setEmployees);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

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
      await api.post('/api/employees', {
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
          .map((t) => ({ trainingName: t.trainingName, trainingDate: t.trainingDate || undefined })),
      });
      reset();
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {!embedded && (
        <div className="mb-5 flex items-center gap-2">
          <Users size={20} className="text-primary" />
          <h1 className={pageTitleCls}>임직원 관리</h1>
        </div>
      )}

      <p className="mb-4 text-[13px] text-text-sub">
        임직원 기본정보와 자격사항·교육이력을 한 번에 등록합니다. 자격증 종류·교육 과정·부서·직급 목록은 공통코드 관리에서
        관리합니다.
      </p>

      <div className="flex flex-wrap gap-6">
        <form onSubmit={handleSubmit} className={`${cardPadCls} min-w-[320px] flex-1 space-y-3.5`}>
          <h2 className={sectionTitleCls}>임직원 등록</h2>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">성명</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">연락처</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" className={inputCls} />
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
              <label className="text-[13px] font-semibold text-text-mid">자격사항</label>
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
                <div key={i} className="flex items-center gap-2">
                  <input
                    list="emp-certs"
                    value={c.certName}
                    onChange={(e) => setCerts(certs.map((r, ri) => (ri === i ? { ...r, certName: e.target.value } : r)))}
                    placeholder="자격증명"
                    className={inputCls}
                  />
                  <input
                    type="date"
                    value={c.acquiredDate}
                    onChange={(e) => setCerts(certs.map((r, ri) => (ri === i ? { ...r, acquiredDate: e.target.value } : r)))}
                    title="취득일"
                    className={inputCls}
                  />
                  <input
                    type="date"
                    value={c.expiryDate}
                    onChange={(e) => setCerts(certs.map((r, ri) => (ri === i ? { ...r, expiryDate: e.target.value } : r)))}
                    title="만료일"
                    className={inputCls}
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
              <label className="text-[13px] font-semibold text-text-mid">교육이력</label>
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
                <div key={i} className="flex items-center gap-2">
                  <input
                    list="emp-trainings"
                    value={t.trainingName}
                    onChange={(e) =>
                      setTrainings(trainings.map((r, ri) => (ri === i ? { ...r, trainingName: e.target.value } : r)))
                    }
                    placeholder="교육명"
                    className={inputCls}
                  />
                  <input
                    type="date"
                    value={t.trainingDate}
                    onChange={(e) =>
                      setTrainings(trainings.map((r, ri) => (ri === i ? { ...r, trainingDate: e.target.value } : r)))
                    }
                    title="교육일"
                    className={inputCls}
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

        <div className="min-w-[320px] flex-1">
          <h2 className={`${sectionTitleCls} mb-2`}>임직원 목록</h2>
          <div className={tableWrapCls}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className={thCls}>성명</th>
                  <th className={thCls}>연락처</th>
                  <th className={thCls}>부서/직급</th>
                  <th className={thCls}>자격사항</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id} className={trCls}>
                    <td className={tdCls}>{emp.name}</td>
                    <td className={`${tdCls} tabular`}>{emp.phone ?? '-'}</td>
                    <td className={tdCls}>{[emp.department, emp.position].filter(Boolean).join(' / ') || '-'}</td>
                    <td className={tdCls}>
                      {emp.certifications?.length
                        ? emp.certifications
                            .map((c) => `${c.certName}${c.expiryDate ? ` (~${c.expiryDate.slice(0, 10)})` : ''}`)
                            .join(', ')
                        : '-'}
                    </td>
                  </tr>
                ))}
                {employees.length === 0 && (
                  <tr>
                    <td className={`${tdCls} text-text-faint`} colSpan={4}>
                      등록된 임직원이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
