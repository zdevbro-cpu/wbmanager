import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarRange, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { FormModal } from './FormModal';
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
  projectId: string;
  employmentType: string;
  plan: Record<string, number>;
  actual: Record<string, number>;
  planTotal: number;
  actualTotal: number;
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const LABEL_W = 176; // 전체 보기에서는 현장 이름까지 들어간다
const SUM_W = 72;
const labelCls = 'mb-1.5 block text-[13px] font-semibold text-text-mid';

const weekdayOf = (date: string) => new Date(`${date}T00:00:00`).getDay();

// 'YYYY-MM' 을 앞뒤로 옮긴다. 12월에서 한 칸 더 가면 다음 해 1월이다.
function shiftMonth(month: string, step: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + step, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// 봐야 할 것은 계획과 실행 두 값이 아니라 그 차이다 —
// 모자란 날, 맞은 날, 넘친 날. 그래서 칸 색은 달성 상태를 뜻한다.
// 고용 구분은 줄 이름 옆 점으로 남긴다 — 색을 둘 다에 쓰면 아무 뜻도 남지 않는다.
const TYPE_COLOR: Record<string, string> = {
  정규직: '37, 99, 235',
  현장직: '22, 163, 74',
  계약직: '245, 158, 11',
  일용직: '147, 51, 234',
  프리랜서: '219, 39, 119',
  타사직원: '100, 116, 139',
  아르바이트: '13, 148, 136',
  미지정: '100, 116, 139',
};
const colorOf = (type: string) => TYPE_COLOR[type] ?? TYPE_COLOR.미지정;

// 하루 실적을 계획과 견준 판정 — 막대 색이 곧 답이다.
const DAY_TONE: Record<'short' | 'ok' | 'over', string> = {
  short: 'rgb(96, 165, 250)', // 미달 — 덜 썼다
  ok: 'rgb(250, 204, 21)', // 적정 — 계획 막대(주황)와 갈라 보이도록 노랑
  over: 'rgb(248, 113, 113)', // 초과 — 계획보다 더 들어가 원가를 민다
};
// 계획 막대 — 밝은 주황 한 가지. 윤곽선 없이 면으로만 둔다.
const PLAN_FILL = 'rgb(255, 138, 0)';




// 현장인력계획 — 프로젝트 아래에 구간을 잡고, 그 구간의 계획 공수와 공수표에 쌓인 실행 공수를 견준다.
// 사람을 지목하지 않는다. 한 사람이 여러 프로젝트를 도는 현장이라 원가에 맞는 단위는 공수다.
export function LaborPlanBoard({ projects, defaultProjectId }: { projects: Project[]; defaultProjectId: string }) {
  const [month, setMonth] = useState(kstThisMonth());
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [chart, setChart] = useState<{ days: string[]; rows: ChartRow[] }>({ days: [], rows: [] });
  const [adding, setAdding] = useState(false);
  // 막대나 구분을 누르면 그 계획 한 건을 자세히 본다.
  const [detail, setDetail] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);

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

  // 이 달에 걸친 계획만 막대로 그린다. 막대 하나가 계획 한 건이다.
  // 실행은 그 구분·그 구간의 공수를 모아 견준다. 같은 구분의 계획이 겹치면
  // 그 날 실행이 양쪽에 다 잡히므로, 겹치게 잡지 않는 것을 전제로 한다.
  const monthPlans = useMemo(() => {
    if (!chart.days.length) return [];
    const first = chart.days[0];
    const last = chart.days[chart.days.length - 1];
    const byKey = new Map(chart.rows.map((r) => [`${r.projectId}|${r.employmentType}`, r]));

    return plans
      .filter((p) => p.startDate.slice(0, 10) <= last && p.endDate.slice(0, 10) >= first)
      .map((p) => {
        const from = p.startDate.slice(0, 10) < first ? first : p.startDate.slice(0, 10);
        const to = p.endDate.slice(0, 10) > last ? last : p.endDate.slice(0, 10);
        const span = chart.days.filter((d) => d >= from && d <= to);
        const row = byKey.get(`${p.projectId}|${p.employmentType ?? '미지정'}`);
        const actualTotal = span.reduce((sum, d) => sum + (row?.actual[d] ?? 0), 0);
        const planTotal = span.length * Number(p.manDays || 0);
        return {
          ...p,
          offset: chart.days.indexOf(from),
          days: span.length,
          planTotal,
          actualTotal,
          rate: planTotal ? actualTotal / planTotal : 0,
        };
      })
      .sort((a, b) => employmentRank(a.employmentType) - employmentRank(b.employmentType) || a.offset - b.offset);
  }, [plans, chart]);

  const dayCount = chart.days.length || 1;

  // 눈금은 1일과 5일 간격, 그리고 말일.
  const ticks = useMemo(() => {
    const t = [1];
    for (let d = 5; d < dayCount; d += 5) t.push(d);
    t.push(dayCount);
    return [...new Set(t)];
  }, [dayCount]);

  // 하루 합계 — 구분을 모두 더한 값. 하루 단위는 이 한 줄에서만 본다.
  const dayTotals = useMemo(() => {
    const plan: Record<string, number> = {};
    const actual: Record<string, number> = {};
    for (const d of chart.days) {
      plan[d] = chart.rows.reduce((s, r) => s + (r.plan[d] ?? 0), 0);
      actual[d] = chart.rows.reduce((s, r) => s + (r.actual[d] ?? 0), 0);
    }
    return { plan, actual };
  }, [chart]);

  const dayMax = Math.max(...chart.days.map((d) => Math.max(dayTotals.plan[d] ?? 0, dayTotals.actual[d] ?? 0)), 1);

  const remove = async (p: Plan) => {
    if (!window.confirm('이 계획 줄을 지울까요?')) return;
    await api.del(`/api/labor-plans/${p.id}`);
    load();
  };

  const projectName = (id: string) => projects.find((x) => x.id === id)?.roundName ?? '-';

  return (
    <div>
      <div className={`${cardCls} mb-3 flex items-center gap-2 px-3 py-2`}>
        <MonthPicker month={month} onChange={setMonth} />
        <div className="min-w-[150px] max-w-[240px] flex-1">
          <SearchSelect
            ariaLabel="프로젝트"
            options={projects.map((p) => ({ value: p.id, label: p.roundName }))}
            value={projectId}
            onChange={setProjectId}
            placeholder="전체 프로젝트"
          />
        </div>
        <span className="ml-2 shrink-0 whitespace-nowrap text-[13px] text-text-sub">
          계획 <b className="text-text-strong">{formatNumber(totals.plan)}</b>공수 · 실행{' '}
          <b className="text-text-strong">{formatNumber(totals.actual)}</b>공수
          {totals.plan > 0 && (
            <span className="ml-1 text-text-faint">(달성 {Math.round((totals.actual / totals.plan) * 100)}%)</span>
          )}
        </span>
        <span className="ml-2 min-w-0 flex-1 truncate text-[11px] text-text-faint">
          막대 길이는 기간, 채움은 달성률 · 막대를 누르면 상세
        </span>
        <button type="button" onClick={() => setAdding(true)} className={`${primaryBtnCls} shrink-0`}>
          <Plus size={15} /> 공수 추가
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

      {/* 계획은 구간이 단위다 — 한 계획이 막대 하나다.
          하루하루는 아래 합계 한 줄에서만 본다. 같은 것을 31칸으로 펴면 구조가 사라진다. */}
      <div className={`${cardCls} mb-4 p-3`}>
        {monthPlans.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-text-faint">
            이 달에 잡힌 계획이 없습니다. 오른쪽 위 공수 추가로 계획을 세웁니다.
          </p>
        ) : (
          <>
            {/* 날짜 눈금 */}
            <div className="mb-1 flex items-end gap-3">
              <div className="shrink-0" style={{ width: LABEL_W }} />
              <div className="relative h-[14px] flex-1">
                {ticks.map((t) => (
                  <span
                    key={t}
                    className="absolute -translate-x-1/2 text-[10.5px] text-text-faint"
                    style={{ left: `${((t - 0.5) / dayCount) * 100}%` }}
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="shrink-0 text-right text-[10.5px] text-text-faint" style={{ width: SUM_W * 2 }}>
                계획 · 실행 · 달성
              </div>
            </div>

            <div className="space-y-1">
              {monthPlans.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setDetail(p.id)}
                  className="flex cursor-pointer items-center gap-3 rounded-[6px] px-1 py-0.5 hover:bg-hover"
                  title="눌러서 상세 보기"
                >
                  <div className="shrink-0 truncate" style={{ width: LABEL_W }}>
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-text-strong">
                      <span
                        className="inline-block h-[9px] w-[9px] shrink-0 rounded-full"
                        style={{ backgroundColor: `rgb(${colorOf(p.employmentType ?? '미지정')})` }}
                      />
                      {p.employmentType ?? '미지정'}
                    </span>
                    <span className="block truncate text-[11px] text-text-faint">
                      {!projectId && `${projectName(p.projectId)} · `}하루 {formatNumber(p.manDays)}공수 · {p.days}일
                    </span>
                  </div>

                  {/* 막대 — 길이가 기간, 채움이 달성률이다. */}
                  <div className="relative h-[11px] flex-1 rounded-[3px] bg-white/[0.06]">
                    {/* 주말 자리를 옅게 깔아 주 단위가 보이게 한다. */}
                    {chart.days.map((d, i) =>
                      weekdayOf(d) === 0 || weekdayOf(d) === 6 ? (
                        <span
                          key={d}
                          className="absolute top-0 bottom-0 bg-black/15"
                          style={{ left: `${(i / dayCount) * 100}%`, width: `${(1 / dayCount) * 100}%` }}
                        />
                      ) : null,
                    )}
                    <div
                      className="absolute top-0 bottom-0 overflow-hidden rounded-[3px]"
                      style={{
                        left: `${(p.offset / dayCount) * 100}%`,
                        width: `${(p.days / dayCount) * 100}%`,
                        backgroundColor: `rgba(${colorOf(p.employmentType ?? '미지정')}, 0.16)`,
                        boxShadow: `inset 0 0 0 1px rgba(${colorOf(p.employmentType ?? '미지정')}, 1), 0 0 7px rgba(${colorOf(p.employmentType ?? '미지정')}, 0.5)`,
                      }}
                    >
                      <div
                        className="absolute top-0 bottom-0 left-0"
                        style={{
                          width: `${Math.min(100, p.rate * 100)}%`,
                          backgroundColor: `rgb(${colorOf(p.employmentType ?? '미지정')})`,
                          boxShadow: `0 0 8px rgba(${colorOf(p.employmentType ?? '미지정')}, 0.6)`,
                        }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold leading-none text-white drop-shadow">
                        {p.rate > 0 ? `${Math.round(p.rate * 100)}%` : ''}
                      </span>
                    </div>
                  </div>

                  <div
                    className="tabular shrink-0 text-right text-[12px] text-text-sub"
                    style={{ width: SUM_W * 2 }}
                  >
                    {formatNumber(p.planTotal)} · <b className="text-text-strong">{formatNumber(p.actualTotal)}</b> ·{' '}
                    <span className={p.rate >= 1 ? 'font-bold text-success' : 'font-bold text-danger'}>
                      {p.planTotal ? `${Math.round(p.rate * 100)}%` : '-'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* 합계 — 하루 단위는 여기서만 본다. 막대 색이 그날의 판정이다. */}
            <div className="mt-3 flex items-end gap-3 border-t border-border pt-3">
              <div className="shrink-0 text-[12px] font-semibold text-text-mid" style={{ width: LABEL_W }}>
                합계
                <span className="block text-[11px] font-normal text-text-faint">
                  위 숫자 실행 · 아래 숫자 계획
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {[
                      ['계획', PLAN_FILL],
                      ['미달', DAY_TONE.short],
                      ['적정', DAY_TONE.ok],
                      ['초과', DAY_TONE.over],
                    ].map(([label, rgb]) => (
                      <span key={label} className="flex items-center gap-0.5">
                        <span
                          className="inline-block h-[8px] w-[10px] rounded-[2px]"
                          style={{ backgroundColor: rgb }}
                        />
                        {label}
                      </span>
                    ))}
                  </span>
                </span>
              </div>
              <div className="flex h-[132px] flex-1 items-end gap-[1px]">
                {chart.days.map((d) => {
                  const plan = dayTotals.plan[d] ?? 0;
                  const actual = dayTotals.actual[d] ?? 0;
                  // 그날이 모자란지 맞는지 넘쳤는지를 색으로 못 박는다.
                  const tone = !plan && !actual ? null : actual < plan ? 'short' : actual > plan ? 'over' : 'ok';
                  return (
                    <div
                      key={d}
                      className="relative flex-1"
                      title={`${d} · 계획 ${formatNumber(plan)} · 실행 ${formatNumber(actual)}공수`}
                    >
                      {/* 막대 높이만으로는 3과 4를 가리기 어렵다 — 위에 실행, 아래에 계획을 적는다. */}
                      <div className="mb-0.5 h-[14px] text-center text-[10px] font-extrabold leading-none">
                        {actual ? (
                          <span style={{ color: tone ? DAY_TONE[tone] : undefined }}>{formatNumber(actual)}</span>
                        ) : plan ? (
                          <span className="text-text-faint">0</span>
                        ) : null}
                      </div>
                      <div className="flex h-[100px] items-end">
                        <div
                          className="w-full rounded-t-[2px]"
                          style={{
                            height: `${(plan / dayMax) * 100}%`,
                            backgroundColor: PLAN_FILL,
                            boxShadow: '0 0 6px rgba(255, 138, 0, 0.55)',
                          }}
                        />
                      </div>
                      <div className="absolute inset-x-0 bottom-[18px] flex h-[100px] items-end">
                        <div
                          className="w-full rounded-t-[2px]"
                          style={{
                            height: `${(actual / dayMax) * 100}%`,
                            backgroundColor: tone ? DAY_TONE[tone] : undefined,
                          }}
                        />
                      </div>
                      <div className="mt-0.5 h-[14px] text-center text-[10px] leading-none text-text-faint">
                        {plan ? formatNumber(plan) : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="shrink-0 text-right text-[12px] text-text-sub" style={{ width: SUM_W * 2 }}>
                <span className="tabular">{formatNumber(totals.plan)}</span> ·{' '}
                <b className="tabular text-text-strong">{formatNumber(totals.actual)}</b>
              </div>
            </div>
          </>
        )}
      </div>

      {detail && (
        <PlanDetail
          plan={monthPlans.find((p) => p.id === detail)!}
          projectLabel={projectName(monthPlans.find((p) => p.id === detail)!.projectId)}
          days={chart.days}
          actualOf={(d) => {
            const p = monthPlans.find((x) => x.id === detail)!;
            return (
              chart.rows.find(
                (r) => r.projectId === p.projectId && r.employmentType === (p.employmentType ?? '미지정'),
              )?.actual[d] ?? 0
            );
          }}
          onClose={() => setDetail(null)}
          onDeleted={() => {
            setDetail(null);
            load();
          }}
        />
      )}

      {/* 잡아 둔 구간 목록 — 계획을 보고 지우는 자리다.
          평소에는 접어 둔다. 위 막대가 주인공이고 이 표는 손볼 때만 편다. */}
      <button
        type="button"
        onClick={() => setListOpen((v) => !v)}
        className="mt-4 flex items-center gap-1.5 text-[13px] font-semibold text-text-sub hover:text-text-strong"
      >
        {listOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        계획 목록 {plans.length}건
        <span className="text-[12px] font-normal text-text-faint">{listOpen ? '접기' : '펼치기'}</span>
      </button>

      <div className={`${tableWrapCls} mt-2 ${listOpen ? '' : 'hidden'}`}>
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
                <td className={tdNumCls}>
                  {p.employmentType === '정규직' ? '해당 없음' : p.unitCost ? formatNumber(p.unitCost) : '-'}
                </td>
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
          unitCost: t !== '정규직' && lines[t].unitCost ? Number(lines[t].unitCost) : undefined,
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
                {t === '정규직' ? (
                  <span className="flex h-[38px] items-center justify-end pr-3 text-[12.5px] text-text-faint">
                    해당 없음
                  </span>
                ) : (
                  <NumberInput
                    value={lines[t].unitCost}
                    onChange={(v) => setLine(t, { unitCost: v })}
                    placeholder="0"
                  />
                )}
              </Fragment>
            ))}
          </div>

          <div className="mt-2">
            <label className={labelCls}>비고</label>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} className={inputCls} />
          </div>

          <p className="mt-2 text-[12px] text-text-faint">
            1명이 하루 나오면 1공수입니다 — 정규직 2명이면 2, 반나절이 섞이면 2.5로 적습니다. 정규직은 급여로
            나가 프로젝트 원가에 넣지 않으므로 계획 단가를 받지 않습니다.
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

// 계획 한 건을 자세히 본다 — 며칠에 얼마를 잡았고 그 날 실제로 몇 공수가 들어왔는지.
function PlanDetail({
  plan,
  projectLabel,
  days,
  actualOf,
  onClose,
  onDeleted,
}: {
  plan: {
    id: string;
    employmentType?: string | null;
    startDate: string;
    endDate: string;
    manDays: string;
    unitCost?: string | null;
    memo?: string | null;
    offset: number;
    days: number;
    planTotal: number;
    actualTotal: number;
    rate: number;
  };
  projectLabel: string;
  days: string[];
  actualOf: (date: string) => number;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const type = plan.employmentType ?? '미지정';
  const span = days.slice(plan.offset, plan.offset + plan.days);
  const perDay = Number(plan.manDays || 0);
  const cost = plan.unitCost ? plan.planTotal * Number(plan.unitCost) : null;

  const remove = async () => {
    if (!window.confirm('이 계획 줄을 지울까요?')) return;
    await api.del(`/api/labor-plans/${plan.id}`);
    onDeleted();
  };

  return (
    <FormModal title="계획 상세" icon={CalendarRange} onClose={onClose}>
      <div className="rounded-[10px] border border-border bg-input p-4">
        <p className="mb-3 flex items-center gap-2 text-[14px] font-bold text-text-strong">
          <span
            className="inline-block h-[10px] w-[10px] rounded-full"
            style={{ backgroundColor: `rgb(${colorOf(type)})` }}
          />
          {type}
          <span className="text-[12.5px] font-normal text-text-sub">{projectLabel}</span>
        </p>

        <dl className="grid grid-cols-2 gap-x-5 gap-y-2">
          {[
            ['기간', `${plan.startDate.slice(0, 10)} ~ ${plan.endDate.slice(0, 10)}`],
            ['이 달 걸친 날', `${plan.days}일`],
            ['하루 공수', `${formatNumber(perDay)}공수 (${formatNumber(perDay)}명)`],
            ['계획 공수', `${formatNumber(plan.planTotal)}공수`],
            ['실행 공수', `${formatNumber(plan.actualTotal)}공수`],
            ['달성', plan.planTotal ? `${Math.round(plan.rate * 100)}%` : '-'],
            ['계획 단가', plan.unitCost ? `${formatNumber(plan.unitCost)}원` : '-'],
            ['계획 인건비', cost == null ? '-' : `${formatNumber(cost)}원`],
            ['비고', plan.memo ?? '-'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 border-b border-border pb-1.5">
              <dt className="text-[12.5px] text-text-sub">{label}</dt>
              <dd className="text-[13px] font-semibold text-text-strong">{value}</dd>
            </div>
          ))}
        </dl>

        {/* 날짜별 — 잡아 둔 공수와 그 날 실제로 들어온 공수. */}
        <div className="mt-4 max-h-[240px] overflow-y-auto rounded-[8px] border border-border">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border">
                <th className={thCls}>날짜</th>
                <th className={thNumCls}>계획</th>
                <th className={thNumCls}>실행</th>
                <th className={thNumCls}>차이</th>
              </tr>
            </thead>
            <tbody>
              {span.map((d) => {
                const actual = actualOf(d);
                const gap = actual - perDay;
                return (
                  <tr key={d} className="border-b border-border last:border-0">
                    <td className={`${tdCls} tabular whitespace-nowrap`}>
                      {d.slice(5)} ({WEEK[weekdayOf(d)]})
                    </td>
                    <td className={tdNumCls}>{formatNumber(perDay)}</td>
                    <td className={tdNumCls}>{formatNumber(actual)}</td>
                    <td
                      className={`${tdNumCls} font-bold ${gap < 0 ? 'text-danger' : gap > 0 ? 'text-primary' : 'text-text-faint'}`}
                    >
                      {gap === 0 ? '·' : gap > 0 ? `+${formatNumber(gap)}` : formatNumber(gap)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-between gap-2 border-t border-border pt-3">
          <button type="button" onClick={remove} className={`${outlineBtnCls} text-danger`}>
            <Trash2 size={14} /> 계획 삭제
          </button>
          <button type="button" onClick={onClose} className={outlineBtnCls}>
            닫기
          </button>
        </div>
      </div>
    </FormModal>
  );
}

// 기준월 — 누르면 연·월을 고르고, 키보드로도 옮긴다.
// 좌우는 달, 위아래는 해다. 손이 어디 있든 한 손으로 옮길 수 있어야 한다.
function MonthPicker({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const year = Number(month.slice(0, 4));
  const mm = Number(month.slice(5, 7));

  const set = (y: number, m: number) => onChange(`${y}-${String(m).padStart(2, '0')}`);

  return (
    <div className="relative shrink-0">
      <div
        tabIndex={0}
        onKeyDown={(e) => {
          const step: Record<string, [number, number]> = {
            ArrowLeft: [0, -1],
            ArrowRight: [0, 1],
            ArrowUp: [1, 0],
            ArrowDown: [-1, 0],
          };
          const s = step[e.key];
          if (!s) return;
          e.preventDefault();
          if (s[1]) onChange(shiftMonth(month, s[1]));
          else set(year + s[0], mm);
        }}
        title="← → 달 이동 · ↑ ↓ 해 이동 · 눌러서 골라 넣기"
        className="flex h-[38px] w-[176px] items-center justify-between gap-0.5 rounded-[8px] border border-border bg-input px-1 outline-none focus:border-primary"
      >
        <button
          type="button"
          onClick={() => onChange(shiftMonth(month, -1))}
          aria-label="이전 달"
          className="rounded-[6px] px-1 py-1 text-text-sub hover:bg-hover hover:text-text-strong"
        >
          <ChevronLeft size={15} />
        </button>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="tabular flex items-center gap-1 rounded-[6px] px-1 text-[13px] font-bold text-text-strong hover:bg-hover"
        >
          {year}년 {String(mm).padStart(2, '0')}월
          <span className="flex flex-col leading-[6px] text-text-faint">
            <ChevronUp size={11} />
            <ChevronDown size={11} />
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChange(shiftMonth(month, 1))}
          aria-label="다음 달"
          className="rounded-[6px] px-1 py-1 text-text-sub hover:bg-hover hover:text-text-strong"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {open && (
        <>
          {/* 바깥을 누르면 닫힌다. */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-[42px] left-0 z-40 w-[236px] rounded-[10px] border border-border bg-card p-2 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => set(year - 1, mm)}
                aria-label="이전 해"
                className="rounded-[6px] px-2 py-1 text-text-sub hover:bg-hover hover:text-text-strong"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="tabular text-[14px] font-extrabold text-text-strong">{year}년</span>
              <button
                type="button"
                onClick={() => set(year + 1, mm)}
                aria-label="다음 해"
                className="rounded-[6px] px-2 py-1 text-text-sub hover:bg-hover hover:text-text-strong"
              >
                <ChevronRight size={15} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    set(year, m);
                    setOpen(false);
                  }}
                  className={`rounded-[7px] py-1.5 text-[12.5px] font-semibold ${
                    m === mm ? 'bg-primary text-white' : 'text-text-sub hover:bg-hover hover:text-text-strong'
                  }`}
                >
                  {m}월
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
