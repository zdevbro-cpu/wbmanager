import { useCallback, useEffect, useState } from 'react';
import { Users, Plus, Trash2, ChevronDown } from 'lucide-react';
import { api } from '../api/client';
import { useCommonCodes } from '../hooks/useMasters';
import { FormModal } from '../components/FormModal';
import { QrCode } from '../components/QrCode';
import { Badge } from '../components/ui/Badge';
import { primaryBtnCls, outlineBtnCls, inputCls } from '../components/ui/classes';
import type { Employee } from '../types';

const TRAINING_TYPES = ['의무', '보수'];

function addMonths(date: string, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function daysLeft(due?: string | null) {
  if (!due) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(due.slice(0, 10));
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function DDay({ due }: { due?: string | null }) {
  const left = daysLeft(due);
  if (left === null) return <span className="text-text-faint">-</span>;
  if (left < 0) return <Badge tone="red">D+{Math.abs(left)} 경과</Badge>;
  if (left === 0) return <Badge tone="red">D-DAY</Badge>;
  if (left <= 30) return <Badge tone="red">D-{left}</Badge>;
  return <Badge tone="slate">D-{left}</Badge>;
}

const day = (v?: string | null) => (v ? v.slice(0, 10) : '-');

// 상세 — 최근 내용 카드 + 히스토리(접이식) + 이력 추가.
// 자격 갱신·보수교육 재이수는 기존 행을 고치지 않고 새 행을 쌓아 이력을 남긴다.
export function EmployeeDetailModal({
  employeeId,
  initial,
  onClose,
  onChanged,
  onDelete,
}: {
  employeeId: string;
  /** 목록에서 이미 받아 둔 값 — 상세 조회가 늦거나 실패해도 화면이 비지 않게 한다. */
  initial?: Employee;
  onClose: () => void;
  onChanged: () => void;
  onDelete: () => void;
}) {
  const [emp, setEmp] = useState<Employee | null>(initial ?? null);
  const [loadError, setLoadError] = useState('');
  const [adding, setAdding] = useState<'cert' | 'training' | null>(null);
  const { labels: certOptions } = useCommonCodes('자격증 종류');
  const { labels: trainingOptions } = useCommonCodes('교육 과정');

  const load = useCallback(() => {
    api
      .get<Employee>(`/api/employees/${employeeId}`)
      .then((row) => {
        setEmp(row);
        setLoadError('');
      })
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : '상세를 불러오지 못했습니다.'));
  }, [employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = () => {
    load();
    onChanged();
  };

  const certs = [...(emp?.certifications ?? [])].sort(
    (a, b) =>
      new Date(b.expiryDate ?? b.acquiredDate ?? 0).getTime() - new Date(a.expiryDate ?? a.acquiredDate ?? 0).getTime(),
  );
  const trainings = [...(emp?.trainings ?? [])].sort(
    (a, b) =>
      new Date(b.nextDueDate ?? b.trainingDate ?? 0).getTime() - new Date(a.nextDueDate ?? a.trainingDate ?? 0).getTime(),
  );

  const removeCert = async (id: string) => {
    if (!window.confirm('이 자격 이력을 삭제하시겠습니까?')) return;
    await api.del(`/api/employees/${employeeId}/certifications/${id}`);
    refresh();
  };

  const removeTraining = async (id: string) => {
    if (!window.confirm('이 교육 이력을 삭제하시겠습니까?')) return;
    await api.del(`/api/employees/${employeeId}/trainings/${id}`);
    refresh();
  };

  return (
    <FormModal title={`${emp?.name ?? ''} 상세`} icon={Users} onClose={onClose}>
      {!emp ? (
        <p className={loadError ? 'text-[13px] text-danger' : 'text-[13px] text-text-sub'}>
          {loadError || '불러오는 중...'}
        </p>
      ) : (
        <div className="space-y-5">
          {loadError && <p className="text-[12.5px] text-danger">최신 정보를 불러오지 못했습니다: {loadError}</p>}
          <div className="flex items-center gap-2">
            <Badge tone="blue">{emp.empCode ?? '-'}</Badge>
            <span className="text-[13px] text-text-sub">
              {[emp.department, emp.position].filter(Boolean).join(' · ') || '부서·직급 미지정'}
            </span>
            <button
              type="button"
              onClick={() => setAdding('cert')}
              className={`${outlineBtnCls} ml-auto h-8 px-3 text-[12.5px]`}
            >
              <Plus size={14} /> 자격 이력 추가
            </button>
            <button type="button" onClick={() => setAdding('training')} className={`${outlineBtnCls} h-8 px-3 text-[12.5px]`}>
              <Plus size={14} /> 교육 이력 추가
            </button>
          </div>

          <div className="flex gap-5">
            <dl className="grid flex-1 grid-cols-2 gap-x-5 gap-y-2">
              {[
                { label: '사번', value: emp.empCode ?? '-' },
                { label: '성명', value: emp.name },
                { label: '연락처', value: emp.phone ?? '-' },
                { label: '입사일', value: day(emp.hireDate) },
                { label: '부서', value: emp.department ?? '-' },
                { label: '직급', value: emp.position ?? '-' },
              ].map((f) => (
                <div key={f.label} className="flex justify-between gap-3 border-b border-border pb-1.5">
                  <dt className="text-[12.5px] text-text-sub">{f.label}</dt>
                  <dd className="text-[13px] font-semibold text-text-strong">{f.value}</dd>
                </div>
              ))}
            </dl>
            {emp.empCode && (
              <div className="shrink-0">
                <QrCode value={emp.empCode} fileName={`${emp.empCode}_${emp.name}`} size={130} />
              </div>
            )}
          </div>

          {adding === 'cert' && (
            <CertForm
              employeeId={employeeId}
              options={certOptions}
              onDone={() => {
                setAdding(null);
                refresh();
              }}
              onCancel={() => setAdding(null)}
            />
          )}
          {adding === 'training' && (
            <TrainingForm
              employeeId={employeeId}
              options={trainingOptions}
              onDone={() => {
                setAdding(null);
                refresh();
              }}
              onCancel={() => setAdding(null)}
            />
          )}

          <HistorySection
            title="자격사항"
            total={certs.length}
            emptyText="등록된 자격사항이 없습니다."
            onRemoveLatest={certs[0] ? () => removeCert(certs[0].id) : undefined}
            latest={
              certs[0] ? (
                <div className="grid grid-cols-2 gap-x-5 gap-y-2">
                  <Field label="자격증명" value={certs[0].certName} />
                  <Field label="취득일" value={day(certs[0].acquiredDate)} />
                  <Field label="만료일" value={day(certs[0].expiryDate)} />
                  <div className="flex justify-between gap-3">
                    <span className="text-[12.5px] text-text-sub">잔여</span>
                    <DDay due={certs[0].expiryDate} />
                  </div>
                </div>
              ) : null
            }
            rows={certs.slice(1).map((c) => ({
              id: c.id,
              badge: <Badge tone="slate">자격</Badge>,
              summary: `${c.certName} · ${day(c.acquiredDate)} ~ ${day(c.expiryDate)}`,
              onRemove: () => removeCert(c.id),
            }))}
          />

          <HistorySection
            title="교육이력"
            total={trainings.length}
            emptyText="등록된 교육이력이 없습니다."
            onRemoveLatest={trainings[0] ? () => removeTraining(trainings[0].id) : undefined}
            latest={
              trainings[0] ? (
                <div className="grid grid-cols-2 gap-x-5 gap-y-2">
                  <Field label="교육명" value={trainings[0].trainingName} />
                  <Field label="구분" value={trainings[0].trainingType ?? '-'} />
                  <Field label="이수일" value={day(trainings[0].trainingDate)} />
                  <Field label="다음 예정일" value={day(trainings[0].nextDueDate)} />
                  <div className="flex justify-between gap-3">
                    <span className="text-[12.5px] text-text-sub">잔여</span>
                    <DDay due={trainings[0].nextDueDate} />
                  </div>
                </div>
              ) : null
            }
            rows={trainings.slice(1).map((t) => ({
              id: t.id,
              badge: <Badge tone={t.trainingType === '의무' ? 'amber' : 'blue'}>{t.trainingType ?? '교육'}</Badge>,
              summary: `${t.trainingName} · 이수 ${day(t.trainingDate)} · 다음 ${day(t.nextDueDate)}`,
              onRemove: () => removeTraining(t.id),
            }))}
          />

          <div className="flex justify-end border-t border-border pt-3">
            <button type="button" onClick={onDelete} className={`${outlineBtnCls} text-danger`}>
              <Trash2 size={15} /> 임직원 삭제
            </button>
          </div>
        </div>
      )}
    </FormModal>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[12.5px] text-text-sub">{label}</span>
      <span className="text-[13px] font-semibold text-text-strong">{value}</span>
    </div>
  );
}

// 최근 1건은 카드로 펼쳐 두고, 지난 이력은 건수와 함께 접어 둔다.
function HistorySection({
  title,
  latest,
  rows,
  total,
  onRemoveLatest,
  emptyText,
}: {
  title: string;
  latest: React.ReactNode;
  rows: { id: string; badge: React.ReactNode; summary: string; onRemove: () => void }[];
  total: number;
  onRemoveLatest?: () => void;
  emptyText: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <h3 className="mb-2 text-[14px] font-extrabold text-text-strong">최근 {title}</h3>
      {latest ? (
        <div className="relative rounded-[10px] border border-border bg-input p-3.5">
          {latest}
          {onRemoveLatest && (
            <button
              type="button"
              onClick={onRemoveLatest}
              title="삭제"
              className="absolute top-2 right-2 text-text-faint hover:text-danger"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ) : (
        <p className="text-[13px] text-text-faint">{emptyText}</p>
      )}

      {rows.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-text-strong"
          >
            {title} 히스토리 <span className="text-text-faint">({total})</span>
            <ChevronDown size={14} className={open ? 'rotate-180' : ''} />
          </button>
          {open && (
            <div className="space-y-1.5">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center gap-2 rounded-[8px] border border-border px-3 py-2">
                  {r.badge}
                  <span className="text-[13px] text-text">{r.summary}</span>
                  <button
                    type="button"
                    onClick={r.onRemove}
                    title="삭제"
                    className="ml-auto text-text-faint hover:text-danger"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CertForm({
  employeeId,
  options,
  onDone,
  onCancel,
}: {
  employeeId: string;
  options: string[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [certName, setCertName] = useState('');
  const [acquiredDate, setAcquiredDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certName.trim()) return;
    await api.post(`/api/employees/${employeeId}/certifications`, {
      certName,
      acquiredDate: acquiredDate || undefined,
      expiryDate: expiryDate || undefined,
    });
    onDone();
  };

  return (
    <form onSubmit={submit} className="rounded-[10px] border border-primary/40 bg-input p-3.5">
      <p className="mb-2 text-[13px] font-bold text-text-strong">
        자격 이력 추가 <span className="font-normal text-text-faint">— 갱신 시에도 새 이력으로 쌓입니다</span>
      </p>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,150px)_minmax(0,150px)_auto] items-center gap-2">
        <input
          list="detail-certs"
          value={certName}
          onChange={(e) => setCertName(e.target.value)}
          placeholder="자격증명"
          className={`${inputCls} min-w-0`}
        />
        <datalist id="detail-certs">
          {options.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
        <input
          type="date"
          value={acquiredDate}
          onChange={(e) => setAcquiredDate(e.target.value)}
          aria-label="취득일"
          className={`${inputCls} min-w-0`}
        />
        <input
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          aria-label="만료일"
          className={`${inputCls} min-w-0`}
        />
        <div className="flex gap-2">
          <button type="submit" className={`${primaryBtnCls} h-9 whitespace-nowrap px-4`}>
            추가
          </button>
          <button type="button" onClick={onCancel} className={`${outlineBtnCls} h-9 px-3`}>
            취소
          </button>
        </div>
      </div>
    </form>
  );
}

function TrainingForm({
  employeeId,
  options,
  onDone,
  onCancel,
}: {
  employeeId: string;
  options: string[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [trainingName, setTrainingName] = useState('');
  const [trainingType, setTrainingType] = useState('의무');
  const [trainingDate, setTrainingDate] = useState('');
  const [cycleMonths, setCycleMonths] = useState('12');
  const [nextDueDate, setNextDueDate] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trainingName.trim()) return;
    await api.post(`/api/employees/${employeeId}/trainings`, {
      trainingName,
      trainingType: trainingType || undefined,
      trainingDate: trainingDate || undefined,
      cycleMonths: cycleMonths ? Number(cycleMonths) : undefined,
      // 비우면 이수일 + 주기로 서버가 산출한다.
      nextDueDate: nextDueDate || undefined,
    });
    onDone();
  };

  return (
    <form onSubmit={submit} className="rounded-[10px] border border-primary/40 bg-input p-3.5">
      <p className="mb-2 text-[13px] font-bold text-text-strong">
        교육 이력 추가 <span className="font-normal text-text-faint">— 재이수 시에도 새 이력으로 쌓입니다</span>
      </p>
      <div className="grid grid-cols-[minmax(0,1fr)_84px_minmax(0,132px)_72px_minmax(0,132px)_auto] items-center gap-2">
        <input
          list="detail-trainings"
          value={trainingName}
          onChange={(e) => setTrainingName(e.target.value)}
          placeholder="교육명"
          className={`${inputCls} min-w-0`}
        />
        <datalist id="detail-trainings">
          {options.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
        <select
          value={trainingType}
          onChange={(e) => setTrainingType(e.target.value)}
          aria-label="구분"
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
          value={trainingDate}
          onChange={(e) => setTrainingDate(e.target.value)}
          aria-label="이수일"
          className={`${inputCls} min-w-0`}
        />
        <input
          type="number"
          min="1"
          value={cycleMonths}
          onChange={(e) => setCycleMonths(e.target.value)}
          aria-label="주기(개월)"
          placeholder="주기"
          className={`${inputCls} min-w-0 px-2`}
        />
        <input
          type="date"
          value={nextDueDate}
          onChange={(e) => setNextDueDate(e.target.value)}
          aria-label="다음 예정일"
          placeholder={trainingDate && cycleMonths ? addMonths(trainingDate, Number(cycleMonths)) : ''}
          className={`${inputCls} min-w-0`}
        />
        <div className="flex gap-2">
          <button type="submit" className={`${primaryBtnCls} h-9 whitespace-nowrap px-4`}>
            추가
          </button>
          <button type="button" onClick={onCancel} className={`${outlineBtnCls} h-9 px-3`}>
            취소
          </button>
        </div>
      </div>
    </form>
  );
}
