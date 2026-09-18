import { useCallback, useEffect, useState } from 'react';
import { Check, Link2, Plus, TriangleAlert } from 'lucide-react';
import { api } from '../api/client';
import { useItemMasters, useVendors } from '../hooks/useMasters';
import { PriceImportCard } from './price/PriceImportCard';
import { SearchSelect } from './SearchSelect';
import { Badge } from './ui/Badge';
import { cardCls, inputCls, tableWrapCls, tdCls, thCls, trCls } from './ui/classes';
import type { VendorItemRow } from '../types';

// SYS-06 업체품목 관리 — 업체가 부르는 품목명을 모아 두는 곳. 엑셀 「품목관리」를 대신한다.
// 1단계에는 등록·수정만 쓰고, 원방 품목 연결(매핑)은 2단계에 쓴다.
// 같은 이름은 「이름 같은 것 자동 연결」로 한 번에 잇고, 다른 것만 손으로 고른다(검토의견 ⑤).

interface VendorRow {
  vendorId: string;
  vendorName: string;
  itemCount: number;
  seriesLabel: string;
}

export function VendorItemSection() {
  const { vendors } = useVendors();
  const { items: masters } = useItemMasters();
  const [vendorRows, setVendorRows] = useState<VendorRow[]>([]);
  const [rows, setRows] = useState<VendorItemRow[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [mapped, setMapped] = useState({ total: 0, mapped: 0, unmapped: 0 });
  const [adding, setAdding] = useState({ vendorItemName: '', series: '', repItemName: '' });
  const [busy, setBusy] = useState(false);

  const loadSide = useCallback(() => {
    api.get<VendorRow[]>('/api/vendor-items/vendors').then((r) => {
      setVendorRows(r);
      setVendorId((cur) => cur || r[0]?.vendorId || '');
    });
    api.get<typeof mapped>('/api/vendor-items/unmapped').then(setMapped);
  }, []);

  const loadRows = useCallback(() => {
    if (!vendorId) {
      setRows([]);
      return;
    }
    api.get<VendorItemRow[]>(`/api/vendor-items?vendorId=${vendorId}`).then(setRows);
  }, [vendorId]);

  useEffect(() => {
    loadSide();
  }, [loadSide]);
  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const patch = async (id: string, data: Partial<VendorItemRow>) => {
    await api.patch(`/api/vendor-items/${id}`, data);
    loadRows();
    loadSide();
  };

  const add = async () => {
    if (!vendorId || !adding.vendorItemName.trim()) return;
    setBusy(true);
    try {
      await api.post('/api/vendor-items', {
        vendorId,
        vendorItemName: adding.vendorItemName.trim(),
        series: adding.series.trim() || null,
        repItemName: adding.repItemName.trim() || adding.vendorItemName.trim(),
      });
      setAdding({ vendorItemName: '', series: '', repItemName: '' });
      loadRows();
      loadSide();
    } catch (e) {
      alert(e instanceof Error ? e.message : '등록하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const automap = async () => {
    if (!confirm('업체 품목명과 이름이 같은 원방 품목을 한 번에 이어 줍니다. 진행할까요?')) return;
    const r = await api.post<{ count: number }>('/api/vendor-items/automap', {});
    alert(`${r.count}건을 이었습니다. 남은 것은 손으로 골라 주세요.`);
    loadRows();
    loadSide();
  };

  const vendorOptions = vendors.map((v) => ({ value: v.id, label: v.name }));
  const masterOptions = masters.map((m) => ({ value: m.itemCode, label: `${m.itemCode} ${m.itemName}` }));
  const current = vendorRows.find((v) => v.vendorId === vendorId);

  return (
    <div>
      <PriceImportCard
        onDone={() => {
          loadSide();
          loadRows();
        }}
      />
      <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="flex items-center gap-2.5 rounded-[12px] border border-accent/40 bg-accent/10 px-3.5 py-2.5 text-[13px] text-accent">
          <Check size={16} className="shrink-0" />
          <span>단가이력에는 있으나 업체품목에 없는 조합 0건 — 새 조합이 들어오면 여기에 표시됩니다.</span>
        </div>
        <div className="flex items-center gap-2.5 rounded-[12px] border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-[13px] text-warning">
          <TriangleAlert size={16} className="shrink-0" />
          <span>
            원방 품목 미매핑 {mapped.unmapped}건 / {mapped.total}건 — 2단계 출고 단가 자동제안 전에 연결합니다.
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        {/* 매각처 목록 */}
        <div className={`${cardCls} w-full overflow-hidden lg:w-[260px] lg:shrink-0`}>
          <div className="border-b border-border px-3.5 py-3 text-[13px] font-extrabold text-text-strong">
            매각처 {vendorRows.length}곳
          </div>
          {vendorRows.map((v) => (
            <button
              key={v.vendorId}
              type="button"
              onClick={() => setVendorId(v.vendorId)}
              className={`flex w-full items-center justify-between border-b border-border px-3.5 py-2.5 text-left last:border-0 ${
                v.vendorId === vendorId ? 'border-l-[3px] border-l-accent bg-nav-active' : 'border-l-[3px] border-l-transparent'
              }`}
            >
              <span>
                <span className={`block text-[13px] font-bold ${v.vendorId === vendorId ? 'text-nav-active-text' : 'text-text-mid'}`}>
                  {v.vendorName}
                </span>
                <span className="block text-[11.5px] text-text-faint">{v.seriesLabel}</span>
              </span>
              <span className="tabular text-[12px] text-text-sub">{v.itemCount}품목</span>
            </button>
          ))}
          {!vendorRows.length && (
            <div className="px-3.5 py-6 text-center text-[12.5px] text-text-faint">
              아직 등록된 업체품목이 없습니다. 오른쪽에서 업체를 고르고 품목을 추가하세요.
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[14px] font-extrabold text-text-strong">
              {current ? `${current.vendorName} · 업체품목 ${current.itemCount}건` : '업체품목'}
            </div>
            <button
              type="button"
              onClick={automap}
              className="inline-flex h-[34px] items-center gap-1.5 rounded-[8px] border border-border px-3 text-[12.5px] font-bold text-text-mid hover:bg-hover"
            >
              <Link2 size={14} /> 이름 같은 것 자동 연결 <span className="text-[11px] text-text-faint">(2단계)</span>
            </button>
          </div>

          {/* 품목 추가 */}
          <div className={`${cardCls} mb-3 flex flex-wrap items-end gap-2 p-3`}>
            <label className="w-[190px]">
              <span className="mb-1 block text-[12px] font-semibold text-text-sub">업체</span>
              <SearchSelect options={vendorOptions} value={vendorId} onChange={setVendorId} placeholder="고르세요" ariaLabel="업체" />
            </label>
            <label className="w-[190px]">
              <span className="mb-1 block text-[12px] font-semibold text-text-sub">업체 품목명</span>
              <input
                value={adding.vendorItemName}
                onChange={(e) => setAdding((a) => ({ ...a, vendorItemName: e.target.value }))}
                placeholder="고철(경A)"
                className={inputCls}
              />
            </label>
            <label className="w-[130px]">
              <span className="mb-1 block text-[12px] font-semibold text-text-sub">계열</span>
              <input
                value={adding.series}
                onChange={(e) => setAdding((a) => ({ ...a, series: e.target.value }))}
                placeholder="고철"
                className={inputCls}
              />
            </label>
            <label className="w-[150px]">
              <span className="mb-1 block text-[12px] font-semibold text-text-sub">대표품목</span>
              <input
                value={adding.repItemName}
                onChange={(e) => setAdding((a) => ({ ...a, repItemName: e.target.value }))}
                placeholder="비우면 품목명과 같게"
                className={inputCls}
              />
            </label>
            <button
              type="button"
              onClick={add}
              disabled={busy || !vendorId || !adding.vendorItemName.trim()}
              className="inline-flex h-[38px] items-center gap-1.5 rounded-[8px] bg-primary px-4 text-[13px] font-bold text-white hover:brightness-110 disabled:opacity-40"
            >
              <Plus size={14} /> 품목 추가
            </button>
          </div>

          <div className={tableWrapCls}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className={thCls}>업체 품목명</th>
                  <th className={thCls}>계열</th>
                  <th className={thCls}>대표품목</th>
                  <th className={thCls}>
                    원방 품목 (ItemMaster) <span className="ml-1 text-[11px] text-purple">2단계</span>
                  </th>
                  <th className={thCls}>상태</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={trCls}>
                    <td className={`${tdCls} font-semibold text-text-strong`}>{r.vendorItemName}</td>
                    <td className={tdCls}>
                      <input
                        defaultValue={r.series ?? ''}
                        onBlur={(e) => e.target.value !== (r.series ?? '') && patch(r.id, { series: e.target.value })}
                        className={`${inputCls} h-[32px] w-[110px] text-[12.5px]`}
                        aria-label={`${r.vendorItemName} 계열`}
                      />
                    </td>
                    <td className={tdCls}>
                      <input
                        defaultValue={r.repItemName ?? ''}
                        onBlur={(e) =>
                          e.target.value !== (r.repItemName ?? '') && patch(r.id, { repItemName: e.target.value })
                        }
                        className={`${inputCls} h-[32px] w-[130px] text-[12.5px]`}
                        aria-label={`${r.vendorItemName} 대표품목`}
                      />
                    </td>
                    <td className={tdCls}>
                      <div className="w-[230px]">
                        <SearchSelect
                          options={masterOptions}
                          value={r.itemCode ?? ''}
                          onChange={(v) => patch(r.id, { itemCode: v })}
                          placeholder="선택하세요"
                          ariaLabel={`${r.vendorItemName} 원방 품목`}
                        />
                      </div>
                    </td>
                    <td className={tdCls}>
                      {r.itemCode ? <Badge tone="green">매핑 완료</Badge> : <Badge tone="amber">미매핑</Badge>}
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-[13px] text-text-faint">
                      이 업체에 등록된 품목이 없습니다. 위에서 품목을 추가하세요.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
