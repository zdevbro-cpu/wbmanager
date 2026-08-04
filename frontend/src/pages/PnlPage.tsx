import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, FileDown } from 'lucide-react';
import { api, API_BASE_URL } from '../api/client';
import { useProjects } from '../hooks/useMasters';
import { pageTitleCls, sectionTitleCls, outlineBtnCls, inputCls, tableWrapCls, thCls, tdCls, trCls } from '../components/ui/classes';
import type { ProjectPnl } from '../types';

export function PnlPage() {
  const { projects } = useProjects();
  const [projectId, setProjectId] = useState('');
  const [pnl, setPnl] = useState<ProjectPnl | null>(null);

  useEffect(() => {
    if (!projectId) {
      setPnl(null);
      return;
    }
    api.get<ProjectPnl>(`/api/projects/${projectId}/pnl`).then(setPnl);
  }, [projectId]);

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <TrendingUp size={20} className="text-primary" />
        <h1 className={pageTitleCls}>차수 손익 대시보드</h1>
      </div>

      <div className="mb-5 flex items-center gap-2">
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={`${inputCls} w-auto`}>
          <option value="">프로젝트(차수) 선택</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.roundName}
            </option>
          ))}
        </select>
        {projectId && (
          <a href={`${API_BASE_URL}/api/projects/${projectId}/pnl/export`} target="_blank" rel="noreferrer">
            <button type="button" className={outlineBtnCls}>
              <FileDown size={15} /> 대표이사 보고서 초안 출력
            </button>
          </a>
        )}
      </div>

      {!projectId && <p className="text-[13px] text-text-faint">프로젝트(차수)를 선택하세요.</p>}

      {pnl && (
        <div>
          <div className="mb-4 grid grid-cols-5 gap-4">
            <StatCard label="매입비" value={pnl.purchaseCost} />
            <StatCard label="매각수입" value={pnl.salesRevenue} positive />
            <StatCard label="폐기물비용" value={pnl.wasteCost} />
            <StatCard label="운송비" value={pnl.transportCost} />
            <StatCard label="인건비" value={pnl.laborCost} />
          </div>

          <div className="mb-8 flex flex-wrap gap-4">
            <StatCard label="① 실현손익 (매각수입 − 총지출)" value={pnl.realizedPnl} big />
            <StatCard label="② 재고평가 (미실현)" value={pnl.inventoryValuation} big />
            <StatCard label="③ 예상 최종손익 (①+②)" value={pnl.expectedFinalPnl} big highlight />
          </div>

          <h2 className={`${sectionTitleCls} mb-2`}>재고평가 상세</h2>
          <div className={`${tableWrapCls} max-w-[720px]`}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-y border-border">
                  <th className={thCls}>품목</th>
                  <th className={thCls}>잔량</th>
                  <th className={thCls}>단가</th>
                  <th className={thCls}>평가금액</th>
                </tr>
              </thead>
              <tbody>
                {pnl.inventoryDetail.map((r) => (
                  <tr key={r.itemCode} className={trCls}>
                    <td className={tdCls}>{r.itemName}</td>
                    <td className={`${tdCls} tabular`}>{r.remaining}</td>
                    <td className={`${tdCls} tabular`}>{r.unitPrice.toLocaleString()}</td>
                    <td className={`${tdCls} tabular`}>{r.valuationAmount.toLocaleString()}</td>
                  </tr>
                ))}
                {pnl.inventoryDetail.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[13px] text-text-faint">
                      재고 데이터 없음
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  positive,
  big,
  highlight,
}: {
  label: string;
  value: number;
  positive?: boolean;
  big?: boolean;
  highlight?: boolean;
}) {
  const negative = value < 0;
  const color = negative ? 'text-danger' : positive ? 'text-success' : 'text-text-strong';
  return (
    <div
      className={[
        'rounded-[12px] border bg-card p-4',
        highlight ? 'border-primary' : 'border-border',
        big ? 'min-w-[220px]' : 'min-w-[130px]',
      ].join(' ')}
    >
      <div className="flex items-center gap-1 text-[12.5px] font-semibold text-text-faint">
        {big && (negative ? <TrendingDown size={13} /> : <TrendingUp size={13} />)}
        {label}
      </div>
      <div className={`tabular ${big ? 'text-[22px]' : 'text-[18px]'} font-extrabold ${color}`}>
        {value.toLocaleString()}원
      </div>
    </div>
  );
}
