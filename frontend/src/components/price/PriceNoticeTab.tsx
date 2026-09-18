import { useCallback, useEffect, useState } from 'react';
import { Check, Eye, Megaphone } from 'lucide-react';
import { api } from '../../api/client';
import { useVendors } from '../../hooks/useMasters';
import { SearchSelect } from '../SearchSelect';
import { Badge } from '../ui/Badge';
import { DateField } from '../ui/DateField';
import { cardCls, inputCls, tableWrapCls, tdCls, tdNumCls, thCls, thNumCls, trCls } from '../ui/classes';
import type { NoticePreviewRow, PriceNoticeRow, VendorItemRow } from '../../types';

// PRC-04 공지 등록 · 일괄반영 — 공지를 적는다고 단가가 바뀌지 않는다.
// 바뀔 단가를 먼저 보여 주고, [일괄 반영]을 눌러야 참고단가로 쌓인다(검토의견 ③).

const today = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

export function PriceNoticeTab() {
  const { vendors } = useVendors();
  const [items, setItems] = useState<VendorItemRow[]>([]);
  const [form, setForm] = useState({
    noticeDate: today(),
    vendorId: '',
    series: '',
    adjustAmount: '',
    scope: '전품목' as '전품목' | '지정',
    targetVendorItemId: '',
    content: '',
  });
  const [preview, setPreview] = useState<NoticePreviewRow[] | null>(null);
  const [notices, setNotices] = useState<PriceNoticeRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<VendorItemRow[]>('/api/vendor-items').then(setItems);
  }, []);

  const loadNotices = useCallback(() => {
    api.get<PriceNoticeRow[]>('/api/price-notices').then(setNotices);
  }, []);
  useEffect(() => {
    loadNotices();
  }, [loadNotices]);

  const set = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setPreview(null);
  };

  const vendorItems = items.filter((i) => i.vendorId === form.vendorId);
  const seriesOptions = [...new Set(vendorItems.map((i) => i.series).filter(Boolean))].map((s) => ({
    value: s as string,
    label: s as string,
  }));

  const doPreview = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ rows: NoticePreviewRow[] }>('/api/price-notices/preview', {
        ...form,
        adjustAmount: Number(form.adjustAmount),
      });
      setPreview(r.rows);
    } catch (e) {
      alert(e instanceof Error ? e.message : '미리보기를 만들지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!preview?.length) return;
    const n = preview.filter((r) => r.nextPrice != null).length;
    if (!confirm(`${n}건의 참고단가를 ${form.noticeDate}자로 반영합니다. 진행할까요?`)) return;
    setBusy(true);
    try {
      const r = await api.post<{ applied: number }>('/api/price-notices', {
        ...form,
        adjustAmount: Number(form.adjustAmount),
        apply: true,
      });
      alert(`${r.applied}건을 반영했습니다.`);
      setPreview(null);
      set({ adjustAmount: '', content: '' });
      loadNotices();
    } catch (e) {
      alert(e instanceof Error ? e.message : '반영하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const ready = form.vendorId && form.noticeDate && form.adjustAmount !== '';

  return (
    <div className="flex flex-col gap-3">
      {/* ① 공지 등록 */}
      <div className={`${cardCls} p-4`}>
        <div className="mb-3 flex items-center gap-1.5 text-[14px] font-extrabold text-text-strong">
          <Megaphone size={16} className="text-primary" /> ① 공지 등록
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <label>
            <span className="mb-1 block text-[12px] font-semibold text-text-sub">공지일</span>
            <DateField value={form.noticeDate} onChange={(e) => set({ noticeDate: e.target.value })} />
          </label>
          <label>
            <span className="mb-1 block text-[12px] font-semibold text-text-sub">업체</span>
            <SearchSelect
              options={vendors.map((v) => ({ value: v.id, label: v.name }))}
              value={form.vendorId}
              onChange={(v) => set({ vendorId: v, series: '', targetVendorItemId: '' })}
              placeholder="고르세요"
              ariaLabel="업체"
            />
          </label>
          <label>
            <span className="mb-1 block text-[12px] font-semibold text-text-sub">계열</span>
            <SearchSelect options={seriesOptions} value={form.series} onChange={(v) => set({ series: v })} ariaLabel="계열" />
          </label>
          <label>
            <span className="mb-1 block text-[12px] font-semibold text-text-sub">조정금액 (원)</span>
            <input
              value={form.adjustAmount}
              onChange={(e) => set({ adjustAmount: e.target.value.replace(/[^0-9.-]/g, '') })}
              placeholder="-10"
              className={`${inputCls} text-right`}
            />
          </label>
          <label>
            <span className="mb-1 block text-[12px] font-semibold text-text-sub">적용범위</span>
            <select
              value={form.scope}
              onChange={(e) => set({ scope: e.target.value as '전품목' | '지정' })}
              className={inputCls}
            >
              <option value="전품목">전품목</option>
              <option value="지정">지정 품목</option>
            </select>
          </label>
          {form.scope === '지정' ? (
            <label>
              <span className="mb-1 block text-[12px] font-semibold text-text-sub">대상 품목</span>
              <SearchSelect
                options={vendorItems.map((i) => ({ value: i.id, label: i.vendorItemName }))}
                value={form.targetVendorItemId}
                onChange={(v) => set({ targetVendorItemId: v })}
                placeholder="고르세요"
                ariaLabel="대상 품목"
              />
            </label>
          ) : (
            <label className="col-span-2 lg:col-span-1">
              <span className="mb-1 block text-[12px] font-semibold text-text-sub">공지내용</span>
              <input
                value={form.content}
                onChange={(e) => set({ content: e.target.value })}
                placeholder="9/12부 전등급 10원 인하"
                className={inputCls}
              />
            </label>
          )}
        </div>
        {form.scope === '지정' && (
          <label className="mt-3 block">
            <span className="mb-1 block text-[12px] font-semibold text-text-sub">공지내용</span>
            <input
              value={form.content}
              onChange={(e) => set({ content: e.target.value })}
              placeholder="9/12부 고철(경A) 10원 인하"
              className={inputCls}
            />
          </label>
        )}
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={doPreview}
            disabled={!ready || busy}
            className="inline-flex h-[38px] items-center gap-1.5 rounded-[8px] border border-primary px-4 text-[13px] font-bold text-primary hover:bg-nav-hover disabled:opacity-40"
          >
            <Eye size={14} /> 바뀔 단가 보기
          </button>
        </div>
      </div>

      {/* ② 반영 미리보기 */}
      {preview && (
        <div className={cardCls}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3.5">
            <div className="text-[14px] font-extrabold text-text-strong">② 반영 미리보기</div>
            <div className="text-[12.5px] text-text-sub">
              {vendors.find((v) => v.id === form.vendorId)?.name} {form.series} {form.scope} {preview.length}개 품목 · 최근
              적용단가 + 조정금액 (실제 단가가 있으면 실제 우선)
            </div>
            <button
              type="button"
              onClick={apply}
              disabled={busy || !preview.some((r) => r.nextPrice != null)}
              className="inline-flex h-[36px] items-center gap-1.5 rounded-[8px] bg-primary px-4 text-[13px] font-bold text-white hover:brightness-110 disabled:opacity-40"
            >
              <Check size={14} /> {preview.filter((r) => r.nextPrice != null).length}건 일괄 반영
            </button>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={thCls}>품목</th>
                <th className={thNumCls}>최근 적용단가</th>
                <th className={thCls}>최근 반영일</th>
                <th className={thNumCls}>조정</th>
                <th className={thNumCls}>참고단가</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((r) => (
                <tr key={r.vendorItemId} className={trCls}>
                  <td className={`${tdCls} font-semibold text-text-strong`}>{r.vendorItemName}</td>
                  <td className={tdNumCls}>{r.basePrice == null ? '기록 없음' : `${r.basePrice.toLocaleString()}원`}</td>
                  <td className={tdCls}>
                    {r.baseDate ?? '-'} {r.basePriceType && <Badge tone={r.basePriceType === '실제' ? 'green' : 'slate'}>{r.basePriceType}</Badge>}
                  </td>
                  <td className={tdNumCls}>
                    {r.adjustAmount > 0 ? '+' : ''}
                    {r.adjustAmount.toLocaleString()}
                  </td>
                  <td className={`${tdNumCls} font-bold text-text-strong`}>
                    {r.nextPrice == null ? '-' : `${r.nextPrice.toLocaleString()}원`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ③ 공지 누적기록 */}
      <div>
        <div className="mb-2 text-[14px] font-extrabold text-text-strong">③ 공지 누적기록</div>
        <div className={tableWrapCls}>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={thCls}>공지일</th>
                <th className={thCls}>업체</th>
                <th className={thCls}>계열</th>
                <th className={thCls}>적용범위</th>
                <th className={thNumCls}>조정금액</th>
                <th className={thCls}>공지내용</th>
                <th className={thCls}>상태</th>
              </tr>
            </thead>
            <tbody>
              {notices.map((n) => (
                <tr key={n.id} className={trCls}>
                  <td className={tdCls}>{n.noticeDate}</td>
                  <td className={tdCls}>{n.vendorName}</td>
                  <td className={tdCls}>{n.series ?? '-'}</td>
                  <td className={tdCls}>{n.scope === '지정' ? (n.targetVendorItemName ?? '지정') : '전품목'}</td>
                  <td className={tdNumCls}>
                    {n.adjustAmount > 0 ? '+' : ''}
                    {n.adjustAmount.toLocaleString()}
                  </td>
                  <td className={tdCls}>{n.content ?? '-'}</td>
                  <td className={tdCls}>
                    {n.appliedAt ? <Badge tone="green">반영 완료</Badge> : <Badge tone="amber">반영 전</Badge>}
                  </td>
                </tr>
              ))}
              {!notices.length && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[13px] text-text-faint">
                    등록된 공지가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
