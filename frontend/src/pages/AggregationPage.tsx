import { useEffect, useState } from 'react';
import { BarChart3, Inbox, PackageMinus, Recycle, Trash2, Coins, Layers } from 'lucide-react';
import { api } from '../api/client';
import { useProjects } from '../hooks/useMasters';
import { SummaryCard } from '../components/ui/SummaryCard';
import { pageTitleCls, sectionTitleCls, inputCls, tableWrapCls, thCls, tdCls, trCls } from '../components/ui/classes';
import type { Aggregation, AggregationGroup } from '../types';

function monthRange(month: string) {
  if (!month) return { from: '', to: '' };
  const [y, m] = month.split('-').map(Number);
  const from = `${month}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${month}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

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
    api.get<Aggregation>(`/api/reports/aggregation?${params.toString()}`).then(setData);
  };

  // 기준일/기간 변경 시 즉시 재집계 (S-TCUYZO)
  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, projectId]);

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <BarChart3 size={20} className="text-primary" />
        <h1 className={pageTitleCls}>갑지 자동 집계</h1>
      </div>

      <div className="mb-5 flex gap-2">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={`${inputCls} w-auto`} />
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={`${inputCls} w-auto`}>
          <option value="">전체 프로젝트</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.roundName}
            </option>
          ))}
        </select>
      </div>

      {data && (
        <div className="space-y-8">
          <div className="grid grid-cols-6 gap-4">
            <SummaryCard icon={Inbox} color="#60a5fa" label="입고" value={`${data.totals.inbound.toLocaleString()}kg`} />
            <SummaryCard icon={Recycle} color="#fb923c" label="폐기물입고" value={`${data.totals.waste_inbound.toLocaleString()}kg`} />
            <SummaryCard icon={Layers} color="#a78bfa" label="선별" value={`${data.totals.sorting.toLocaleString()}kg`} />
            <SummaryCard icon={PackageMinus} color="#22c55e" label="매각" value={`${data.totals.outbound_sale.toLocaleString()}kg`} />
            <SummaryCard icon={Trash2} color="#f59e0b" label="폐기물반출" value={`${data.totals.waste_outbound.toLocaleString()}kg`} />
            <SummaryCard icon={Coins} color="#38bdf8" label="금액합계" value={`${data.totals.amount.toLocaleString()}원`} />
          </div>
          <GroupTable title="프로젝트별 소계" groups={data.byProject} />
          <GroupTable title="거래처별 소계" groups={data.byVendor} />
          <GroupTable title="품목별 소계" groups={data.byItem} />
        </div>
      )}
    </div>
  );
}

function GroupTable({ title, groups }: { title: string; groups: AggregationGroup[] }) {
  return (
    <div>
      <h2 className={`${sectionTitleCls} mb-2`}>{title}</h2>
      <div className={`${tableWrapCls} max-w-[820px]`}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-border">
              <th className={thCls}>항목</th>
              <th className={thCls}>입고</th>
              <th className={thCls}>폐기물입고</th>
              <th className={thCls}>선별</th>
              <th className={thCls}>매각</th>
              <th className={thCls}>폐기물반출</th>
              <th className={thCls}>금액</th>
              <th className={thCls}>건수</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.key} className={trCls}>
                <td className={tdCls}>{g.label}</td>
                <td className={`${tdCls} tabular`}>{g.inbound}</td>
                <td className={`${tdCls} tabular`}>{g.waste_inbound}</td>
                <td className={`${tdCls} tabular`}>{g.sorting}</td>
                <td className={`${tdCls} tabular`}>{g.outbound_sale}</td>
                <td className={`${tdCls} tabular`}>{g.waste_outbound}</td>
                <td className={`${tdCls} tabular`}>{g.amount.toLocaleString()}</td>
                <td className={`${tdCls} tabular`}>{g.count}</td>
              </tr>
            ))}
            {groups.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[13px] text-text-faint">
                  데이터 없음
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
