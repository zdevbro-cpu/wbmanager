import { useEffect, useState } from 'react';
import { Boxes, X } from 'lucide-react';
import { api } from '../api/client';
import { useProjects, useItemMasters } from '../hooks/useMasters';
import { pageTitleCls, sectionTitleCls, primaryBtnCls, inputCls, tableWrapCls, thCls, tdCls, trCls } from '../components/ui/classes';
import type { InventoryValuation, InventoryValuationRow, LedgerEntry } from '../types';

const SOURCE_LABEL: Record<string, string> = { project: '차수전용', global: '전체적용', base: '기준단가' };

export function InventoryPage() {
  const { projects } = useProjects();
  const { items } = useItemMasters();
  const [projectId, setProjectId] = useState('');
  const [valuation, setValuation] = useState<InventoryValuation | null>(null);
  const [drilldown, setDrilldown] = useState<{ row: InventoryValuationRow; entries: LedgerEntry[] } | null>(null);

  const search = () => {
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    api.get<InventoryValuation>(`/api/inventory/valuation?${params.toString()}`).then(setValuation);
  };

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const openDrilldown = async (row: InventoryValuationRow) => {
    const entries = await api.get<LedgerEntry[]>(`/api/inventory/snapshot/${row.projectId}/${row.itemCode}/entries`);
    setDrilldown({ row, entries });
  };

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <Boxes size={20} className="text-primary" />
        <h1 className={pageTitleCls}>재고 스냅샷 / 재고평가</h1>
      </div>

      <div className="mb-5">
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={`${inputCls} w-auto`}>
          <option value="">전체 프로젝트</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.roundName}
            </option>
          ))}
        </select>
      </div>

      {valuation && (
        <>
          <div className="mb-4 w-fit rounded-[12px] border border-primary bg-card p-4">
            <div className="text-[13px] text-text-faint">재고평가 합계</div>
            <div className="tabular text-[22px] font-extrabold text-text-strong">{valuation.totalValuation.toLocaleString()}원</div>
          </div>

          <div className={`${tableWrapCls} mb-8`}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-y border-border">
                  <th className={thCls}>프로젝트</th>
                  <th className={thCls}>품목</th>
                  <th className={thCls}>입고합계</th>
                  <th className={thCls}>출고합계</th>
                  <th className={thCls}>잔량</th>
                  <th className={thCls}>적용단가</th>
                  <th className={thCls}>단가출처</th>
                  <th className={thCls}>평가금액</th>
                </tr>
              </thead>
              <tbody>
                {valuation.rows.map((r) => (
                  <tr key={`${r.projectId}-${r.itemCode}`} onClick={() => openDrilldown(r)} className={`${trCls} cursor-pointer`}>
                    <td className={tdCls}>{r.projectName}</td>
                    <td className={tdCls}>{r.itemName}</td>
                    <td className={`${tdCls} tabular`}>{r.inWeight}</td>
                    <td className={`${tdCls} tabular`}>{r.outWeight}</td>
                    <td className={`${tdCls} tabular font-bold text-text-strong`}>{r.remaining}</td>
                    <td className={`${tdCls} tabular`}>{r.unitPrice.toLocaleString()}</td>
                    <td className={tdCls}>{SOURCE_LABEL[r.priceSource]}</td>
                    <td className={`${tdCls} tabular`}>{r.valuationAmount.toLocaleString()}</td>
                  </tr>
                ))}
                {valuation.rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-[13px] text-text-faint">
                      재고 데이터가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <PriceRegisterForm items={items} projects={projects} onRegistered={search} />

      {drilldown && (
        <div className="fixed top-0 right-0 h-screen w-[380px] overflow-y-auto border-l border-border bg-card p-5 shadow-[-8px_0_24px_rgba(0,0,0,0.35)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[16px] font-extrabold text-text-strong">
              {drilldown.row.projectName} / {drilldown.row.itemName}
            </h2>
            <button type="button" onClick={() => setDrilldown(null)} className="text-text-sub hover:text-text-strong">
              <X size={18} />
            </button>
          </div>
          <ul className="space-y-1.5">
            {drilldown.entries.map((e) => (
              <li key={e.id} className="border-b border-border pb-1.5 text-[13px] text-text-mid">
                <span className="tabular">{new Date(e.ledgerDate).toISOString().slice(0, 10)}</span> ·{' '}
                <span className={e.direction === 'IN' ? 'font-bold text-success' : 'font-bold text-danger'}>
                  {e.direction === 'IN' ? '입고(+)' : '출고(-)'}
                </span>{' '}
                <span className="tabular">{e.weight}kg</span> · {e.refType}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PriceRegisterForm({
  items,
  projects,
  onRegistered,
}: {
  items: { itemCode: string; itemName: string }[];
  projects: { id: string; roundName: string }[];
  onRegistered: () => void;
}) {
  const [itemCode, setItemCode] = useState('');
  const [price, setPrice] = useState('');
  const [projectId, setProjectId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemCode || !price || !effectiveDate) return;
    await api.post('/api/inventory/prices', {
      itemCode,
      price: Number(price),
      projectId: projectId || undefined,
      effectiveDate,
    });
    setPrice('');
    setEffectiveDate('');
    onRegistered();
  };

  return (
    <div>
      <h2 className={`${sectionTitleCls} mb-2`}>품목 추정단가 등록</h2>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
        <select value={itemCode} onChange={(e) => setItemCode(e.target.value)} className={`${inputCls} w-auto`}>
          <option value="">품목 선택</option>
          {items.map((i) => (
            <option key={i.itemCode} value={i.itemCode}>
              {i.itemName}
            </option>
          ))}
        </select>
        <input type="number" step="0.01" placeholder="단가" value={price} onChange={(e) => setPrice(e.target.value)} className={`${inputCls} w-[120px]`} />
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={`${inputCls} w-auto`}>
          <option value="">전체 적용</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.roundName}만 적용
            </option>
          ))}
        </select>
        <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className={`${inputCls} w-auto`} />
        <button type="submit" className={primaryBtnCls}>
          등록
        </button>
      </form>
    </div>
  );
}
