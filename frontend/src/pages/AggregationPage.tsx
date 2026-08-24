import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Inbox, PackageMinus, Layers, Percent, ChevronDown, ChevronRight } from 'lucide-react';
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
  // 소계표는 기본으로 접어 둔다 — 첫 화면은 지표와 그래프만 보이게 한다.
  const [showTables, setShowTables] = useState(false);

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

  // 금액은 유형별로 성격이 다르다 — 매각은 매출, 폐기물반출은 처리비(비용)라 카드에서 갈라 보여 준다.
  const amountOf = (type: string) => Number(data?.byType?.find((g) => g.key === type)?.amount ?? 0);

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
          월을 비우면 전체 기간이 집계됩니다. 원본 갑지의 월별·거래처별 피벗을 대신합니다.
        </p>
      </div>

      {data && flow && (
        <div className="space-y-6">
          {/* 판단에 쓰는 네 값만 크게 두고, 나머지는 각 카드의 보조줄로 내린다.
              색은 다른 화면과 같은 규칙 — 반입 파랑 / 매각 주황 / 재고 초록. */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
            <SummaryCard
              icon={Inbox}
              color="#60a5fa"
              label="반입"
              value={kg(flow.inTotal)}
              sub={`스크랩 ${kg(data.totals.inbound)} · 폐기물 ${kg(data.totals.waste_inbound)}`}
            />
            <SummaryCard
              icon={PackageMinus}
              color="#f59e0b"
              label="매각"
              value={kg(data.totals.outbound_sale)}
              sub={`매각금액 ${won(amountOf('outbound_sale'))} · 폐기물반출 ${kg(data.totals.waste_outbound)}`}
            />
            <SummaryCard
              icon={Layers}
              color="#22c55e"
              label="재고(잔여)"
              value={kg(flow.remain)}
              sub={`반입 − 처리 · 선별 ${kg(data.totals.sorting)}`}
            />
            <SummaryCard
              icon={Percent}
              color="#38bdf8"
              label="회수율"
              value={`${flow.rate.toFixed(1)}%`}
              sub="처리 합계 ÷ 반입 합계"
            />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
            <FlowCard flow={flow} />
            <MonthlyTrend groups={data.byMonth} />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
            <ShareCard title="품목 구성 (중량 상위 6)" groups={data.byItem} metric="weight" color="#60a5fa" />
            <ShareCard title="거래처 구성 (금액 상위 6)" groups={data.byVendor} metric="amount" color="#22c55e" />
          </div>

          {/* 소계표는 접어 두고 필요할 때 펼친다. 좌우 표는 줄 수를 맞춰 같은 높이로 세우고,
              모자란 쪽은 빈 줄, 넘치는 쪽은 표 안에서 스크롤한다. */}
          <button
            type="button"
            onClick={() => setShowTables((v) => !v)}
            className="flex w-full items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 py-2 text-[13.5px] font-bold text-text-mid hover:bg-hover"
          >
            {showTables ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            소계표 {showTables ? '접기' : '펼치기'}
            <span className="ml-1 text-[12.5px] font-semibold text-text-faint">
              프로젝트 · 거래처 · 품목 · 구분 · 월별
            </span>
          </button>

          <div className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 ${showTables ? '' : 'hidden'}`}>
            <GroupTable title="① 프로젝트별 소계" groups={data.byProject} rowSlots={pairRows(data.byProject, data.byVendor)} />
            <GroupTable title="② 거래처별 소계" groups={data.byVendor} rowSlots={pairRows(data.byProject, data.byVendor)} />
            <GroupTable title="③ 품목별 소계" groups={data.byItem} rowSlots={pairRows(data.byItem, data.byType)} />
            <GroupTable title="④ 구분별 소계" groups={data.byType} rowSlots={pairRows(data.byItem, data.byType)} />
            <GroupTable title="⑤ 월별 소계" groups={data.byMonth} rowSlots={pairRows(data.byMonth)} />
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

// 한 줄 높이(px)와 한 화면에 보여 줄 최대 줄 수 — 이 수를 넘으면 표 안에서 스크롤한다.
const ROW_HEIGHT = 30;
const MAX_ROWS = 8;

// 좌우 한 쌍이 같은 줄 수를 갖도록 큰 쪽에 맞춘다.
function pairRows(...groups: (AggregationGroup[] | undefined)[]) {
  const longest = Math.max(1, ...groups.map((g) => g?.length ?? 0));
  return Math.min(longest, MAX_ROWS);
}

function GroupTable({
  title,
  groups,
  emptyText,
  rowSlots,
}: {
  title: string;
  groups: AggregationGroup[];
  emptyText?: string;
  rowSlots?: number;
}) {
  const rows = groups ?? [];
  const sum = (key: keyof AggregationGroup) => rows.reduce((acc, g) => acc + Number(g[key] ?? 0), 0);
  // 자료가 모자라면 빈 줄로 채워 좌우 표의 높이를 맞춘다.
  const blanks = rowSlots && rows.length > 0 ? Math.max(0, rowSlots - rows.length) : 0;
  const bodyHeight = rowSlots ? ROW_HEIGHT * rowSlots + 66 : undefined;

  return (
    <div>
      <h2 className={`${sectionTitleCls} mb-2 text-[15px]`}>{title}</h2>
      <div className={`${tableWrapCls} overflow-auto`} style={bodyHeight ? { maxHeight: bodyHeight } : undefined}>
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-[1] bg-card">
            <tr className="border-y border-border">
              <th className={thCls}>항목</th>
              <th className={`${thCls} text-right`}>입고</th>
              <th className={`${thCls} text-right`}>폐기물입고</th>
              <th className={`${thCls} text-right`}>선별</th>
              <th className={`${thCls} text-right`}>매각</th>
              <th className={`${thCls} text-right`}>폐기물반출</th>
              <th className={`${thCls} text-right`}>매각금액</th>
              <th className={`${thCls} text-right`}>폐기물비용</th>
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
                <td className={`${tdCls} tabular text-right`}>{Math.round(g.saleAmount ?? 0).toLocaleString()}</td>
                <td className={`${tdCls} tabular text-right`}>{Math.round(g.wasteAmount ?? 0).toLocaleString()}</td>
                <td className={`${tdCls} tabular text-right`}>{g.count}</td>
              </tr>
            ))}
            {Array.from({ length: blanks }, (_, i) => (
              <tr key={`blank-${i}`} className={trCls} style={{ height: ROW_HEIGHT }}>
                <td className={tdCls} colSpan={9} />
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-[13px] text-text-faint">
                  {emptyText ?? '데이터 없음'}
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="sticky bottom-0 z-[1]">
              <tr className="border-t-2 border-border bg-hover">
                <td className={`${tdCls} font-bold text-text-strong`}>합계</td>
                {(
                  ['inbound', 'waste_inbound', 'sorting', 'outbound_sale', 'waste_outbound', 'saleAmount', 'wasteAmount', 'count'] as const
                ).map(
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

