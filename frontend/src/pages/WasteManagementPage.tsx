import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { api } from '../api/client';
import { formatNumber } from '../lib/number';
import { useProjects } from '../hooks/useMasters';
import { Badge } from '../components/ui/Badge';
import { pageTitleCls, inputCls, tableWrapCls, thCls, tdCls, trCls } from '../components/ui/classes';
import type { WasteOutbound } from '../types';

export function WasteManagementPage() {
  const { projects } = useProjects();
  const [projectId, setProjectId] = useState('');
  const [unreportedOnly, setUnreportedOnly] = useState(false);
  const [rows, setRows] = useState<WasteOutbound[]>([]);

  const search = () => {
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    if (unreportedOnly) params.set('unreported', 'true');
    api.get<WasteOutbound[]>(`/api/waste-outbounds?${params.toString()}`).then(setRows);
  };

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, unreportedOnly]);

  const updateStatus = async (id: string, patch: Partial<WasteOutbound>) => {
    await api.patch(`/api/waste-outbounds/${id}`, patch);
    search();
  };

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <ShieldAlert size={20} className="text-primary" />
        <h1 className={pageTitleCls}>폐기물 반출 / 올바로 신고 관리</h1>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={`${inputCls} w-auto`}>
          <option value="">전체 프로젝트</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.roundName}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-[13px] text-text-mid">
          <input type="checkbox" checked={unreportedOnly} onChange={(e) => setUnreportedOnly(e.target.checked)} />
          미신고/미기재 건만 보기
        </label>
      </div>

      <div className={tableWrapCls}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-border">
              <th className={thCls}>반출일</th>
              <th className={thCls}>프로젝트</th>
              <th className={thCls}>거래처</th>
              <th className={thCls}>중량(kg)</th>
              <th className={thCls}>올바로 신고</th>
              <th className={thCls}>인계일</th>
              <th className={thCls}>메모</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={trCls}>
                <td className={`${tdCls} tabular`}>{new Date(r.outboundDate).toISOString().slice(0, 10)}</td>
                <td className={tdCls}>{r.project?.roundName}</td>
                <td className={tdCls}>{r.buyer?.name ?? '-'}</td>
                <td className={`${tdCls} tabular text-right`}>{formatNumber(r.weight)}</td>
                <td className={tdCls}>
                  {r.olbaroReported ? (
                    <Badge tone="green">신고완료</Badge>
                  ) : (
                    <label className="inline-flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={r.olbaroReported}
                        onChange={(e) => updateStatus(r.id, { olbaroReported: e.target.checked })}
                      />
                      <Badge tone="red">미신고</Badge>
                    </label>
                  )}
                </td>
                <td className={tdCls}>
                  <input
                    type="date"
                    value={r.handoverDate ? r.handoverDate.slice(0, 10) : ''}
                    onChange={(e) => updateStatus(r.id, { handoverDate: e.target.value || null })}
                    className="h-8 rounded-[6px] border border-border bg-input px-2 text-[12.5px] text-input-text outline-none focus:border-primary"
                  />
                </td>
                <td className={tdCls}>
                  <input
                    defaultValue={r.olbaroMemo ?? ''}
                    onBlur={(e) => updateStatus(r.id, { olbaroMemo: e.target.value })}
                    placeholder="기준업체량 등"
                    className="h-8 w-full rounded-[6px] border border-border bg-input px-2 text-[12.5px] text-input-text outline-none focus:border-primary"
                  />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-[13px] text-text-faint">
                  데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
