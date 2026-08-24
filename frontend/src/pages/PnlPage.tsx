import { useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, FileDown, FilePlus } from 'lucide-react';
import { api } from '../api/client';
import { formatNumber } from '../lib/number';
import { downloadFile } from '../lib/download';
import { kstToday } from '../lib/datetime';
import { useProjects } from '../hooks/useMasters';
import {
  pageTitleCls,
  primaryBtnCls,
  outlineBtnCls,
  inputCls,
  tableWrapCls,
  thCls,
  thNumCls,
  tdNumCls,
  tdCls,
  trCls,
} from '../components/ui/classes';
import type { ProjectPnl } from '../types';

export function PnlPage() {
  const { projects } = useProjects();
  const [projectId, setProjectId] = useState('');
  const [pnl, setPnl] = useState<ProjectPnl | null>(null);
  const [published, setPublished] = useState('');
  const autoSelected = useRef(false);

  // 목록은 최근 생성순이므로 첫 항목이 가장 최근 프로젝트다.
  // 최초 1회만 자동 선택하고, 이후에는 사용자가 고른 프로젝트를 그대로 둔다.
  useEffect(() => {
    if (autoSelected.current || projects.length === 0) return;
    autoSelected.current = true;
    setProjectId(projects[0].id);
  }, [projects]);

  useEffect(() => {
    if (!projectId) {
      setPnl(null);
      return;
    }
    setPublished('');
    api.get<ProjectPnl>(`/api/projects/${projectId}/pnl`).then(setPnl);
  }, [projectId]);

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <TrendingUp size={20} className="text-primary" />
        <h1 className={pageTitleCls}>프로젝트 손익요약</h1>
      </div>

      <div className="mb-5 flex w-full flex-wrap items-center gap-2 rounded-[12px] border border-border bg-card px-4 py-2.5">
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={`${inputCls} w-[220px] min-w-0`}>
          <option value="">프로젝트(차수) 선택</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.roundName}
            </option>
          ))}
        </select>
        {projectId && (
          <>
            <button
              type="button"
              onClick={async () => {
                await api.post('/api/reports/publish', {
                  reportType: 'pnl',
                  projectId,
                  date: kstToday(),
                });
                setPublished('보고서 보관함에 발행했습니다.');
              }}
              className={primaryBtnCls}
            >
              <FilePlus size={15} /> 손익 보고서 발행
            </button>
            <button
              type="button"
              onClick={() => downloadFile(`/api/projects/${projectId}/pnl/export`, 'pnl_report.txt')}
              className={outlineBtnCls}
            >
              <FileDown size={15} /> 초안 텍스트 내려받기
            </button>
            {published && <span className="text-[12.5px] text-success">{published}</span>}
          </>
        )}
      </div>

      {!projectId && <p className="text-[13px] text-text-faint">프로젝트(차수)를 선택하세요.</p>}

      {pnl && (
        <div>
          <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <StatCard label="① 실현손익 (매각수입 − 총지출)" value={pnl.realizedPnl} big />
            <StatCard label="② 재고평가 (미실현)" value={pnl.inventoryValuation} big />
            <StatCard label="③ 예상 최종손익 (①+②)" value={pnl.expectedFinalPnl} big highlight />
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <StatCard label="매입비" value={pnl.purchaseCost} />
            <StatCard label="매각수입" value={pnl.salesRevenue} positive />
            <StatCard label="폐기물비용" value={pnl.wasteCost} />
            <StatCard label="운반비" value={pnl.transportCost} />
            <StatCard label="인건비" value={pnl.laborCost} />
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div className="rounded-[12px] border border-border bg-card px-4 py-3">
              <h2 className="mb-2 text-[12.5px] font-semibold text-text-faint">자재 회수 현황</h2>
              <div className="mb-2 flex items-end justify-between">
                <span className="text-[12.5px] text-text-sub">회수율 (매각중량 ÷ 반입중량)</span>
                <span className="tabular text-[22px] font-extrabold text-text-strong">
                  {(pnl.recoveryRate ?? 0).toFixed(1)}%
                </span>
              </div>
              <div className="mb-3 h-3 w-full overflow-hidden rounded-full bg-input">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, pnl.recoveryRate ?? 0)}%` }}
                />
              </div>
              <dl className="grid grid-cols-2 gap-2">
                {[
                  { label: '반입 총중량', value: `${Math.round(pnl.inboundWeight ?? 0).toLocaleString()} kg` },
                  { label: '매각 중량', value: `${Math.round(pnl.soldWeight ?? 0).toLocaleString()} kg` },
                  { label: '폐기물 반출', value: `${Math.round(pnl.wasteOutWeight ?? 0).toLocaleString()} kg` },
                  { label: '잔여(야적)', value: `${Math.round(pnl.remainingWeight ?? 0).toLocaleString()} kg` },
                  { label: '매각 평균단가', value: `${Math.round(pnl.avgSalePrice ?? 0).toLocaleString()} 원/kg` },
                  {
                    label: '매입원가 회수 잔여',
                    value: `${Math.round(pnl.purchaseRecoveryGap ?? 0).toLocaleString()} 원`,
                  },
                ].map((f) => (
                  <div key={f.label} className="rounded-[8px] border border-border px-3 py-2">
                    <dt className="text-[12px] text-text-sub">{f.label}</dt>
                    <dd className="tabular text-[14px] font-bold text-text-strong">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="rounded-[12px] border border-border bg-card px-4 py-3">
              <h2 className="mb-2 text-[12.5px] font-semibold text-text-faint">품목별 매각 구성</h2>
              {(pnl.salesByItem ?? []).length === 0 ? (
                <p className="py-8 text-center text-[13px] text-text-faint">매각 실적이 없습니다.</p>
              ) : (
                <div className="space-y-2.5">
                  {(pnl.salesByItem ?? []).map((i) => (
                    <div key={i.itemCode}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-[12.5px]">
                        <span className="truncate text-text">{i.itemName}</span>
                        <span className="tabular shrink-0 text-text-sub">
                          {Math.round(i.weight).toLocaleString()}kg · {Math.round(i.amount).toLocaleString()}원 · 평균{' '}
                          {Math.round(i.avgPrice).toLocaleString()}원
                          <span className="ml-1.5 font-semibold text-text-strong">{i.amountShare.toFixed(1)}%</span>
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-input">
                        <div className="h-full rounded-full bg-[#22c55e]" style={{ width: `${i.amountShare}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <h2 className="mb-2 text-[12.5px] font-semibold text-text-faint">재고평가 상세</h2>
          <div className={`${tableWrapCls} mb-8`}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-y border-border">
                  <th className={thCls}>품목</th>
                  <th className={thNumCls}>잔량</th>
                  <th className={thNumCls}>단가</th>
                  <th className={thNumCls}>평가금액</th>
                </tr>
              </thead>
              <tbody>
                {pnl.inventoryDetail.map((r) => (
                  <tr key={r.itemCode} className={trCls}>
                    <td className={tdCls}>{r.itemName}</td>
                    <td className={tdNumCls}>{formatNumber(r.remaining)}</td>
                    <td className={tdNumCls}>{formatNumber(r.unitPrice)}</td>
                    <td className={tdNumCls}>{formatNumber(r.valuationAmount)}</td>
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
        'rounded-[12px] border bg-card px-4 py-3',
        highlight ? 'border-primary' : 'border-border',
      ].join(' ')}
    >
      <div className="flex items-center gap-1 truncate text-[12.5px] font-semibold text-text-faint">
        {big && (negative ? <TrendingDown size={13} className="shrink-0" /> : <TrendingUp size={13} className="shrink-0" />)}
        {label}
      </div>
      <div className={`tabular truncate ${big ? 'text-[22px]' : 'text-[18px]'} font-extrabold ${color}`}>
        {value.toLocaleString()}원
      </div>
    </div>
  );
}
