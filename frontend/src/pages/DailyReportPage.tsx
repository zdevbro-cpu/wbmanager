import { useEffect, useState } from 'react';
import { FileText, MessageCircle, Download } from 'lucide-react';
import { api, API_BASE_URL } from '../api/client';
import { useProjects } from '../hooks/useMasters';
import { Badge, type BadgeTone } from '../components/ui/Badge';
import { pageTitleCls, outlineBtnCls, inputCls, tableWrapCls, thCls, tdCls, trCls } from '../components/ui/classes';
import type { DailyReport } from '../types';

const TYPE_LABEL: Record<string, string> = {
  outbound_sale: '매각',
  waste_outbound: '폐기물반출',
};

const TYPE_TONE: Record<string, BadgeTone> = {
  outbound_sale: 'green',
  waste_outbound: 'amber',
};

export function DailyReportPage() {
  const { projects } = useProjects();
  const [date, setDate] = useState('');
  const [projectId, setProjectId] = useState('');
  const [report, setReport] = useState<DailyReport | null>(null);

  const search = () => {
    if (!date) return;
    const params = new URLSearchParams({ date });
    if (projectId) params.set('projectId', projectId);
    api.get<DailyReport>(`/api/reports/daily?${params.toString()}`).then(setReport);
  };

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, projectId]);

  const exportQuery = () => {
    const params = new URLSearchParams({ date });
    if (projectId) params.set('projectId', projectId);
    return params.toString();
  };

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <FileText size={20} className="text-primary" />
        <h1 className={pageTitleCls}>일일 출고보고</h1>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputCls} w-auto`} />
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={`${inputCls} w-auto`}>
          <option value="">전체 프로젝트</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.roundName}
            </option>
          ))}
        </select>
        {date && (
          <>
            <a href={`${API_BASE_URL}/api/reports/daily/export?${exportQuery()}&format=text`} target="_blank" rel="noreferrer">
              <button type="button" className={outlineBtnCls}>
                <MessageCircle size={15} /> 카톡 공유용
              </button>
            </a>
            <a href={`${API_BASE_URL}/api/reports/daily/export?${exportQuery()}`} target="_blank" rel="noreferrer">
              <button type="button" className={outlineBtnCls}>
                <Download size={15} /> 엑셀(CSV)
              </button>
            </a>
          </>
        )}
      </div>

      {!date && <p className="text-[13px] text-text-faint">조회할 날짜를 선택하세요.</p>}

      {date && report && (
        <div>
          <div className="mb-4 flex gap-4">
            <div className="rounded-[12px] border border-border bg-card p-4">
              <div className="text-[13px] text-text-faint">건수</div>
              <div className="tabular text-[20px] font-extrabold text-text-strong">{report.count}건</div>
            </div>
            <div className="rounded-[12px] border border-border bg-card p-4">
              <div className="text-[13px] text-text-faint">합계 중량</div>
              <div className="tabular text-[20px] font-extrabold text-text-strong">{report.totalWeight.toLocaleString()}kg</div>
            </div>
            <div className="rounded-[12px] border border-border bg-card p-4">
              <div className="text-[13px] text-text-faint">합계 금액</div>
              <div className="tabular text-[20px] font-extrabold text-text-strong">{report.totalAmount.toLocaleString()}원</div>
            </div>
          </div>

          <div className={tableWrapCls}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-y border-border">
                  <th className={thCls}>구분</th>
                  <th className={thCls}>프로젝트</th>
                  <th className={thCls}>거래처</th>
                  <th className={thCls}>품목</th>
                  <th className={thCls}>중량(kg)</th>
                  <th className={thCls}>금액</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={`${r.type}-${r.id}`} className={trCls}>
                    <td className={tdCls}>
                      <Badge tone={TYPE_TONE[r.type] ?? 'slate'}>{TYPE_LABEL[r.type] ?? r.type}</Badge>
                    </td>
                    <td className={tdCls}>{r.projectName}</td>
                    <td className={tdCls}>{r.vendorName ?? '-'}</td>
                    <td className={tdCls}>{r.itemName ?? '-'}</td>
                    <td className={`${tdCls} tabular`}>{r.weight}</td>
                    <td className={`${tdCls} tabular`}>{r.amount ?? '-'}</td>
                  </tr>
                ))}
                {report.rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-[13px] text-text-faint">
                      해당 일자의 출고 내역이 없습니다.
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
