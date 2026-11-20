import { useCallback, useEffect, useState } from 'react';
import { CheckCheck, RefreshCw } from 'lucide-react';
import { api } from '../../api/client';
import { DateField } from '../ui/DateField';
import { formatNumber } from '../../lib/number';
import {
  cardPadCls,
  primaryBtnCls,
  outlineBtnCls,
  inputCls,
  tableWrapCls,
  thCls,
  thNumCls,
  tdCls,
  tdNumCls,
  trCls,
} from '../ui/classes';

// 출고 실적에서 단가를 확정해 단가 내역으로 올린다 (요청 2026-11-13).
//
// 「출고현황을 입력했고 입금도 다 적은 경우는 단가가 확정이므로 적용버튼을 누르면
//  내역에 들어가고 같은 날짜 중복 업체와 품목은 제외」 — 그 말씀대로 만들었다.
// 입금이 끝난 건만 확정으로 보고, 겹치면 나중에 넣은 것을 남긴다.

interface Row {
  key: string;
  vendorName: string | null;
  itemName: string | null;
  day: string;
  price: number;
}
interface Preview {
  rows: Row[];
  dropped: { 사유: string }[];
  올릴것: number;
  뺀것: number;
}

export function ConfirmFromOutbound() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<Preview | null>(null);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    setNote('');
    api.get<Preview>(`/api/prices/confirmable?${params.toString()}`).then((r) => {
      setData(r);
      setOff(new Set());
    });
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const picked = (data?.rows ?? []).filter((r) => !off.has(r.key));

  const apply = async () => {
    if (picked.length === 0) return;
    if (!window.confirm(`${picked.length}건을 단가 내역에 올립니다.\n같은 날짜·업체·품목이 이미 있으면 이 값으로 바뀝니다.`)) return;
    setBusy(true);
    try {
      const r = await api.post<{ 추가: number; 수정: number }>('/api/prices/confirm', {
        from: from || undefined,
        to: to || undefined,
        keys: picked.map((x) => x.key),
      });
      setNote(`단가 내역에 올렸습니다 — 새로 ${r.추가}건, 고친 것 ${r.수정}건.`);
      load();
    } catch (e) {
      setNote(e instanceof Error ? e.message : '올리지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cardPadCls}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <CheckCheck size={16} className="text-primary" />
        <span className="text-[14px] font-bold text-text-strong">출고에서 단가 확정하기</span>
        <span className="text-[12.5px] text-text-faint">
          출고를 적고 입금까지 받은 건만 올립니다. 같은 날짜 · 업체 · 품목이 겹치면 나중 것을 남깁니다.
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <DateField value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} w-[150px] px-2`} />
        <span className="text-text-faint">~</span>
        <DateField value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} w-[150px] px-2`} />
        <button type="button" onClick={load} className={outlineBtnCls}>
          <RefreshCw size={15} /> 다시 보기
        </button>
        <span className="ml-auto text-[12.5px] text-text-sub">
          올릴 것 {picked.length}건
          {data && data.뺀것 > 0 && <span className="ml-2 text-text-faint">제외 {data.뺀것}건</span>}
        </span>
        <button type="button" onClick={apply} disabled={busy || picked.length === 0} className={primaryBtnCls}>
          {busy ? '올리는 중...' : '적용'}
        </button>
      </div>

      {note && <p className="mb-3 text-[13px] font-semibold text-success">{note}</p>}

      <div className={tableWrapCls}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-border">
              <th className={thCls}>올림</th>
              <th className={thCls}>적용일</th>
              <th className={thCls}>거래처</th>
              <th className={thCls}>품목</th>
              <th className={thNumCls}>단가</th>
            </tr>
          </thead>
          <tbody>
            {(data?.rows ?? []).map((r) => (
              <tr key={r.key} className={trCls}>
                <td className={tdCls}>
                  <input
                    type="checkbox"
                    checked={!off.has(r.key)}
                    onChange={() =>
                      setOff((prev) => {
                        const next = new Set(prev);
                        if (next.has(r.key)) next.delete(r.key);
                        else next.add(r.key);
                        return next;
                      })
                    }
                  />
                </td>
                <td className={`${tdCls} tabular whitespace-nowrap`}>{r.day}</td>
                <td className={tdCls}>{r.vendorName ?? '-'}</td>
                <td className={tdCls}>{r.itemName ?? '-'}</td>
                <td className={tdNumCls}>{formatNumber(r.price)}</td>
              </tr>
            ))}
            {(data?.rows ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-[13px] text-text-faint">
                  올릴 것이 없습니다. 출고를 적고 입금까지 받은 건만 여기 나옵니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.뺀것 > 0 && (
        <p className="mt-2 text-[12px] text-text-faint">
          제외된 {data.뺀것}건 — {[...new Set(data.dropped.map((d) => d.사유))].join(' · ')}
        </p>
      )}
    </div>
  );
}
