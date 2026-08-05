import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Inbox, PackageMinus, Recycle, Trash2, Coins, Layers } from 'lucide-react';
import { api } from '../api/client';
import { useProjects } from '../hooks/useMasters';
import { SummaryCard } from '../components/ui/SummaryCard';
import { FilterField } from '../components/FilterField';
import {
  pageTitleCls,
  sectionTitleCls,
  cardCls,
  cardPadCls,
  inputCls,
  tableWrapCls,
  thCls,
  tdCls,
  trCls,
} from '../components/ui/classes';
import type { Aggregation, AggregationGroup } from '../types';

function monthRange(month: string) {
  if (!month) return { from: '', to: '' };
  const [y, m] = month.split('-').map(Number);
  const from = `${month}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${month}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

const kg = (v: number) => `${Math.round(v).toLocaleString()}kg`;
const won = (v: number) => `${Math.round(v).toLocaleString()}원`;

export function AggregationPage() {
  const { projects } = useProjects();
  const [month, setMonth] = useState('');
  const [projectId, setProjectId] = useState('');
  const [data, setData] = useState<Aggregation | null>(null);

  const search = () => {
    const { from, to } = monthRange(month);
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (projectId) params.set('projectId', projectId);
    api.get<Aggregation>(`/api/reports/aggregation?${params.toString()}`).then((res) =>
      setData({
        ...res,
        byProject: res.byProject ?? [],
        bySite: res.bySite ?? [],
        byVendor: res.byVendor ?? [],
        byItem: res.byItem ?? [],
        byType: res.byType ?? [],
        byMonth: res.byMonth ?? [],
        byDay: res.byDay ?? [],
        totals: res.totals ?? { inbound: 0, waste_inbound: 0, sorting: 0, outbound_sale: 0, waste_outbound: 0, amount: 0 },
      }),
    );
  };

  // 기준일/기간 변경 시 즉시 재집계 (S-TCUYZO)
  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, projectId]);

  // 반입 대비 처리 진척 — 보고서가 매번 손으로 계산하던 회수율이다.
  const flow = useMemo(() => {
    if (!data) return null;
    const inTotal = data.totals.inbound + data.totals.waste_inbound;
    const outTotal = data.totals.outbound_sale + data.totals.waste_outbound;
    return {
      inTotal,
      outTotal,
      remain: Math.max(0, inTotal - outTotal),
      rate: inTotal > 0 ? (outTotal / inTotal) * 100 : 0,
    };
  }, [data]);

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <BarChart3 size={20} className="text-primary" />
        <h1 className={pageTitleCls}>자동집계 현황</h1>
        {month && <span className="ml-1 text-[13px] text-text-sub">{month}</span>}
      </div>

      <div className={`${cardCls} mb-4 grid items-end gap-3 p-3 [grid-template-columns:180px_minmax(0,1fr)_minmax(0,2fr)]`}>
        <FilterField label="기준 월">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={`${inputCls} px-2`} />
        </FilterField>
        <FilterField label="프로젝트">
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={`${inputCls} px-2`}>
            <option value="">전체</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.roundName}
              </option>
            ))}
          </select>
        </FilterField>
        <p className="pb-2 text-[12.5px] text-text-faint">
          월을 비우면 전체 기간이 집계됩니다. 원본 갑지의 월별·현장별·거래처별 피벗을 대신합니다.
        </p>
      </div>

      {data && flow && (
        <div className="space-y-6">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
            <SummaryCard icon={Inbox} color="#60a5fa" label="입고" value={kg(data.totals.inbound)} />
            <SummaryCard icon={Recycle} color="#fb923c" label="폐기물입고" value={kg(data.totals.waste_inbound)} />
            <SummaryCard icon={Layers} color="#a78bfa" label="선별" value={kg(data.totals.sorting)} />
            <SummaryCard icon={PackageMinus} color="#22c55e" label="매각" value={kg(data.totals.outbound_sale)} />
            <SummaryCard icon={Trash2} color="#f59e0b" label="폐기물반출" value={kg(data.totals.waste_outbound)} />
            <SummaryCard icon={Coins} color="#38bdf8" label="금액합계" value={won(data.totals.amount)} />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
            <FlowCard flow={flow} />
            <MonthlyTrend groups={data.byMonth} />
          </div>

          <DensityStrip groups={data.byDay} month={month} />

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
            <ShareCard title="품목 구성 (중량 상위 6)" groups={data.byItem} metric="weight" color="#60a5fa" />
            <ShareCard title="거래처 구성 (금액 상위 6)" groups={data.byVendor} metric="amount" color="#22c55e" />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
            <GroupTable title="① 프로젝트별 소계" groups={data.byProject} />
            <GroupTable title="② 현장별 소계" groups={data.bySite} emptyText="프로젝트에 현장명이 없습니다." />
            <GroupTable title="③ 거래처별 소계" groups={data.byVendor} />
            <GroupTable title="④ 품목별 소계" groups={data.byItem} />
            <GroupTable title="⑤ 구분별 소계" groups={data.byType} />
            <GroupTable title="⑥ 월별 소계" groups={data.byMonth} />
          </div>
        </div>
      )}
    </div>
  );
}

// 반입 → 처리 흐름. 남은 물량이 곧 야적장 재고라 회수율과 함께 본다.
function FlowCard({ flow }: { flow: { inTotal: number; outTotal: number; remain: number; rate: number } }) {
  const outPct = flow.inTotal > 0 ? (flow.outTotal / flow.inTotal) * 100 : 0;

  return (
    <div className={cardPadCls}>
      <h2 className={`${sectionTitleCls} mb-3 text-[15px]`}>반입 대비 처리 현황</h2>

      <div className="mb-2 flex items-end justify-between">
        <span className="text-[12.5px] text-text-sub">처리율(매각+반출 ÷ 반입)</span>
        <span className="tabular text-[22px] font-extrabold text-text-strong">{flow.rate.toFixed(1)}%</span>
      </div>

      <div className="mb-3 h-3 w-full overflow-hidden rounded-full bg-input">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, outPct)}%` }} />
      </div>

      <dl className="grid grid-cols-3 gap-3">
        {[
          { label: '반입 합계', value: kg(flow.inTotal) },
          { label: '처리 합계', value: kg(flow.outTotal) },
          { label: '잔여(재고)', value: kg(flow.remain) },
        ].map((f) => (
          <div key={f.label} className="rounded-[8px] border border-border px-3 py-2">
            <dt className="text-[12px] text-text-sub">{f.label}</dt>
            <dd className="tabular text-[15px] font-bold text-text-strong">{f.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// 월별 추이 — 막대 높이로 물량을, 아래 숫자로 금액을 읽는다.
function MonthlyTrend({ groups }: { groups: AggregationGroup[] }) {
  const rows = (groups ?? []).slice(-12);
  const max = Math.max(1, ...rows.map((g) => g.inbound + g.waste_inbound + g.outbound_sale + g.waste_outbound));

  return (
    <div className={cardPadCls}>
      <h2 className={`${sectionTitleCls} mb-3 text-[15px]`}>월별 추이 (반입 / 처리)</h2>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-text-faint">집계할 데이터가 없습니다.</p>
      ) : (
        <div className="flex h-[150px] items-end gap-3">
          {rows.map((g) => {
            const inTotal = g.inbound + g.waste_inbound;
            const outTotal = g.outbound_sale + g.waste_outbound;
            return (
              <div key={g.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <div className="flex h-[110px] w-full items-end justify-center gap-1">
                  <div
                    title={`반입 ${kg(inTotal)}`}
                    className="w-1/2 rounded-t-[3px] bg-[#60a5fa]"
                    style={{ height: `${(inTotal / max) * 100}%` }}
                  />
                  <div
                    title={`처리 ${kg(outTotal)}`}
                    className="w-1/2 rounded-t-[3px] bg-[#22c55e]"
                    style={{ height: `${(outTotal / max) * 100}%` }}
                  />
                </div>
                <span className="tabular truncate text-[11px] text-text-faint">{g.label?.slice(2)}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-3 flex gap-4 text-[11.5px] text-text-sub">
        <span className="flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-[2px] bg-[#60a5fa]" /> 반입
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-[2px] bg-[#22c55e]" /> 처리
        </span>
      </div>
    </div>
  );
}

// 구성비 — 상위 항목이 전체에서 차지하는 몫을 가로 막대로 본다.
function ShareCard({
  title,
  groups,
  metric,
  color,
}: {
  title: string;
  groups: AggregationGroup[];
  metric: 'weight' | 'amount';
  color: string;
}) {
  const value = (g: AggregationGroup) =>
    metric === 'amount' ? g.amount : g.inbound + g.waste_inbound + g.outbound_sale + g.waste_outbound;

  const rows = [...(groups ?? [])].sort((a, b) => value(b) - value(a)).slice(0, 6);
  const total = rows.reduce((sum, g) => sum + value(g), 0);

  return (
    <div className={cardPadCls}>
      <h2 className={`${sectionTitleCls} mb-3 text-[15px]`}>{title}</h2>
      {rows.length === 0 || total === 0 ? (
        <p className="py-8 text-center text-[13px] text-text-faint">집계할 데이터가 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((g) => {
            const pct = (value(g) / total) * 100;
            return (
              <div key={g.key}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate text-[12.5px] text-text">{g.label}</span>
                  <span className="tabular shrink-0 text-[12.5px] font-semibold text-text-strong">
                    {metric === 'amount' ? won(value(g)) : kg(value(g))}
                    <span className="ml-1.5 text-text-faint">{pct.toFixed(1)}%</span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-input">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GroupTable({ title, groups, emptyText }: { title: string; groups: AggregationGroup[]; emptyText?: string }) {
  const rows = groups ?? [];
  const sum = (key: keyof AggregationGroup) => rows.reduce((acc, g) => acc + Number(g[key] ?? 0), 0);

  return (
    <div>
      <h2 className={`${sectionTitleCls} mb-2 text-[15px]`}>{title}</h2>
      <div className={`${tableWrapCls} overflow-x-auto`}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-border">
              <th className={thCls}>항목</th>
              <th className={`${thCls} text-right`}>입고</th>
              <th className={`${thCls} text-right`}>폐기물입고</th>
              <th className={`${thCls} text-right`}>선별</th>
              <th className={`${thCls} text-right`}>매각</th>
              <th className={`${thCls} text-right`}>폐기물반출</th>
              <th className={`${thCls} text-right`}>금액</th>
              <th className={`${thCls} text-right`}>건수</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.key} className={trCls}>
                <td className={tdCls}>{g.label}</td>
                <td className={`${tdCls} tabular text-right`}>{Math.round(g.inbound).toLocaleString()}</td>
                <td className={`${tdCls} tabular text-right`}>{Math.round(g.waste_inbound).toLocaleString()}</td>
                <td className={`${tdCls} tabular text-right`}>{Math.round(g.sorting).toLocaleString()}</td>
                <td className={`${tdCls} tabular text-right`}>{Math.round(g.outbound_sale).toLocaleString()}</td>
                <td className={`${tdCls} tabular text-right`}>{Math.round(g.waste_outbound).toLocaleString()}</td>
                <td className={`${tdCls} tabular text-right`}>{Math.round(g.amount).toLocaleString()}</td>
                <td className={`${tdCls} tabular text-right`}>{g.count}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[13px] text-text-faint">
                  {emptyText ?? '데이터 없음'}
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border bg-hover">
                <td className={`${tdCls} font-bold text-text-strong`}>합계</td>
                {(['inbound', 'waste_inbound', 'sorting', 'outbound_sale', 'waste_outbound', 'amount', 'count'] as const).map(
                  (k) => (
                    <td key={k} className={`${tdCls} tabular text-right font-bold text-text-strong`}>
                      {Math.round(sum(k)).toLocaleString()}
                    </td>
                  ),
                )}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// 일자별 물량 농도 — 값을 색상 stop으로 깔아 칸 경계 없이 이어지게 그린다.
// 짙을수록 그날 처리량이 많다. 값이 없는 날은 배경색으로 자연스럽게 흐려진다.
function DensityStrip({ groups, month }: { groups: AggregationGroup[]; month: string }) {
  const total = (g: AggregationGroup) => g.inbound + g.waste_inbound + g.outbound_sale + g.waste_outbound;

  // 표시 구간: 기준 월이 있으면 그 달, 없으면 데이터가 있는 전체 구간
  const days = useMemo(() => {
    const list = groups ?? [];
    const map = new Map(list.map((g) => [g.key, total(g)]));
    const keys = list.map((g) => g.key).sort();
    if (!keys.length) return [] as { date: string; value: number }[];

    const start = month ? `${month}-01` : keys[0];
    const end = month ? monthRange(month).to : keys[keys.length - 1];

    const out: { date: string; value: number }[] = [];
    const cur = new Date(start);
    const last = new Date(end);
    // 구간이 지나치게 길면(2년 초과) 마지막 730일만 그린다.
    if ((last.getTime() - cur.getTime()) / 86400000 > 730) cur.setTime(last.getTime() - 730 * 86400000);
    while (cur <= last) {
      const key = cur.toISOString().slice(0, 10);
      out.push({ date: key, value: map.get(key) ?? 0 });
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }, [groups, month]);

  const max = Math.max(1, ...days.map((d) => d.value));

  // 각 날짜를 구간 중앙에 배치하면 이웃 값끼리 보간되어 경계가 남지 않는다.
  const gradient = useMemo(() => {
    if (!days.length) return 'transparent';
    const stops = days.map((d, i) => {
      const pos = ((i + 0.5) / days.length) * 100;
      const alpha = d.value === 0 ? 0.04 : 0.12 + (d.value / max) * 0.88;
      return `rgba(56, 132, 255, ${alpha.toFixed(3)}) ${pos.toFixed(2)}%`;
    });
    return `linear-gradient(90deg, ${stops.join(', ')})`;
  }, [days, max]);

  const peak = days.reduce((best, d) => (d.value > (best?.value ?? 0) ? d : best), days[0]);
  const activeDays = days.filter((d) => d.value > 0).length;

  return (
    <div className={cardPadCls}>
      <div className="mb-3 flex items-end justify-between">
        <h2 className={`${sectionTitleCls} text-[15px]`}>일자별 물량 농도</h2>
        <span className="text-[12px] text-text-faint">
          {days.length > 0 ? `${days[0].date} ~ ${days[days.length - 1].date}` : '-'}
        </span>
      </div>

      {days.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-text-faint">집계할 데이터가 없습니다.</p>
      ) : (
        <>
          <div className="h-14 w-full rounded-[10px] border border-border" style={{ background: gradient }} />

          <div className="mt-1.5 flex justify-between text-[11px] text-text-faint">
            <span className="tabular">{days[0].date}</span>
            <span className="tabular">{days[Math.floor(days.length / 2)].date}</span>
            <span className="tabular">{days[days.length - 1].date}</span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-text-sub">
            <span className="flex items-center gap-2">
              연함
              <i
                className="h-2.5 w-[120px] rounded-full"
                style={{ background: 'linear-gradient(90deg, rgba(56,132,255,0.08), rgba(56,132,255,1))' }}
              />
              짙음
            </span>
            <span>
              작업일 <b className="tabular text-text-strong">{activeDays}일</b> / {days.length}일
            </span>
            {peak && peak.value > 0 && (
              <span>
                최다 <b className="tabular text-text-strong">{peak.date}</b> {kg(peak.value)}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
