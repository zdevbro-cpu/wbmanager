import { useCallback, useEffect, useState } from 'react';
import { ClipboardPaste, Save } from 'lucide-react';
import { api } from '../../api/client';
import { useVendors } from '../../hooks/useMasters';
import { SearchSelect } from '../SearchSelect';
import { Badge } from '../ui/Badge';
import { DateField } from '../ui/DateField';
import { NumberInput } from '../ui/NumberInput';
import { cardCls, inputCls, tableWrapCls, tdCls, tdNumCls, thCls, thNumCls, trCls } from '../ui/classes';
import type { PriceEntryRow } from '../../types';

// PRC-03 단가 입력 — 날짜와 업체를 고르면 그 업체 품목이 줄지어 나온다.
// 이름을 손으로 적지 않으므로 오타로 새 품목이 생기지 않는다. 빈 칸은 저장하지 않는다.

interface Draft {
  price: string;
  priceType: '실제' | '참고';
  isFree: boolean;
  memo: string;
}

const today = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

export function PriceEntryTab() {
  const { vendors } = useVendors();
  const [effectiveDate, setEffectiveDate] = useState(today());
  const [vendorId, setVendorId] = useState('');
  const [defaultType, setDefaultType] = useState<'실제' | '참고'>('실제');
  const [rows, setRows] = useState<PriceEntryRow[]>([]);
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!vendorId) {
      setRows([]);
      return;
    }
    api
      .get<PriceEntryRow[]>(`/api/prices/entry-rows?vendorId=${vendorId}&asOf=${effectiveDate}`)
      .then((r) => {
        setRows(r);
        setDraft({});
      });
  }, [vendorId, effectiveDate]);

  useEffect(() => {
    load();
  }, [load]);

  const setCell = (id: string, patch: Partial<Draft>) =>
    setDraft((d) => ({
      ...d,
      [id]: { ...(d[id] ?? { price: '', priceType: defaultType, isFree: false, memo: '' }), ...patch },
    }));

  const filled = Object.entries(draft).filter(([, d]) => d.isFree || d.price.trim() !== '');

  const save = async () => {
    if (!filled.length) return;
    setBusy(true);
    try {
      await api.post('/api/prices/bulk', {
        rows: filled.map(([vendorItemId, d]) => ({
          vendorItemId,
          effectiveDate,
          price: d.isFree ? 0 : Number(d.price),
          priceType: d.priceType,
          isFree: d.isFree,
          memo: d.memo || null,
          source: '수기',
        })),
      });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  // 엑셀에서 「품목명 <탭> 단가」로 긁어 붙이면 해당 줄의 새 단가 칸이 채워진다.
  const applyPaste = () => {
    const map = new Map(rows.map((r) => [r.vendorItemName.replace(/\s/g, ''), r.vendorItemId]));
    let hit = 0;
    const next: Record<string, Draft> = { ...draft };
    for (const line of pasteText.split(/\r?\n/)) {
      const [rawName, rawPrice] = line.split(/[\t,;]|\s{2,}/);
      if (!rawName || !rawPrice) continue;
      const id = map.get(rawName.trim().replace(/\s/g, ''));
      const price = rawPrice.replace(/[^0-9.-]/g, '');
      if (!id || !price) continue;
      const base = next[id] ?? { price: '', priceType: defaultType, isFree: false, memo: '엑셀 붙여넣기' };
      next[id] = { ...base, price };
      hit += 1;
    }
    setDraft(next);
    setPasteOpen(false);
    setPasteText('');
    if (!hit) alert('붙여 넣은 줄에서 품목을 찾지 못했습니다. 「품목명 [탭] 단가」 형태로 붙여 주세요.');
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <label className="w-[150px]">
          <span className="mb-1 block text-[12px] font-semibold text-text-sub">적용일</span>
          <DateField value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
        </label>
        <label className="w-[200px]">
          <span className="mb-1 block text-[12px] font-semibold text-text-sub">업체</span>
          <SearchSelect
            options={vendors.map((v) => ({ value: v.id, label: v.name }))}
            value={vendorId}
            onChange={setVendorId}
            placeholder="고르세요"
            ariaLabel="업체"
          />
        </label>
        <label className="w-[130px]">
          <span className="mb-1 block text-[12px] font-semibold text-text-sub">구분 기본값</span>
          <select
            value={defaultType}
            onChange={(e) => setDefaultType(e.target.value as '실제' | '참고')}
            className={inputCls}
          >
            <option value="실제">실제</option>
            <option value="참고">참고</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => setPasteOpen((v) => !v)}
          disabled={!rows.length}
          className="inline-flex h-[38px] items-center gap-1.5 rounded-[8px] border border-border px-3 text-[13px] font-bold text-text-mid hover:bg-hover disabled:opacity-40"
        >
          <ClipboardPaste size={14} /> 엑셀 붙여넣기
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!filled.length || busy}
          className="ml-auto inline-flex h-[38px] items-center gap-1.5 rounded-[8px] bg-primary px-4 text-[13px] font-bold text-white hover:brightness-110 disabled:opacity-40"
        >
          <Save size={14} /> {filled.length}건 저장
        </button>
      </div>

      {pasteOpen && (
        <div className={`${cardCls} mb-3 p-3`}>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={5}
            placeholder={'엑셀에서 「품목명  단가」 두 칸을 긁어 붙여 넣으세요.\n고철(경A)\t440\n고철(중A)\t475'}
            className={`${inputCls} h-auto py-2`}
          />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setPasteOpen(false)} className="rounded-[8px] border border-border px-3 py-1.5 text-[13px] font-bold text-text-sub">
              닫기
            </button>
            <button type="button" onClick={applyPaste} className="rounded-[8px] bg-primary px-3 py-1.5 text-[13px] font-bold text-white">
              칸에 채우기
            </button>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <p className="mb-2 text-[12.5px] text-text-sub">
          {vendors.find((v) => v.id === vendorId)?.name}에 등록된 {rows.length}개 품목입니다. 바뀐 품목만 단가를 채우고
          저장하세요 — 빈 칸은 저장되지 않습니다.
        </p>
      )}

      <div className={tableWrapCls}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={thCls}>품목</th>
              <th className={thCls}>계열</th>
              <th className={thNumCls}>현재 단가</th>
              <th className={thCls}>현재 구분·적용일</th>
              <th className={thNumCls}>새 단가</th>
              <th className={thCls}>구분</th>
              <th className={thCls}>비고</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const d = draft[r.vendorItemId];
              return (
                <tr key={r.vendorItemId} className={trCls}>
                  <td className={`${tdCls} font-semibold text-text-strong`}>{r.vendorItemName}</td>
                  <td className={tdCls}>{r.series ?? '-'}</td>
                  <td className={tdNumCls}>{r.isFree ? '무상' : r.price == null ? '-' : `${r.price.toLocaleString()}원`}</td>
                  <td className={tdCls}>
                    {r.priceType ? (
                      <Badge tone={r.priceType === '실제' ? 'green' : 'slate'}>
                        {r.priceType} {r.effectiveDate?.slice(5)}
                      </Badge>
                    ) : (
                      <span className="text-text-faint">기록 없음</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <label className="flex items-center gap-1 text-[12px] text-text-sub" title="0원 · 무상으로 저장">
                        <input
                          type="checkbox"
                          checked={d?.isFree ?? false}
                          onChange={(e) => setCell(r.vendorItemId, { isFree: e.target.checked })}
                          className="h-3.5 w-3.5"
                        />
                        무상
                      </label>
                      <div className="w-[110px]">
                        <NumberInput
                          value={d?.price ?? ''}
                          onChange={(v) => setCell(r.vendorItemId, { price: v })}
                          aria-label={`${r.vendorItemName} 새 단가`}
                        />
                      </div>
                    </div>
                  </td>
                  <td className={tdCls}>
                    <select
                      value={d?.priceType ?? defaultType}
                      onChange={(e) => setCell(r.vendorItemId, { priceType: e.target.value as '실제' | '참고' })}
                      className={`${inputCls} h-[32px] w-[86px] text-[12.5px]`}
                      aria-label={`${r.vendorItemName} 구분`}
                    >
                      <option value="실제">실제</option>
                      <option value="참고">참고</option>
                    </select>
                  </td>
                  <td className={tdCls}>
                    <input
                      value={d?.memo ?? ''}
                      onChange={(e) => setCell(r.vendorItemId, { memo: e.target.value })}
                      placeholder="-"
                      className={`${inputCls} h-[32px] text-[12.5px]`}
                      aria-label={`${r.vendorItemName} 비고`}
                    />
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-[13px] text-text-faint">
                  업체를 고르면 그 업체의 품목이 나옵니다. 품목은 「시스템 관리 › 마스터 관리 › 업체품목」에서 등록합니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
