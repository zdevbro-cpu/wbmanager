import { useEffect, useState } from 'react';
import { Boxes, X, Truck } from 'lucide-react';
import { api } from '../api/client';
import { useProjects, useItemMasters } from '../hooks/useMasters';
import { InboundFormPage } from './InboundFormPage';
import { FormModal } from '../components/FormModal';
import { NumberInput } from '../components/ui/NumberInput';
import { formatNumber } from '../lib/number';
import { pageTitleCls, sectionTitleCls, primaryBtnCls, inputCls, tableWrapCls, thCls, tdCls, trCls } from '../components/ui/classes';
import type { InventoryValuation, InventoryValuationRow, LedgerEntry } from '../types';

const SOURCE_LABEL: Record<string, string> = { project: '차수전용', global: '전체적용', base: '기준단가' };

const REF_TYPE_LABEL: Record<string, string> = {
  inbound: '입고',
  waste_inbound: '폐기물입고',
  sorting: '선별',
  outbound_sale: '매각',
  waste_outbound: '폐기물반출',
};

export function InventoryPage() {
  const { projects } = useProjects();
  const { items } = useItemMasters();
  const [projectId, setProjectId] = useState('');
  const [valuation, setValuation] = useState<InventoryValuation | null>(null);
  const [drilldown, setDrilldown] = useState<{ row: InventoryValuationRow; entries: LedgerEntry[] } | null>(null);
  const [inboundOpen, setInboundOpen] = useState(false);

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

      <div className="mb-5 flex items-center gap-2">
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={`${inputCls} w-auto`}>
          <option value="">전체 프로젝트</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.roundName}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => setInboundOpen(true)} className={primaryBtnCls}>
          <Truck size={15} /> 입고 등록
        </button>
      </div>

      {valuation && (
        <>
          <div className="mb-4 w-fit rounded-[12px] border border-primary bg-card p-4">
            <div className="text-[13px] text-text-faint">재고평가 합계</div>
            <div className="tabular text-[22px] font-extrabold text-text-strong">{formatNumber(valuation.totalValuation)}원</div>
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
                    <td className={`${tdCls} tabular text-right`}>{formatNumber(r.inWeight)}</td>
                    <td className={`${tdCls} tabular text-right`}>{formatNumber(r.outWeight)}</td>
                    <td className={`${tdCls} tabular text-right font-bold text-text-strong`}>{formatNumber(r.remaining)}</td>
                    <td className={`${tdCls} tabular text-right`}>{formatNumber(r.unitPrice)}</td>
                    <td className={tdCls}>{SOURCE_LABEL[r.priceSource]}</td>
                    <td className={`${tdCls} tabular text-right`}>{formatNumber(r.valuationAmount)}</td>
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

      {inboundOpen && (
        <FormModal title="입고(반입) 등록" icon={Truck} onClose={() => setInboundOpen(false)}>
          {/* 등록 즉시 재고 목록을 갱신한다 — 입고가 재고의 시작점이다. */}
          <InboundFormPage embedded onCreated={search} />
        </FormModal>
      )}

      {drilldown && (
        <div className="fixed top-0 right-0 h-screen w-[860px] max-w-full overflow-y-auto border-l border-border bg-card p-5 shadow-[-8px_0_24px_rgba(0,0,0,0.35)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[16px] font-extrabold text-text-strong">
              {drilldown.row.projectName} / {drilldown.row.itemName}
              <span className="ml-2 text-[13px] font-semibold text-text-sub">
                잔량 <span className="tabular">{formatNumber(drilldown.row.remaining)}</span>kg
              </span>
            </h2>
            <button type="button" onClick={() => setDrilldown(null)} className="text-text-sub hover:text-text-strong">
              <X size={18} />
            </button>
          </div>

          <div className={`${tableWrapCls} overflow-x-auto`}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-y border-border">
                  <th className={thCls}>일자</th>
                  <th className={thCls}>구분</th>
                  <th className={thCls}>상/하차지</th>
                  <th className={thCls}>거래처</th>
                  <th className={thCls}>차종</th>
                  <th className={thCls}>차량번호</th>
                  <th className={thCls}>운전자</th>
                  <th className={thCls}>연락처</th>
                  <th className={thCls}>총중량</th>
                  <th className={thCls}>공차중량</th>
                  <th className={thCls}>감량</th>
                  <th className={thCls}>반영중량</th>
                  <th className={thCls}>비고</th>
                </tr>
              </thead>
              <tbody>
                {drilldown.entries.map((e) => {
                  const d = e.detail;
                  return (
                    <tr key={e.id} className={trCls}>
                      <td className={`${tdCls} tabular whitespace-nowrap`}>
                        {new Date(e.ledgerDate).toISOString().slice(0, 10)}
                      </td>
                      <td className={`${tdCls} whitespace-nowrap`}>
                        <span className={e.direction === 'IN' ? 'font-bold text-success' : 'font-bold text-danger'}>
                          {e.direction === 'IN' ? '+' : '−'} {REF_TYPE_LABEL[e.refType ?? ''] ?? e.refType}
                        </span>
                      </td>
                      <td className={tdCls}>{d?.place ?? '-'}</td>
                      <td className={tdCls}>{d?.counterparty ?? '-'}</td>
                      <td className={tdCls}>{d?.vehicleType ?? '-'}</td>
                      <td className={`${tdCls} whitespace-nowrap`}>{d?.vehicleNo ?? '-'}</td>
                      <td className={tdCls}>{d?.driverName ?? '-'}</td>
                      <td className={`${tdCls} whitespace-nowrap`}>{d?.driverPhone ?? '-'}</td>
                      <td className={`${tdCls} tabular text-right`}>{formatNumber(d?.grossWeight)}</td>
                      <td className={`${tdCls} tabular text-right`}>{formatNumber(d?.tareWeight)}</td>
                      <td className={`${tdCls} tabular text-right`}>{formatNumber(d?.lossWeight)}</td>
                      <td className={`${tdCls} tabular text-right font-bold text-text-strong`}>{formatNumber(e.weight)}</td>
                      <td className={tdCls}>{d?.memo ?? '-'}</td>
                    </tr>
                  );
                })}
                {drilldown.entries.length === 0 && (
                  <tr>
                    <td colSpan={13} className="py-8 text-center text-[13px] text-text-faint">
                      변동 내역이 없습니다.
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
        <NumberInput
          placeholder="단가"
          value={price}
          onChange={setPrice}
          className={`${inputCls} tabular w-[120px] text-right`}
        />
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
