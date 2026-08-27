import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { SearchSelect } from './SearchSelect';
import { NumberInput } from './ui/NumberInput';
import { formatNumber } from '../lib/number';
import { kstThisMonth } from '../lib/datetime';
import { EMPLOYMENT_TYPES, employmentRank } from '../pages/EmployeeManagementPage';
import {
  cardCls,
  primaryBtnCls,
  outlineBtnCls,
  inputCls,
  tableWrapCls,
  thCls,
  thNumCls,
  tdCls,
  tdNumCls,
} from './ui/classes';
import type { Project } from '../types';

interface Plan {
  id: string;
  projectId: string;
  employmentType?: string | null;
  startDate: string;
  endDate: string;
  manDays: string;
  unitCost?: string | null;
  memo?: string | null;
}

interface ChartRow {
  employmentType: string;
  plan: Record<string, number>;
  actual: Record<string, number>;
  planTotal: number;
  actualTotal: number;
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const DAY_W = 28;
const NAME_W = 116;
const SUM_W = 72;
const labelCls = 'mb-1.5 block text-[13px] font-semibold text-text-mid';

const weekdayOf = (date: string) => new Date(`${date}T00:00:00`).getDay();
const dayNo = (date: string) => Number(date.slice(8, 10));

// 막대 길이는 그 줄에서 가장 큰 값을 꽉 찬 것으로 본다 —
// 프로젝트마다 인원 규모가 달라 절대 높이로는 견줄 수 없다.
function Bar({ value, max, tone }: { value: number; max: number; tone: 'plan' | 'actual' }) {
  if (!value) return <div className="h-[15px]" />;
  const pct = Math.max(20, Math.round((value / (max || 1)) * 100));
  return (
    <div className="relative h-[15px] px-[3px]" title={`${tone === 'plan' ? '계획' : '실행'} ${formatNumber(value)}공수`}>
      <div className="flex h-full items-end">
        <div
          className={`w-full rounded-[2px] ${tone === 'plan' ? 'bg-primary/30' : 'bg-primary'}`}
          style={{ height: `${pct}%` }}
        />
      </div>
      {/* 몇 공수인지 막대 위에 그대로 적는다 — 길이만으로는 2와 3을 가리기 어렵다. */}
      <span
        className={`absolute inset-0 flex items-center justify-center text-[9px] font-bold ${
          tone === 'plan' ? 'text-text-sub' : 'text-white'
        }`}
      >
        {formatNumber(value)}
      </span>
    </div>
  );
}

// 인력투입계획 — 프로젝트 아래에 구간을 잡고, 그 구간의 계획 공수와 공수표에 쌓인 실행 공수를 견준다.
// 사람을 지목하지 않는다. 한 사람이 여러 프로젝트를 도는 현장이라 원가에 맞는 단위는 공수다.
export function LaborPlanBoard({ projects, defaultProjectId }: { projects: Project[]; defaultProjectId: string }) {
  const [month, setMonth] = useState(kstThisMonth());
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [chart, setChart] = useState<{ days: string[]; rows: ChartRow[] }>({ days: [], rows: [] });
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    const q = projectId ? `?projectId=${projectId}` : '';
    api.get<Plan[]>(`/api/labor-plans${q}`).then(setPlans);
    api
      .get<{ days: string[]; rows: ChartRow[] }>(
        `/api/labor-plans/chart?month=${month}${projectId ? `&projectId=${projectId}` : ''}`,
      )
      .then(setChart);
  }, [month, projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(
    () => [...chart.rows].sort((a, b) => employmentRank(a.employmentType) - employmentRank(b.employmentType)),
    [chart.rows],
  );

  const totals = useMemo(
    () => ({
      plan: rows.reduce((s, r) => s + r.planTotal, 0),
      actual: rows.reduce((s, r) => s + r.actualTotal, 0),
    }),
    [rows],
  );

  const remove = async (p: Plan) => {
    if (!window.confirm('이 계획 줄을 지울까요?')) return;
    await api.del(`/api/labor-plans/${p.id}`);
    load();
  };

  const projectName = (id: string) => projects.find((x) => x.id === id)?.roundName ?? '-';

  return (
    <div>
      <div className={`${cardCls} mb-3 flex flex-wrap items-center gap-2 px-3 py-2`}>
        <input
          type="month"
          value={month}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          className={inputCls}
          style={{ width: 150 }}
          aria-label="계획 월"
        />
        <div style={{ width: 260 }}>
          <SearchSelect
            ariaLabel="프로젝트"
            options={projects.map((p) => ({ value: p.id, label: p.roundName }))}
            value={projectId}
            onChange={setProjectId}
            placeholder="전체 프로젝트"
          />
        </div>
        <span className="ml-2 text-[13px] text-text-sub">
          계획 <b className="text-text-strong">{formatNumber(totals.plan)}</b>공수 · 실행{' '}
          <b className="text-text-strong">{formatNumber(totals.actual)}</b>공수
          {totals.plan > 0 && (
            <span className="ml-1 text-text-faint">(달성 {Math.round((totals.actual / totals.plan) * 100)}%)</span>
          )}
        </span>
        <button type="button" onClick={() => setAdding(true)} className={`${primaryBtnCls} ml-auto`}>
          <Plus size={15} /> 구간 추가
        </button>
      </div>

      {adding && (
        <PlanForm
          projectId={projectId}
          projectLabel={projectId ? projectName(projectId) : '프로젝트를 고르세요'}
          month={month}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            load();
          }}
        />
      )}

      {/* 계획·실행 막대 — 왼쪽 구분과 오른쪽 합계는 붙박이, 가운데 날짜만 민다. */}
      <div className={`${tableWrapCls} overflow-x-auto`}>
        <table className="w-max min-w-full border-collapse">
          <thead>
            <tr className="border-y border-border">
              <th
                className={`${thCls} sticky left-0 z-20 whitespace-nowrap bg-card`}
                style={{ width: NAME_W, minWidth: NAME_W }}
              >
                구분
              </th>
              {chart.days.map((d) => {
                const w = weekdayOf(d);
                return (
                  <th
                    key={d}
                    className={`px-0 py-1.5 text-center text-[11px] font-bold ${
                      w === 0 ? 'text-danger' : w === 6 ? 'text-primary' : 'text-text-sub'
                    }`}
                    style={{ width: DAY_W, minWidth: DAY_W }}
                  >
                    {dayNo(d)}
                    <span className="block text-[10px] font-normal opacity-70">{WEEK[w]}</span>
                  </th>
                );
              })}
              {['계획', '실행', '달성'].map((label, i) => (
                <th
                  key={label}
                  className={`${thNumCls} sticky z-20 whitespace-nowrap bg-card`}
                  style={{ right: (2 - i) * SUM_W, width: SUM_W, minWidth: SUM_W }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const max = Math.max(...chart.days.map((d) => Math.max(r.plan[d] ?? 0, r.actual[d] ?? 0)), 1);
              return (
                <tr key={r.employmentType} className="border-b border-border">
                  <td
                    className="sticky left-0 z-20 whitespace-nowrap bg-card px-3 py-1.5 text-[13px] font-semibold text-text-strong"
                    style={{ width: NAME_W, minWidth: NAME_W }}
                  >
                    {r.employmentType}
                    <span className="block text-[11px] font-normal text-text-faint">계획 / 실행</span>
                  </td>
                  {chart.days.map((d) => {
                    const w = weekdayOf(d);
                    return (
                      <td
                        key={d}
                        className={`p-0 align-bottom ${w === 0 || w === 6 ? 'bg-hover/40' : ''}`}
                        style={{ width: DAY_W, minWidth: DAY_W }}
                      >
                        <Bar value={r.plan[d] ?? 0} max={max} tone="plan" />
                        <Bar value={r.actual[d] ?? 0} max={max} tone="actual" />
                      </td>
                    );
                  })}
                  {[
                    formatNumber(r.planTotal),
                    formatNumber(r.actualTotal),
                    r.planTotal ? `${Math.round((r.actualTotal / r.planTotal) * 100)}%` : '-',
                  ].map((v, i) => (
                    <td
                      key={i}
                      className={`${tdNumCls} sticky z-20 bg-card ${i === 2 ? 'font-extrabold text-text-strong' : ''}`}
                      style={{ right: (2 - i) * SUM_W, width: SUM_W, minWidth: SUM_W }}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={chart.days.length + 4} className="py-10 text-center text-[13px] text-text-faint">
                  이 달에 잡힌 계획도, 쌓인 공수도 없습니다. 오른쪽 위 구간 추가로 계획을 세웁니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 잡아 둔 구간 목록 — 계획을 보고 지우는 자리다. */}
      <div className={`${tableWrapCls} mt-4`}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={thCls}>프로젝트</th>
              <th className={thCls}>구분</th>
              <th className={thCls}>기간</th>
              <th className={thNumCls}>하루 공수</th>
              <th className={thNumCls}>계획 단가</th>
              <th className={thCls}>비고</th>
              <th className={thCls}>관리</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-hover">
                <td className={tdCls}>{projectName(p.projectId)}</td>
                <td className={tdCls}>{p.employmentType ?? '-'}</td>
                <td className={`${tdCls} tabular whitespace-nowrap`}>
                  {p.startDate.slice(0, 10)} ~ {p.endDate.slice(0, 10)}
                </td>
                <td className={tdNumCls}>{formatNumber(p.manDays)}</td>
                <td className={tdNumCls}>{p.unitCost ? formatNumber(p.unitCost) : '-'}</td>
                <td className={tdCls}>{p.memo ?? '-'}</td>
                <td className={tdCls}>
                  <button
                    type="button"
                    onClick={() => remove(p)}
                    title="계획 삭제"
                    className="text-text-sub hover:text-danger"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {plans.length === 0 && (
              <tr>
                <td className={`${tdCls} text-text-faint`} colSpan={7}>
                  잡아 둔 계획이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// 구간은 달력에서 고른다 — 날짜를 두 번 눌러 시작과 끝을 잡는다.
// 손으로 날짜를 두 번 적는 것보다 눈으로 주말·주차를 보며 고르는 편이 현장에 맞는다.
function RangeCalendar({
  month,
  from,
  to,
  onPick,
}: {
  month: string;
  from: string;
  to: string;
  onPick: (date: string) => void;
}) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const lead = new Date(y, m - 1, 1).getDay();
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ];

  return (
    <div>
      <div className="grid grid-cols-7 gap-px text-center">
        {WEEK.map((w, i) => (
          <div
            key={w}
            className={`py-1 text-[11px] font-bold ${i === 0 ? 'text-danger' : i === 6 ? 'text-primary' : 'text-text-faint'}`}
          >
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const inRange = !!from && !!to && d >= from && d <= to;
          const edge = d === from || d === to;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onPick(d)}
              className={`h-[30px] rounded-[6px] text-[12px] font-semibold ${
                edge
                  ? 'bg-primary text-white'
                  : inRange
                    ? 'bg-primary/20 text-text-strong'
                    : 'text-text-sub hover:bg-hover'
              }`}
            >
              {Number(d.slice(8, 10))}
            </button>
          );
        })}
      </div>
    </div>
  );
}


function PlanForm({
  projectId,
  projectLabel,
  month,
  onClose,
  onSaved,
}: {
  projectId: string;
  projectLabel: string;
  month: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  // 구간 하나에 구분별 공수를 함께 적는다 — 구분마다 구간을 다시 고르지 않는다.
  const [lines, setLines] = useState<Record<string, { manDays: string; unitCost: string }>>(
    Object.fromEntries(EMPLOYMENT_TYPES.map((t) => [t, { manDays: '', unitCost: '' }])),
  );
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const setLine = (type: string, patch: Partial<{ manDays: string; unitCost: string }>) =>
    setLines((prev) => ({ ...prev, [type]: { ...prev[type], ...patch } }));

  // 처음 누르면 시작일, 두 번째로 누르면 종료일. 이미 둘 다 잡혀 있으면 다시 시작한다.
  const pick = (d: string) => {
    if (!from || (from && to)) {
      setFrom(d);
      setTo('');
      return;
    }
    if (d < from) {
      setFrom(d);
      return;
    }
    setTo(d);
  };

  const days = from && to ? Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1 : from ? 1 : 0;
  const endDate = to || from;
  const perDay = EMPLOYMENT_TYPES.reduce((sum, t) => sum + Number(lines[t].manDays || 0), 0);
  const total = days * perDay;

  const save = async () => {
    if (!projectId) {
      setError('위에서 프로젝트를 먼저 고르세요.');
      return;
    }
    if (!from) {
      setError('달력에서 구간을 고르세요.');
      return;
    }
    if (perDay <= 0) {
      setError('공수를 적은 구분이 없습니다.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await api.post('/api/labor-plans/bulk', {
        projectId,
        startDate: from,
        endDate,
        memo: memo || undefined,
        items: EMPLOYMENT_TYPES.map((t) => ({
          employmentType: t,
          manDays: Number(lines[t].manDays || 0),
          unitCost: lines[t].unitCost ? Number(lines[t].unitCost) : undefined,
        })),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`${cardCls} mb-3 p-3`}>
      <div className="grid gap-4 [grid-template-columns:minmax(0,300px)_minmax(0,1fr)]">
        <div>
          <span className={labelCls}>구간 — 날짜를 두 번 눌러 시작과 끝을 고릅니다</span>
          <RangeCalendar month={month} from={from} to={endDate} onPick={pick} />
        </div>

        <div>
          <p className="mb-2 text-[13px] text-text-sub">
            <b className="text-text-strong">{projectLabel}</b>
            {from ? (
              <span className="ml-2">
                {from} ~ {endDate} · {days}일
                {perDay > 0 && (
                  <span className="ml-1 text-text-faint">
                    · 하루 {formatNumber(perDay)}공수 = 계획 {formatNumber(total)}공수
                  </span>
                )}
              </span>
            ) : (
              <span className="ml-2 text-text-faint">구간을 고르지 않았습니다.</span>
            )}
          </p>

          {/* 이 구간에 어느 구분을 하루 몇 공수 쓸지 — 적은 구분만 저장된다. */}
          <div className="grid grid-cols-[minmax(0,1fr)_90px_110px] gap-x-2 gap-y-1">
            <span className="text-[12px] font-semibold text-text-faint">고용 구분</span>
            <span className="text-right text-[12px] font-semibold text-text-faint">하루 공수</span>
            <span className="text-right text-[12px] font-semibold text-text-faint">계획 단가(원)</span>
            {EMPLOYMENT_TYPES.map((t) => (
              <Fragment key={t}>
                <span className="flex items-center text-[13px] font-semibold text-text-mid">{t}</span>
                <NumberInput
                  value={lines[t].manDays}
                  onChange={(v) => setLine(t, { manDays: v })}
                  decimals={2}
                  placeholder="0"
                />
                <NumberInput
                  value={lines[t].unitCost}
                  onChange={(v) => setLine(t, { unitCost: v })}
                  placeholder={t === '정규직' ? '해당 없음' : '0'}
                />
              </Fragment>
            ))}
          </div>

          <div className="mt-2">
            <label className={labelCls}>비고</label>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} className={inputCls} />
          </div>

          <p className="mt-2 text-[12px] text-text-faint">
            1명이 하루 나오면 1공수입니다 — 정규직 2명이면 2, 반나절이 섞이면 2.5로 적습니다. 정규직은 인건비를
            프로젝트 원가에 넣지 않으므로 단가를 비워 둡니다.
          </p>

          {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}

          <div className="mt-3 flex justify-end gap-2 border-t border-border pt-3">
            <button type="button" onClick={onClose} className={outlineBtnCls}>
              취소
            </button>
            <button type="button" disabled={busy} onClick={save} className={primaryBtnCls}>
              {busy ? '저장 중...' : '계획 저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
