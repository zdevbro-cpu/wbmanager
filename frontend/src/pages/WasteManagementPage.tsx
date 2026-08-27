import { useEffect, useState } from 'react';
import { ShieldAlert, RotateCcw } from 'lucide-react';
import { api } from '../api/client';
import { formatNumber } from '../lib/number';
import { useProjects } from '../hooks/useMasters';
import { Badge } from '../components/ui/Badge';
import { pageTitleCls, inputCls, cardCls, outlineBtnCls, tableWrapCls, thCls,
  thNumCls,
  tdNumCls, tdCls, trCls } from '../components/ui/classes';
import type { WasteOutbound } from '../types';
import { DateField } from '../components/ui/DateField';

export function WasteManagementPage() {
  const { projects } = useProjects();
  const [projectId, setProjectId] = useState('');
  const [unreportedOnly, setUnreportedOnly] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reported, setReported] = useState('');
  const [handover, setHandover] = useState('');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<WasteOutbound[]>([]);

  const search = () => {
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    if (unreportedOnly) params.set('unreported', 'true');
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    api.get<WasteOutbound[]>(`/api/waste-outbounds?${params.toString()}`).then(setRows);
  };

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, unreportedOnly, from, to]);

  // 이름과 상태는 받아 온 목록에서 거른다 — 즉시 반응하고 서버를 다시 부르지 않는다.
  const visible = rows.filter((r) => {
    if (reported === 'true' && !r.olbaroReported) return false;
    if (reported === 'false' && r.olbaroReported) return false;
    if (handover === 'true' && !r.handoverDate) return false;
    if (handover === 'false' && r.handoverDate) return false;
    const keyword = q.trim().toLowerCase();
    if (keyword) {
      const hay = [r.dischargerName, r.transporterName, r.buyer?.name, r.vehicleNo, r.olbaroMemo]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(keyword)) return false;
    }
    return true;
  });

  const updateStatus = async (id: string, patch: Partial<WasteOutbound>) => {
    await api.patch(`/api/waste-outbounds/${id}`, patch);
    search();
  };

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <ShieldAlert size={20} className="text-primary" />
        <h1 className={pageTitleCls}>폐기물 반출 / 올바로 신고 관리</h1>
        <span className="text-[12.5px] text-text-faint">
          {visible.length === rows.length ? `${rows.length}건` : `${visible.length}건 / 전체 ${rows.length}건`}
        </span>
      </div>

      <div
        className={`${cardCls} mb-4 grid items-center gap-2 px-4 py-2.5`}
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))' }}
      >
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={`${inputCls} w-full min-w-0`}>
          <option value="">전체 프로젝트</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.roundName}
            </option>
          ))}
        </select>

        <div className="flex min-w-0 items-center gap-1" style={{ gridColumn: 'span 2' }}>
          <DateField value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} w-full min-w-0 px-2`} />
          <span className="shrink-0 text-text-faint">~</span>
          <DateField value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} w-full min-w-0 px-2`} />
        </div>

        <select value={reported} onChange={(e) => setReported(e.target.value)} className={`${inputCls} w-full min-w-0`}>
          <option value="">올바로 전체</option>
          <option value="true">신고 완료</option>
          <option value="false">미신고</option>
        </select>

        <select value={handover} onChange={(e) => setHandover(e.target.value)} className={`${inputCls} w-full min-w-0`}>
          <option value="">인계일 전체</option>
          <option value="true">기재됨</option>
          <option value="false">미기재</option>
        </select>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="배출자 · 운반자 · 처리자 · 차량"
          className={`${inputCls} w-full min-w-0`}
        />

        <label className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-text-mid">
          <input type="checkbox" checked={unreportedOnly} onChange={(e) => setUnreportedOnly(e.target.checked)} />
          처리할 건만
        </label>

        {(projectId || from || to || reported || handover || q || unreportedOnly) && (
          <button
            type="button"
            onClick={() => {
              setProjectId('');
              setFrom('');
              setTo('');
              setReported('');
              setHandover('');
              setQ('');
              setUnreportedOnly(false);
            }}
            className={`${outlineBtnCls} h-[38px] w-full min-w-0 justify-center px-2`}
          >
            <RotateCcw size={15} /> 초기화
          </button>
        )}
      </div>

      <div className={tableWrapCls}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-border">
              <th className={thCls}>반출일</th>
              <th className={thCls}>프로젝트</th>
              <th className={thCls}>배출자</th>
              <th className={thCls}>운반자</th>
              <th className={thCls}>처리자</th>
              <th className={thNumCls}>중량(kg)</th>
              <th className={thCls}>올바로 신고</th>
              <th className={thCls}>인계일</th>
              <th className={thCls}>메모</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className={trCls}>
                <td className={`${tdCls} tabular`}>{new Date(r.outboundDate).toISOString().slice(0, 10)}</td>
                <td className={tdCls}>{r.project?.roundName}</td>
                <td className={tdCls}>{r.dischargerName ?? '-'}</td>
                <td className={tdCls}>{r.transporterName ?? '-'}</td>
                <td className={tdCls}>{r.buyer?.name ?? '-'}</td>
                <td className={tdNumCls}>{formatNumber(r.weight)}</td>
                <td className={tdCls}>
                  {/* 잘못 눌렀거나 신고가 반려된 건도 있어 미신고로 되돌릴 수 있게 둔다. */}
                  <label className="inline-flex items-center gap-1.5" title="체크하면 신고완료, 해제하면 미신고">
                    <input
                      type="checkbox"
                      checked={r.olbaroReported}
                      onChange={(e) => updateStatus(r.id, { olbaroReported: e.target.checked })}
                      className="h-4 w-4 accent-primary"
                    />
                    {r.olbaroReported ? <Badge tone="green">신고완료</Badge> : <Badge tone="red">미신고</Badge>}
                  </label>
                </td>
                <td className={tdCls}>
                  <DateField
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
            {visible.length === 0 && (
              <tr>
                <td colSpan={9} className="py-10 text-center text-[13px] text-text-faint">
                  {rows.length === 0 ? '데이터가 없습니다.' : '조건에 맞는 건이 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
