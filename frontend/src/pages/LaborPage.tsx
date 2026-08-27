import { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { useProjects } from '../hooks/useMasters';
import { FilterField } from '../components/FilterField';
import { SearchSelect } from '../components/SearchSelect';
import { Badge } from '../components/ui/Badge';
import { formatNumber } from '../lib/number';
import { employmentRank } from './EmployeeManagementPage';
import {
  pageTitleCls,
  cardCls,
  cardPadCls,
  tableWrapCls,
  thCls,
  thNumCls,
  tdCls,
  tdNumCls,
  trCls,
} from '../components/ui/classes';
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

const show = (v?: string | null) => (v == null || v === '' ? '-' : v);
const num = (v?: string | null) => (v == null ? 0 : Number(v));
const day = (v?: string | null) => (v ? v.slice(0, 10) : '-');

// 공수표 — 한 줄이 '한 사람의 하루'다. 손익보고서의 인건비는 여기 합계를 더한 값이다.
export function LaborPage() {
  const { projects } = useProjects();
  const [rows, setRows] = useState<Labor[]>([]);
  const [projectId, setProjectId] = useState('');
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
            한 줄이 한 사람의 하루입니다. 여기 합계가 손익보고서의 인건비로 잡힙니다. 입력과 수정은 월 근태·공수 표에서
            합니다 — 이 목록은 보고 지우는 자리입니다.
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

    </div>
  );
}

