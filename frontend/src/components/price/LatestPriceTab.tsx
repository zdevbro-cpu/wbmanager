import { useCallback, useEffect, useState } from 'react';
import { Building2, Coins, Download, Megaphone, TriangleAlert } from 'lucide-react';
import { api } from '../../api/client';
import { downloadFile } from '../../lib/download';
import { useVendors } from '../../hooks/useMasters';
import { SearchSelect } from '../SearchSelect';
import { Badge, type BadgeTone } from '../ui/Badge';
import { SummaryCard } from '../ui/SummaryCard';
import { inputCls, tableWrapCls, tdCls, tdNumCls, thCls, thNumCls, trCls } from '../ui/classes';
import type { LatestPriceRow, LatestPriceSummary } from '../../types';

// PRC-01 최신단가 현황 — 업체×품목마다 가장 최근 단가 한 줄.
// 최신은 적용일이 가장 늦은 값이고, 같은 날 실제·참고가 함께 있으면 실제를 쓴다(검토의견 ④).

const WARN_TONE: Record<string, BadgeTone> = { ok: 'slate', check: 'amber', stale: 'red', none: 'slate' };
const won = (n: number | null) => (n == null ? '-' : n.toLocaleString());

export function LatestPriceTab({ onOpenItem }: { onOpenItem: (vendorItemId: string) => void }) {
  const { vendors } = useVendors();
  const [rows, setRows] = useState<LatestPriceRow[]>([]);
  const [summary, setSummary] = useState<LatestPriceSummary | null>(null);
  const [seriesList, setSeriesList] = useState<{ series: string; count: number }[]>([]);
  const [series, setSeries] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [priceType, setPriceType] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<{ series: string; count: number }[]>('/api/prices/series').then(setSeriesList);
  }, []);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (series) params.set('series', series);
    if (vendorId) params.set('vendorId', vendorId);
    if (priceType) params.set('priceType', priceType);
    if (q.trim()) params.set('q', q.trim());
    setBusy(true);
    api
      .get<{ rows: LatestPriceRow[]; summary: LatestPriceSummary }>(`/api/prices/latest?${params.toString()}`)
      .then((r) => {
        setRows(r.rows);
        setSummary(r.summary);
      })
      .finally(() => setBusy(false));
  }, [series, vendorId, priceType, q]);

  // 글자를 치는 동안 매번 부르지 않는다 — 잠깐 멈추면 그때 찾는다.
  useEffect(() => {
    const timer = window.setTimeout(load, q ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [load, q]);

  const exportXlsx = () => {
    const params = new URLSearchParams();
    if (series) params.set('series', series);
    if (vendorId) params.set('vendorId', vendorId);
    if (priceType) params.set('priceType', priceType);
    if (q.trim()) params.set('q', q.trim());
    downloadFile(`/api/list-exports/prices?${params.toString()}`, '최신단가.xlsx').catch((e) =>
      alert(e instanceof Error ? e.message : '내려받지 못했습니다.'),
    );
  };

  return (
    <div>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={Building2}
          color="#3884ff"
          label="등록 매각처"
          value={`${summary?.vendorCount ?? 0}곳`}
          sub={`업체×품목 ${summary?.itemCount ?? 0}건`}
        />
        <SummaryCard
          icon={Coins}
          color="#22c55e"
          label="단가 기록"
          value={`${summary?.priceCount ?? 0}건`}
          sub={`실제 ${summary?.realCount ?? 0} · 참고 ${summary?.refCount ?? 0}`}
        />
        <SummaryCard
          icon={Megaphone}
          color="#a78bfa"
          label="최근 공지"
          value={
            summary?.lastNotice
              ? `${summary.lastNotice.noticeDate.slice(5)} ${summary.lastNotice.vendorName}`
              : '없음'
          }
          sub={
            summary?.lastNotice
              ? `${summary.lastNotice.series ?? ''} ${summary.lastNotice.scope} ${summary.lastNotice.adjustAmount > 0 ? '+' : ''}${summary.lastNotice.adjustAmount}원`
              : '공지를 등록하면 여기에 보입니다'
          }
        />
        <SummaryCard
          icon={TriangleAlert}
          color="#f59e0b"
          label="확인 권장"
          value={`${(summary?.checkCount ?? 0) + (summary?.staleCount ?? 0)}건`}
          sub={`45~90일 ${summary?.checkCount ?? 0} · 90일 초과 ${summary?.staleCount ?? 0}(기록 없음 ${summary?.noPriceCount ?? 0})`}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <label className="w-[150px]">
          <span className="mb-1 block text-[12px] font-semibold text-text-sub">계열</span>
          <SearchSelect
            options={seriesList.map((s) => ({ value: s.series, label: `${s.series} (${s.count})` }))}
            value={series}
            onChange={setSeries}
            ariaLabel="계열"
          />
        </label>
        <label className="w-[190px]">
          <span className="mb-1 block text-[12px] font-semibold text-text-sub">업체</span>
          <SearchSelect
            options={vendors.map((v) => ({ value: v.id, label: v.name }))}
            value={vendorId}
            onChange={setVendorId}
            ariaLabel="업체"
          />
        </label>
        <label className="w-[120px]">
          <span className="mb-1 block text-[12px] font-semibold text-text-sub">구분</span>
          <SearchSelect
            options={[
              { value: '실제', label: '실제' },
              { value: '참고', label: '참고' },
            ]}
            value={priceType}
            onChange={setPriceType}
            ariaLabel="구분"
          />
        </label>
        <label className="min-w-[220px] flex-1">
          <span className="mb-1 block text-[12px] font-semibold text-text-sub">품목 검색</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="업체명·품목명 일부 입력"
            className={inputCls}
          />
        </label>
        <button type="button" onClick={exportXlsx} className="inline-flex h-[38px] items-center gap-1.5 rounded-[8px] border border-border px-3 text-[13px] font-bold text-text-mid hover:bg-hover">
          <Download size={14} /> 엑셀 내려받기
        </button>
      </div>

      <div className={tableWrapCls}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={thCls}>업체</th>
              <th className={thCls}>품목</th>
              <th className={thCls}>계열</th>
              <th className={thNumCls}>최신단가</th>
              <th className={thCls}>구분</th>
              <th className={thCls}>적용일</th>
              <th className={thNumCls}>이전단가</th>
              <th className={thNumCls}>변동</th>
              <th className={thNumCls}>변동률</th>
              <th className={thCls}>최근 실거래</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.vendorItemId}
                className={`${trCls} cursor-pointer`}
                onClick={() => onOpenItem(r.vendorItemId)}
                title="누르면 단가조회 · 추이로 갑니다"
              >
                <td className={tdCls}>{r.vendorName}</td>
                <td className={`${tdCls} font-semibold text-text-strong`}>{r.vendorItemName}</td>
                <td className={tdCls}>{r.series ?? '-'}</td>
                <td className={tdNumCls}>{r.isFree ? '무상' : won(r.price)}</td>
                <td className={tdCls}>
                  {r.priceType ? <Badge tone={r.priceType === '실제' ? 'green' : 'slate'}>{r.priceType}</Badge> : '-'}
                </td>
                <td className={tdCls}>{r.effectiveDate ?? '-'}</td>
                <td className={tdNumCls}>{won(r.prevPrice)}</td>
                <td className={tdNumCls}>
                  {r.delta == null ? '-' : r.delta === 0 ? '0' : `${r.delta < 0 ? '▼' : '▲'} ${Math.abs(r.delta).toLocaleString()}`}
                </td>
                <td className={tdNumCls}>{r.deltaRate == null ? '-' : `${r.deltaRate}%`}</td>
                <td className={tdCls}>
                  {r.warn.days == null ? (
                    <Badge tone="slate">거래 없음</Badge>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <span className="tabular">{r.warn.days}일</span>
                      {r.warn.level !== 'ok' && <Badge tone={WARN_TONE[r.warn.level]}>{r.warn.label}</Badge>}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={10} className="py-10 text-center text-[13px] text-text-faint">
                  {busy ? '불러오는 중...' : '등록된 단가가 없습니다. 「단가 입력」 탭에서 적거나 업체품목부터 등록하세요.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
