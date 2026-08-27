import { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, Plus, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { useProjects, useEmployees, useCommonCodes } from '../hooks/useMasters';
import { FormModal } from '../components/FormModal';
import { FilterField } from '../components/FilterField';
import { SearchSelect } from '../components/SearchSelect';
import { NumberInput } from '../components/ui/NumberInput';
import { DateField } from '../components/ui/DateField';
import { Badge } from '../components/ui/Badge';
import { formatNumber } from '../lib/number';
import { employmentRank, EMPLOYMENT_TYPES } from './EmployeeManagementPage';
import { kstToday } from '../lib/datetime';
import {
  pageTitleCls,
  cardCls,
  cardPadCls,
  primaryBtnCls,
  outlineBtnCls,
  inputCls,
  tableWrapCls,
  thCls,
  thNumCls,
  tdCls,
  tdNumCls,
  trCls,
} from '../components/ui/classes';
import type { Project } from '../types';
import { LaborMonthGrid } from '../components/LaborMonthGrid';


interface Labor {
  id: string;
  projectId: string;
  workDate: string;
  workerName?: string | null;
  workerType?: string | null;
  totalManDays?: string | null;
  unitCost?: string | null;
  laborCost?: string | null;
  mealCost?: string | null;
  toolCost?: string | null;
  fuelCost?: string | null;
  suppliesCost?: string | null;
  totalAmount?: string | null;
}

const labelCls = 'mb-1.5 block text-[13px] font-semibold text-text-mid';
const show = (v?: string | null) => (v == null || v === '' ? '-' : v);
const num = (v?: string | null) => (v == null ? 0 : Number(v));
const day = (v?: string | null) => (v ? v.slice(0, 10) : '-');

// 공수표 — 한 줄이 '한 사람의 하루'다. 손익보고서의 인건비는 여기 합계를 더한 값이다.
export function LaborPage() {
  const { projects } = useProjects();
  const [rows, setRows] = useState<Labor[]>([]);
  const [projectId, setProjectId] = useState('');
  const [open, setOpen] = useState(false);
  // 월 근태·공수가 기본 화면이다. 지금까지 쓰던 날짜별 목록은 탭으로 그대로 남긴다.
  const [tab, setTab] = useState<'month' | 'list'>('month');

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    api.get<Labor[]>(`/api/labors?${params.toString()}`).then(setRows);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (row: Labor) => {
    if (!window.confirm(`${day(row.workDate)} ${show(row.workerName)} 공수를 삭제할까요?`)) return;
    await api.del(`/api/labors/${row.id}`);
    load();
  };

  const totals = useMemo(
    () => ({
      manDays: rows.reduce((s, r) => s + num(r.totalManDays), 0),
      amount: rows.reduce((s, r) => s + num(r.totalAmount), 0),
    }),
    [rows],
  );

  // 인원별 소계 — 누가 며칠 나왔는지 한눈에 본다.
  const byWorker = useMemo(() => {
    const map = new Map<string, { name: string; type: string; manDays: number; amount: number }>();
    for (const r of rows) {
      const name = r.workerName ?? '-';
      if (!map.has(name)) map.set(name, { name, type: r.workerType ?? '-', manDays: 0, amount: 0 });
      const e = map.get(name)!;
      e.manDays += num(r.totalManDays);
      e.amount += num(r.totalAmount);
    }
    // 정규직 → 계약직 → 일용직 → 아르바이트 차례로 세우고, 같은 구분 안에서는 이름순이다.
    return [...map.values()].sort(
      (a, b) => employmentRank(a.type) - employmentRank(b.type) || a.name.localeCompare(b.name),
    );
  }, [rows]);

  // 목록도 같은 차례다 — 고용 구분, 이름, 그다음 작업일 최신순.
  const sortedRows = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          employmentRank(a.workerType) - employmentRank(b.workerType) ||
          (a.workerName ?? '').localeCompare(b.workerName ?? '') ||
          (b.workDate ?? '').localeCompare(a.workDate ?? ''),
      ),
    [rows],
  );

  const projectName = (id: string) => projects.find((p) => p.id === id)?.roundName ?? '-';

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <Users size={20} className="text-primary" />
        <h1 className={pageTitleCls}>공수표 관리</h1>
        <span className="ml-1 text-[13px] text-text-sub">
          {rows.length}건 · {formatNumber(totals.manDays)}공수 · {formatNumber(totals.amount)}원
        </span>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-[9px] border border-border p-0.5">
            {([['month', '월 근태·공수'], ['list', '날짜별 목록']] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`rounded-[7px] px-3 py-1.5 text-[13px] font-semibold ${
                  tab === k ? 'bg-primary text-white' : 'text-text-sub hover:bg-hover'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === 'list' && (
            <button type="button" onClick={() => setOpen(true)} className={primaryBtnCls}>
              <Plus size={15} /> 공수 등록
            </button>
          )}
        </div>
      </div>

      {tab === 'month' && <LaborMonthGrid projects={projects} defaultProjectId={projectId} />}

      {tab === 'list' && (
        <>
        <div className={`${cardCls} mb-4 grid items-end gap-3 p-3 [grid-template-columns:minmax(0,320px)_minmax(0,1fr)]`}>
          <FilterField label="프로젝트">
            <SearchSelect
              ariaLabel="프로젝트"
              options={projects.map((p) => ({ value: p.id, label: p.roundName }))}
              value={projectId}
              onChange={setProjectId}
            />
          </FilterField>
          <p className="pb-2 text-[12.5px] text-text-faint">
            한 줄이 한 사람의 하루입니다. 여기 합계가 손익보고서의 인건비로 잡힙니다.
          </p>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-4">
          <div className={`${tableWrapCls} overflow-x-auto`}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-y border-border">
                  <th className={thCls}>작업일</th>
                  <th className={thCls}>프로젝트</th>
                  <th className={thCls}>작업자</th>
                  <th className={thCls}>구분</th>
                  <th className={thNumCls}>공수</th>
                  <th className={thNumCls}>단가</th>
                  <th className={thNumCls}>인건비</th>
                  <th className={thNumCls}>식대</th>
                  <th className={thNumCls}>기타</th>
                  <th className={thNumCls}>합계</th>
                  <th className={thCls}>관리</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => (
                  <tr key={r.id} className={trCls}>
                    <td className={`${tdCls} tabular whitespace-nowrap`}>{day(r.workDate)}</td>
                    <td className={tdCls}>{projectName(r.projectId)}</td>
                    <td className={`${tdCls} font-semibold text-text-strong`}>{show(r.workerName)}</td>
                    <td className={tdCls}>{r.workerType ? <Badge tone="blue">{r.workerType}</Badge> : '-'}</td>
                    <td className={tdNumCls}>{formatNumber(r.totalManDays)}</td>
                    <td className={tdNumCls}>{formatNumber(r.unitCost)}</td>
                    <td className={tdNumCls}>{formatNumber(r.laborCost)}</td>
                    <td className={tdNumCls}>{formatNumber(r.mealCost)}</td>
                    <td className={tdNumCls}>
                      {formatNumber(num(r.toolCost) + num(r.fuelCost) + num(r.suppliesCost))}
                    </td>
                    <td className={`${tdNumCls} font-bold text-text-strong`}>{formatNumber(r.totalAmount)}</td>
                    <td className={tdCls}>
                      <button
                        type="button"
                        title="삭제"
                        onClick={() => remove(r)}
                        className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-danger"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-10 text-center text-[13px] text-text-faint">
                      등록된 공수가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className={cardPadCls}>
            <h2 className="mb-2 text-[15px] font-extrabold text-text-strong">인원별 소계</h2>
            {byWorker.length === 0 ? (
              <p className="text-[13px] text-text-faint">집계할 공수가 없습니다.</p>
            ) : (
              <div className="space-y-1.5">
                {byWorker.map((w) => (
                  <div key={w.name} className="flex items-center justify-between gap-2 border-b border-border pb-1.5">
                    <span className="min-w-0 truncate text-[13px] text-text">
                      {w.name} <span className="text-[12px] text-text-faint">{w.type}</span>
                    </span>
                    <span className="tabular shrink-0 text-[13px] font-semibold text-text-strong">
                      {formatNumber(w.manDays)}공수
                      <span className="ml-2 font-normal text-text-sub">{formatNumber(w.amount)}원</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </>
      )}

      {open && (
        <FormModal title="공수 등록" icon={Users} wide onClose={() => setOpen(false)}>
          <LaborForm
            projects={projects}
            defaultProjectId={projectId}
            onDone={() => {
              setOpen(false);
              load();
            }}
            onCancel={() => setOpen(false)}
          />
        </FormModal>
      )}
    </div>
  );
}

function LaborForm({
  projects,
  defaultProjectId,
  onDone,
  onCancel,
}: {
  projects: Project[];
  defaultProjectId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { employees } = useEmployees();
  // 임직원에 없는 현장 인력도 한 번 적어 두면 다음부터 목록에서 고를 수 있다.
  const { labels: workerCodes } = useCommonCodes('작업자');
  const workerOptions = [
    ...employees.map((e) => ({ value: e.name, label: e.name })),
    ...workerCodes.filter((n) => !employees.some((e) => e.name === n)).map((n) => ({ value: n, label: n })),
  ];
  const [f, setF] = useState({
    projectId: defaultProjectId,
    workDate: kstToday(),
    employeeId: '',
    workerName: '',
    workerType: '정규직',
    totalManDays: '1',
    unitCost: '',
    mealCost: '',
    toolCost: '',
    fuelCost: '',
    suppliesCost: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch });

  // 인건비 = 공수 × 단가, 합계 = 인건비 + 식대 + 공구 + 유류 + 소모품
  const laborCost = f.workerType === '정규직' ? 0 : Number(f.totalManDays || 0) * Number(f.unitCost || 0);
  const total =
    laborCost + Number(f.mealCost || 0) + Number(f.toolCost || 0) + Number(f.fuelCost || 0) + Number(f.suppliesCost || 0);

  const pickWorker = (name: string) => {
    const emp = employees.find((e) => e.name === name);
    // 그 사람에게 정해 둔 품값을 끌어온다 — 아직 비어 있는 칸만 채우고, 적어 둔 값은 그대로 둔다.
    set({
      workerName: name,
      // 임직원에 연결해 보낸다 — 월 표의 칸과 같은 줄을 가리키게 하기 위해서다.
      employeeId: emp?.id ?? '',
      ...(emp?.employmentType ? { workerType: emp.employmentType } : {}),
      ...(emp?.unitCost && !f.unitCost ? { unitCost: emp.unitCost } : {}),
      ...(emp?.mealCost && !f.mealCost ? { mealCost: emp.mealCost } : {}),
      ...(emp?.etcCost && !f.suppliesCost ? { suppliesCost: emp.etcCost } : {}),
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.projectId) {
      setError('프로젝트를 고르세요.');
      return;
    }
    if (!f.workerName.trim()) {
      setError('작업자를 적으세요.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await api.post('/api/labors', {
        projectId: f.projectId,
        workDate: f.workDate,
        employeeId: f.employeeId || undefined,
        workerName: f.workerName.trim(),
        workerType: f.workerType || undefined,
        totalManDays: Number(f.totalManDays || 0),
        unitCost: f.unitCost ? Number(f.unitCost) : undefined,
        laborCost,
        mealCost: f.mealCost ? Number(f.mealCost) : undefined,
        toolCost: f.toolCost ? Number(f.toolCost) : undefined,
        fuelCost: f.fuelCost ? Number(f.fuelCost) : undefined,
        suppliesCost: f.suppliesCost ? Number(f.suppliesCost) : undefined,
        totalAmount: total,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className={cardPadCls}>
      <div className="grid grid-cols-4 gap-x-3 gap-y-3.5">
        <div className="col-span-2">
          <label className={labelCls}>
            프로젝트 <span className="text-danger">*</span>
          </label>
          <SearchSelect
            ariaLabel="프로젝트"
            options={projects.map((p) => ({ value: p.id, label: p.roundName }))}
            value={f.projectId}
            onChange={(v) => set({ projectId: v })}
          />
        </div>

        <div>
          <label className={labelCls}>
            작업일 <span className="text-danger">*</span>
          </label>
          <DateField value={f.workDate} onChange={(e) => set({ workDate: e.target.value })} />
        </div>

        <div>
          <label className={labelCls}>
            작업자 <span className="text-danger">*</span>
          </label>
          <SearchSelect
            ariaLabel="작업자"
            options={workerOptions}
            value={f.workerName}
            onChange={pickWorker}
            placeholder="검색 또는 직접 입력"
            allowFree
          />
        </div>

        <div>
          <label className={labelCls}>구분</label>
          <select value={f.workerType} onChange={(e) => set({ workerType: e.target.value })} className={inputCls}>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>공수</label>
          <NumberInput value={f.totalManDays} onChange={(v) => set({ totalManDays: v })} decimals={2} />
          <p className="mt-1 text-[12px] text-text-faint">하루 1, 반나절 0.5</p>
        </div>

        {/* 정규직은 급여로 나가므로 프로젝트 인건비에 넣지 않는다. 공수만 센다. */}
        <div>
          <label className={labelCls}>1공수 단가(원)</label>
          {f.workerType === '정규직' ? (
            <div className={`${inputCls} flex items-center text-text-faint`}>인건비 제외 · 공수만 집계</div>
          ) : (
            <NumberInput value={f.unitCost} onChange={(v) => set({ unitCost: v })} />
          )}
        </div>

        <div>
          <label className={labelCls}>식대(원)</label>
          <NumberInput value={f.mealCost} onChange={(v) => set({ mealCost: v })} />
        </div>

        <div>
          <label className={labelCls}>공구(원)</label>
          <NumberInput value={f.toolCost} onChange={(v) => set({ toolCost: v })} />
        </div>

        <div>
          <label className={labelCls}>유류(원)</label>
          <NumberInput value={f.fuelCost} onChange={(v) => set({ fuelCost: v })} />
        </div>

        <div>
          <label className={labelCls}>소모품(원)</label>
          <NumberInput value={f.suppliesCost} onChange={(v) => set({ suppliesCost: v })} />
        </div>

        <p className="col-span-4 text-[13px] text-text-sub">
          인건비 <span className="tabular font-bold text-text-strong">{formatNumber(laborCost)}</span> 원
          <span className="mx-2 text-text-faint">/</span>
          합계 <span className="tabular font-bold text-text-strong">{formatNumber(total)}</span> 원
          <span className="ml-1 text-text-faint">= 공수 × 단가 + 식대 + 공구 + 유류 + 소모품</span>
        </p>
      </div>

      {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}

      <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
        <button type="button" onClick={onCancel} className={outlineBtnCls}>
          취소
        </button>
        <button type="submit" disabled={submitting} className={primaryBtnCls}>
          {submitting ? '등록 중...' : '등록'}
        </button>
      </div>
    </form>
  );
}
