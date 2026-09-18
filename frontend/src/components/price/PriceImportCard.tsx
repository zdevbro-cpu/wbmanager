import { useRef, useState } from 'react';
import { FileSpreadsheet, TriangleAlert, Upload } from 'lucide-react';
import { API_BASE_URL } from '../../api/client';
import { auth } from '../../lib/firebase';
import { Badge } from '../ui/Badge';
import { cardCls, tdCls, thCls, trCls } from '../ui/classes';

// 엑셀 「단가관리」 이관 — 옮길 결과를 먼저 보여 주고, 확인을 받은 뒤에만 저장한다.
// 확인 없이 옮기지 않는다. 옮긴 단가는 출처가 「이관」으로 남는다.

interface Plan {
  fileName: string;
  counts: {
    vendors: number;
    newVendors: number;
    items: number;
    newItems: number;
    itemsFromHistoryOnly: number;
    prices: number;
    willInsert: number;
    mergedSameValue: number;
    conflicts: number;
    free: number;
    notices: number;
    rates: number;
  };
  newVendors: string[];
  newItems: { vendorName: string; vendorItemName: string; series: string | null; fromHistoryOnly: boolean }[];
  conflicts: {
    effectiveDate: string;
    vendorName: string;
    vendorItemName: string;
    priceType: string;
    prevPrice: number;
    price: number;
  }[];
  free: { effectiveDate: string; vendorName: string; vendorItemName: string; rawPrice: string }[];
}

async function send<T>(path: string, file: File): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `요청 실패 (${res.status})`);
  }
  return res.json();
}

export function PriceImportCard({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const pick = (f: File | null) => {
    setFile(f);
    setPlan(null);
  };

  const preview = async () => {
    if (!file) return;
    setBusy(true);
    try {
      setPlan(await send<Plan>('/api/prices/import/preview', file));
    } catch (e) {
      alert(e instanceof Error ? e.message : '엑셀을 읽지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    if (!file || !plan) return;
    const c = plan.counts;
    if (!confirm(`업체 ${c.newVendors}곳 · 품목 ${c.newItems}건 · 단가 ${c.willInsert}건 · 공지 ${c.notices}건 · 시세 ${c.rates}건을 옮깁니다.\n이미 있는 기록은 건너뜁니다. 진행할까요?`)) return;
    setBusy(true);
    try {
      const r = await send<{ vendors: number; items: number; prices: number; notices: number; rates: number; skipped: number }>(
        '/api/prices/import',
        file,
      );
      alert(
        `옮겼습니다.\n업체 ${r.vendors}곳 · 품목 ${r.items}건 · 단가 ${r.prices}건 · 공지 ${r.notices}건 · 시세 ${r.rates}건` +
          (r.skipped ? `\n이미 있어 건너뛴 단가 ${r.skipped}건` : ''),
      );
      setPlan(null);
      setFile(null);
      if (picker.current) picker.current.value = '';
      onDone();
    } catch (e) {
      alert(e instanceof Error ? e.message : '옮기지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`${cardCls} mb-3 p-3.5`}>
      <div className="flex flex-wrap items-center gap-2">
        <FileSpreadsheet size={16} className="text-primary" />
        <span className="text-[14px] font-extrabold text-text-strong">엑셀 이관</span>
        <span className="text-[12.5px] text-text-sub">
          엑셀 「단가관리」 파일을 올리면 품목 · 단가 · 공지 · LME를 한 번에 옮깁니다.
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto rounded-[8px] border border-border px-3 py-1.5 text-[12.5px] font-bold text-text-mid hover:bg-hover"
        >
          {open ? '닫기' : '열기'}
        </button>
      </div>

      {open && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={picker}
              type="file"
              accept=".xlsx"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
              className="text-[12.5px] text-text-sub file:mr-2 file:rounded-[8px] file:border file:border-border file:bg-input file:px-3 file:py-1.5 file:text-[12.5px] file:font-bold file:text-text-mid"
            />
            <button
              type="button"
              onClick={preview}
              disabled={!file || busy}
              className="inline-flex h-[34px] items-center gap-1.5 rounded-[8px] border border-primary px-3 text-[12.5px] font-bold text-primary hover:bg-nav-hover disabled:opacity-40"
            >
              <Upload size={14} /> 옮길 결과 보기
            </button>
            {plan && (
              <button
                type="button"
                onClick={run}
                disabled={busy}
                className="inline-flex h-[34px] items-center gap-1.5 rounded-[8px] bg-primary px-3 text-[12.5px] font-bold text-white hover:brightness-110 disabled:opacity-40"
              >
                이관 실행
              </button>
            )}
          </div>

          {plan && (
            <div className="mt-3">
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
                <Tile label="업체" value={`${plan.counts.vendors}곳`} sub={`새로 만들 곳 ${plan.counts.newVendors}`} />
                <Tile
                  label="업체품목"
                  value={`${plan.counts.items}건`}
                  sub={`새로 만들 것 ${plan.counts.newItems}(이력에만 있던 것 ${plan.counts.itemsFromHistoryOnly})`}
                />
                <Tile
                  label="단가"
                  value={`${plan.counts.willInsert}건`}
                  sub={`원본 ${plan.counts.prices} · 합칠 중복 ${plan.counts.mergedSameValue} · 무상 ${plan.counts.free}`}
                />
                <Tile label="공지" value={`${plan.counts.notices}건`} sub="반영 완료로 남깁니다" />
                <Tile label="LME 시세" value={`${plan.counts.rates}건`} sub="기준일마다 한 건" />
              </div>

              {plan.counts.conflicts > 0 && (
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold text-warning">
                    <TriangleAlert size={15} /> 같은 날 값이 다른 줄 {plan.counts.conflicts}건 — 엑셀과 같이 나중에 적힌
                    값으로 옮깁니다. 다르면 이관 뒤 「단가 입력」에서 고쳐 주세요.
                  </div>
                  <div className="overflow-hidden rounded-[10px] border border-border">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-border">
                          <th className={thCls}>적용일</th>
                          <th className={thCls}>업체</th>
                          <th className={thCls}>품목</th>
                          <th className={thCls}>구분</th>
                          <th className={thCls}>먼저 적힌 값</th>
                          <th className={thCls}>옮길 값</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.conflicts.map((c, i) => (
                          <tr key={`${c.vendorName}-${c.vendorItemName}-${c.effectiveDate}-${i}`} className={trCls}>
                            <td className={tdCls}>{c.effectiveDate}</td>
                            <td className={tdCls}>{c.vendorName}</td>
                            <td className={tdCls}>{c.vendorItemName}</td>
                            <td className={tdCls}>
                              <Badge tone={c.priceType === '실제' ? 'green' : 'slate'}>{c.priceType}</Badge>
                            </td>
                            <td className={tdCls}>{c.prevPrice.toLocaleString()}원</td>
                            <td className={`${tdCls} font-bold text-text-strong`}>{c.price.toLocaleString()}원</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {plan.counts.free > 0 && (
                <p className="mt-2 text-[12.5px] text-text-sub">
                  숫자가 아닌 단가 {plan.counts.free}건(예: {plan.free[0]?.vendorName} {plan.free[0]?.vendorItemName} 「
                  {plan.free[0]?.rawPrice}」)은 0원 · 무상으로 옮기고 평균 · 변동 계산에서 뺍니다.
                </p>
              )}

              {plan.counts.newVendors > 0 && (
                <p className="mt-1.5 text-[12.5px] text-text-sub">
                  거래처 마스터에 없는 업체 {plan.counts.newVendors}곳({plan.newVendors.join(' · ')})은 임시 거래처로
                  만듭니다. 나중에 거래처 탭에서 정리하시면 됩니다.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-[10px] border border-border bg-input px-3 py-2">
      <div className="text-[11.5px] font-semibold text-text-faint">{label}</div>
      <div className="tabular text-[17px] font-extrabold text-text-strong">{value}</div>
      <div className="text-[11.5px] text-text-sub">{sub}</div>
    </div>
  );
}
