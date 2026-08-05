import { useEffect, useState } from 'react';
import { ListTree, Download, Paperclip, X } from 'lucide-react';
import { api, API_BASE_URL } from '../api/client';
import { useProjects, useVendors, useItemMasters } from '../hooks/useMasters';
import { Badge, type BadgeTone } from '../components/ui/Badge';
import { pageTitleCls, outlineBtnCls, inputCls, tableWrapCls, thCls, tdCls, trCls } from '../components/ui/classes';
import type { LedgerRow, LedgerDetail, LedgerType } from '../types';

const TYPE_LABEL: Record<LedgerType, string> = {
  inbound: '입고',
  waste_inbound: '폐기물입고',
  sorting: '선별',
  outbound_sale: '매각',
  waste_outbound: '폐기물반출',
};

const TYPE_TONE: Record<LedgerType, BadgeTone> = {
  inbound: 'blue',
  waste_inbound: 'amber',
  sorting: 'purple',
  outbound_sale: 'green',
  waste_outbound: 'amber',
};

export function LedgerPage() {
  const { projects } = useProjects();
  const { vendors } = useVendors();
  const { items } = useItemMasters();

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [projectId, setProjectId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [type, setType] = useState('');

  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [selected, setSelected] = useState<{ type: LedgerType; id: string } | null>(null);
  const [detail, setDetail] = useState<LedgerDetail | null>(null);

  const buildQuery = () => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (projectId) params.set('projectId', projectId);
    if (vendorId) params.set('vendorId', vendorId);
    if (itemCode) params.set('itemCode', itemCode);
    if (type) params.set('type', type);
    return params.toString();
  };

  const search = () => {
    api.get<LedgerRow[]>(`/api/ledger?${buildQuery()}`).then(setRows);
  };

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    api.get<LedgerDetail>(`/api/ledger/${selected.type}/${selected.id}`).then(setDetail);
  }, [selected]);

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <ListTree size={20} className="text-primary" />
        <h1 className={pageTitleCls}>통합 원장 조회</h1>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[14px] border border-border bg-card p-3">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} w-auto`} />
        <span className="text-text-faint">~</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} w-auto`} />
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={`${inputCls} w-auto`}>
          <option value="">전체 프로젝트</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.roundName}
            </option>
          ))}
        </select>
        <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={`${inputCls} w-auto`}>
          <option value="">전체 거래처</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <select value={itemCode} onChange={(e) => setItemCode(e.target.value)} className={`${inputCls} w-auto`}>
          <option value="">전체 품목</option>
          {items.map((i) => (
            <option key={i.itemCode} value={i.itemCode}>
              {i.itemName}
            </option>
          ))}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className={`${inputCls} w-auto`}>
          <option value="">전체 유형</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button type="button" onClick={search} className={outlineBtnCls}>
          조회
        </button>
        <a href={`${API_BASE_URL}/api/ledger/export?${buildQuery()}`} target="_blank" rel="noreferrer" className="ml-auto">
          <button type="button" className={outlineBtnCls}>
            <Download size={15} /> 엑셀(CSV)
          </button>
        </a>
        <a href={`${API_BASE_URL}/api/ledger/export?${buildQuery()}&template=ecount`} target="_blank" rel="noreferrer">
          <button type="button" className={outlineBtnCls}>
            <Download size={15} /> ecount용
          </button>
        </a>
      </div>

      <div className={tableWrapCls}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-border">
              <th className={thCls}>일자</th>
              <th className={thCls}>구분</th>
              <th className={thCls}>프로젝트</th>
              <th className={thCls}>거래처</th>
              <th className={thCls}>품목</th>
              <th className={thCls}>중량(kg)</th>
              <th className={thCls}>금액</th>
              <th className={thCls}>첨부</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.type}-${r.id}`} onClick={() => setSelected({ type: r.type, id: r.id })} className={`${trCls} cursor-pointer`}>
                <td className={`${tdCls} tabular`}>{new Date(r.date).toISOString().slice(0, 10)}</td>
                <td className={tdCls}>
                  <Badge tone={TYPE_TONE[r.type]}>{TYPE_LABEL[r.type]}</Badge>
                </td>
                <td className={tdCls}>{r.projectName}</td>
                <td className={tdCls}>{r.vendorName ?? '-'}</td>
                <td className={tdCls}>{r.itemName ?? '-'}</td>
                <td className={`${tdCls} tabular`}>{r.weight}</td>
                <td className={`${tdCls} tabular`}>{r.amount ?? '-'}</td>
                <td className={tdCls}>
                  {r.attachmentCount > 0 ? (
                    <span className="inline-flex items-center gap-1 text-text-sub">
                      <Paperclip size={13} /> {r.attachmentCount}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-10 text-center text-[13px] text-text-faint">
                  조회된 데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed top-0 right-0 h-screen w-[380px] overflow-y-auto border-l border-border bg-card p-5 shadow-[-8px_0_24px_rgba(0,0,0,0.35)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[16px] font-extrabold text-text-strong">{TYPE_LABEL[selected.type]} 상세</h2>
            <button type="button" onClick={() => setSelected(null)} className="text-text-sub hover:text-text-strong">
              <X size={18} />
            </button>
          </div>
          {detail ? (
            <div>
              <pre className="mb-4 overflow-x-auto rounded-[8px] border border-border bg-input p-3 text-[11.5px] whitespace-pre-wrap text-text-mid">
                {JSON.stringify(detail, null, 2)}
              </pre>
              {detail.attachments && detail.attachments.length > 0 && (
                <div>
                  <h3 className="mb-2 text-[13px] font-bold text-text-strong">첨부파일</h3>
                  <ul className="space-y-1">
                    {detail.attachments.map((a) => (
                      <li key={a.id}>
                        <a
                          href={a.webViewLink ?? '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-[13px] text-primary hover:underline"
                        >
                          <Paperclip size={13} />
                          {a.fileName ?? a.id} {a.fileType ? `(${a.fileType})` : ''}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[13px] text-text-sub">불러오는 중...</p>
          )}
        </div>
      )}
    </div>
  );
}
