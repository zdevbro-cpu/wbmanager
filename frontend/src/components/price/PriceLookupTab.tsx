import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Pencil, Search, Trash2, X } from 'lucide-react';
import { api } from '../../api/client';
import { useVendors } from '../../hooks/useMasters';
import { SearchSelect } from '../SearchSelect';
import { Badge } from '../ui/Badge';
import { DateField } from '../ui/DateField';
import { NumberInput } from '../ui/NumberInput';
import { cardCls, inputCls, tableWrapCls, tdCls, tdNumCls, thCls, thNumCls, trCls } from '../ui/classes';
import type { PriceHistoryRow, PriceSummary, VendorItemRow } from '../../types';

// PRC-02 단가조회 · 추이 — 계열 → 업체 → 품목을 고르면 최근 단가와 흐름, 참고단가, 추이를 본다.

const PERIODS = [
  { key: '1m', label: '1개월', days: 31 },
  { key: '3m', label: '3개월', days: 92 },
  { key: '6m', label: '6개월', days: 183 },
  { key: 'all', label: '전체', days: 0 },
] as const;

const won = (n: number | null | undefined) => (n == null ? '-' : `${n.toLocaleString()}원`);

export function PriceLookupTab({ initialItemId }: { initialItemId: string | null }) {
  const { vendors } = useVendors();
  const [items, setItems] = useState<VendorItemRow[]>([]);
  const [series, setSeries] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [itemId, setItemId] = useState(initialItemId ?? '');
  const [asOf, setAsOf] = useState(new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10));
  const [summary, setSummary] = useState<PriceSummary | null>(null);
  const [history, setHistory] = useState<PriceHistoryRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['key']>('all');
  const [title, setTitle] = useState('');
  // 이력 한 줄 고치기 — 잘못 적은 단가·구분·비고를 그 자리에서 고치고 지운다.
  const [editId, setEditId] = useState('');
  const [edit, setEdit] = useState({ price: '', priceType: '실제' as '실제' | '참고', memo: '' });

  useEffect(() => {
    api.get<VendorItemRow[]>('/api/vendor-items').then(setItems);
  }, []);

  // 최신단가에서 넘어온 품목이면 그 업체·계열을 함께 맞춰 둔다.
  useEffect(() => {
    if (!initialItemId || !items.length) return;
    const hit = items.find((i) => i.id === initialItemId);
    if (!hit) return;
    setVendorId(hit.vendorId);
    setSeries(hit.series ?? '');
    setItemId(hit.id);
  }, [initialItemId, items]);

  const matches = useMemo(
    () => items.filter((i) => (!series || i.series === series) && (!vendorId || i.vendorId === vendorId)),
    [items, series, vendorId],
  );
  const options = useMemo(
    () => matches.map((i) => ({ value: i.id, label: `${i.vendorItemName}${vendorId ? '' : ` · ${i.vendorName}`}` })),
    [matches, vendorId],
  );

  // 계열·업체를 바꿔 고른 품목이 조건에서 빠지면 고른 상태도 놓는다.
  // 그대로 두면 이름을 찾지 못해 칸에 내부 번호가 보이고, 오른쪽 결과는 이전 품목이 남는다.
  useEffect(() => {
    if (!itemId || !items.length) return;
    if (matches.some((i) => i.id === itemId)) return;
    setItemId('');
    setSummary(null);
    setHistory([]);
    setTitle('');
  }, [matches, itemId, items.length]);
  const seriesOptions = useMemo(
    () => [...new Set(items.map((i) => i.series).filter(Boolean))].map((s) => ({ value: s as string, label: s as string })),
    [items],
  );

  const load = useCallback(() => {
    if (!itemId) return;
    api
      .get<{ summary: PriceSummary | null; totalCount: number; item: { vendorName: string; vendorItemName: string } }>(
        `/api/prices/summary?vendorItemId=${itemId}&asOf=${asOf}`,
      )
      .then((r) => {
        setSummary(r.summary);
        setTotalCount(r.totalCount);
        setTitle(`${r.item.vendorName} · ${r.item.vendorItemName}`);
      });
    api
      .get<PriceHistoryRow[]>(`/api/prices/history?vendorItemId=${itemId}&limit=${showAll ? 0 : 10}`)
      .then(setHistory);
  }, [itemId, asOf, showAll]);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = (h: PriceHistoryRow) => {
    setEditId(h.id);
    setEdit({ price: String(h.price), priceType: h.priceType, memo: h.memo ?? '' });
  };

  const saveEdit = async () => {
    try {
      await api.patch(`/api/prices/${editId}`, {
        price: Number(edit.price),
        priceType: edit.priceType,
        memo: edit.memo || null,
      });
      setEditId('');
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '고치지 못했습니다.');
    }
  };

  const removeRow = async (h: PriceHistoryRow) => {
    if (!confirm(`${h.effectiveDate} ${h.priceType} ${h.price.toLocaleString()}원을 지웁니다. 진행할까요?`)) return;
    try {
      await api.del(`/api/prices/${h.id}`);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '지우지 못했습니다.');
    }
  };

  const points = useMemo(() => {
    if (!summary) return [];
    const days = PERIODS.find((p) => p.key === period)?.days ?? 0;
    if (!days) return summary.series;
    const from = new Date(new Date(asOf).getTime() - days * 86400000).toISOString().slice(0, 10);
    return summary.series.filter((p) => p.date >= from);
  }, [summary, period, asOf]);

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        {/* 조회 조건 */}
        <div className={`${cardCls} w-full p-4 lg:w-[280px] lg:shrink-0`}>
          <div className="mb-3 text-[14px] font-extrabold text-text-strong">조회 조건</div>
          <div className="flex flex-col gap-3">
            <label>
              <span className="mb-1 block text-[12px] font-semibold text-text-sub">계열</span>
              <SearchSelect options={seriesOptions} value={series} onChange={setSeries} ariaLabel="계열" />
            </label>
            <label>
              <span className="mb-1 block text-[12px] font-semibold text-text-sub">업체</span>
              <SearchSelect
                options={vendors.map((v) => ({ value: v.id, label: v.name }))}
                value={vendorId}
                onChange={setVendorId}
                ariaLabel="업체"
              />
            </label>
            <label>
              <span className="mb-1 block text-[12px] font-semibold text-text-sub">품목 ({options.length})</span>
              <SearchSelect options={options} value={itemId} onChange={setItemId} placeholder="고르세요" ariaLabel="품목" />
              {!options.length && (
                <span className="mt-1 block text-[11.5px] text-warning">
                  이 조건에 맞는 품목이 없습니다. 계열이나 업체를 비워 보세요.
                </span>
              )}
            </label>
            <label>
              <span className="mb-1 block text-[12px] font-semibold text-text-sub">기준일</span>
              <DateField value={asOf} onChange={(e) => setAsOf(e.target.value)} />
            </label>
            <button
              type="button"
              onClick={load}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[10px] bg-primary px-4 text-sm font-bold text-white hover:brightness-110"
            >
              <Search size={15} /> 조회
            </button>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {!itemId || !summary ? (
            <div className={`${cardCls} p-10 text-center text-[13px] text-text-faint`}>
              {itemId ? '이 품목에는 아직 단가 기록이 없습니다.' : '왼쪽에서 품목을 고르세요.'}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
                <Stat label="최근 단가" value={summary.latest.isFree ? '무상' : won(summary.latest.price)} sub={`${summary.latest.priceType} · ${summary.latest.date}`} strong />
                <Stat label="직전 단가" value={won(summary.prev?.price)} sub={summary.prev ? `${summary.prev.priceType} · ${summary.prev.date}` : '없음'} />
                <Stat
                  label="변동"
                  value={summary.delta == null ? '-' : `${summary.delta < 0 ? '▼' : summary.delta > 0 ? '▲' : ''} ${Math.abs(summary.delta).toLocaleString()}원`}
                  sub={summary.deltaRate == null ? summary.trend : `${summary.deltaRate}% · ${summary.trend}`}
                  tone={summary.delta == null || summary.delta === 0 ? undefined : summary.delta < 0 ? '#ef4444' : '#22c55e'}
                />
                <Stat label="참고단가 제안" value={won(summary.suggest?.price)} sub={summary.suggest?.explain ?? '자료 부족'} tone="#38bdf8" />
                <Stat
                  label="자료상태 · 경고"
                  value={summary.dataState}
                  sub={
                    summary.warn.days == null
                      ? '실제 거래 없음'
                      : `${summary.warn.label} · 최근 실거래 ${summary.warn.days}일 전`
                  }
                  small
                />
              </div>

              <div className={`${cardCls} mt-3 p-4`}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[14px] font-extrabold text-text-strong">{title} 단가 추이</div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {PERIODS.map((p) => (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => setPeriod(p.key)}
                          className={`rounded-[7px] px-2.5 py-1 text-[12px] font-bold ${
                            period === p.key ? 'bg-primary text-white' : 'border border-border text-text-sub'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <span className="flex items-center gap-1.5 text-[12px] text-text-sub">
                      <span className="h-2.5 w-2.5 rounded-full bg-accent" /> 실제
                      <span className="ml-2 h-2.5 w-2.5 rounded-full border-2 border-accent" /> 참고
                    </span>
                  </div>
                </div>
                <TrendChart points={points} />
              </div>

              <div className={`${cardCls} mt-3 p-3.5`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[14px] font-extrabold text-text-strong">
                    최근 {showAll ? totalCount : Math.min(10, totalCount)}회 이력
                  </div>
                  <div className="text-[12px] text-text-sub">
                    최근 3회 평균 {won(summary.stats.avg)} · 범위 {summary.stats.min?.toLocaleString()}~
                    {summary.stats.max?.toLocaleString()}원
                    {summary.lastRealDate && ` · 최근 실거래 ${summary.lastRealDate}`}
                    {totalCount > 10 && (
                      <button
                        type="button"
                        onClick={() => setShowAll((v) => !v)}
                        className="ml-2 font-bold text-accent underline"
                      >
                        {showAll ? '최근 10건만 보기' : `전체 ${totalCount}건 보기 ›`}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className={`${tableWrapCls} mt-3`}>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className={thCls}>적용일</th>
                      <th className={thNumCls}>단가</th>
                      <th className={thCls}>구분</th>
                      <th className={thCls}>출처</th>
                      <th className={thCls}>비고</th>
                      <th className={thCls}>&nbsp;</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) =>
                      editId === h.id ? (
                        <tr key={h.id} className={trCls}>
                          <td className={tdCls}>{h.effectiveDate}</td>
                          <td className="px-3 py-1.5">
                            <div className="ml-auto w-[110px]">
                              <NumberInput
                                value={edit.price}
                                onChange={(v) => setEdit((p) => ({ ...p, price: v }))}
                                aria-label="단가 고치기"
                              />
                            </div>
                          </td>
                          <td className={tdCls}>
                            <select
                              value={edit.priceType}
                              onChange={(e) => setEdit((p) => ({ ...p, priceType: e.target.value as '실제' | '참고' }))}
                              className={`${inputCls} h-[32px] w-[80px] text-[12.5px]`}
                              aria-label="구분 고치기"
                            >
                              <option value="실제">실제</option>
                              <option value="참고">참고</option>
                            </select>
                          </td>
                          <td className={tdCls}>{h.source}</td>
                          <td className={tdCls}>
                            <input
                              value={edit.memo}
                              onChange={(e) => setEdit((p) => ({ ...p, memo: e.target.value }))}
                              className={`${inputCls} h-[32px] text-[12.5px]`}
                              aria-label="비고 고치기"
                            />
                          </td>
                          <td className={tdCls}>
                            <span className="flex gap-1">
                              <button
                                type="button"
                                onClick={saveEdit}
                                title="저장"
                                className="rounded-[6px] border border-primary px-2 py-1 text-primary"
                              >
                                <Check size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditId('')}
                                title="취소"
                                className="rounded-[6px] border border-border px-2 py-1 text-text-sub"
                              >
                                <X size={13} />
                              </button>
                            </span>
                          </td>
                        </tr>
                      ) : (
                        <tr key={h.id} className={trCls}>
                          <td className={tdCls}>{h.effectiveDate}</td>
                          <td className={`${tdNumCls} font-bold text-text-strong`}>
                            {h.isFree ? '무상' : `${h.price.toLocaleString()}원`}
                          </td>
                          <td className={tdCls}>
                            <Badge tone={h.priceType === '실제' ? 'green' : 'slate'}>{h.priceType}</Badge>
                          </td>
                          <td className={tdCls}>{h.source}</td>
                          <td className={tdCls}>{h.memo ?? '-'}</td>
                          <td className={tdCls}>
                            <span className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => startEdit(h)}
                                title="고치기"
                                className="rounded-[6px] border border-border px-2 py-1 text-text-sub hover:text-text-strong"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeRow(h)}
                                title="지우기"
                                className="rounded-[6px] border border-border px-2 py-1 text-text-sub hover:text-danger"
                              >
                                <Trash2 size={13} />
                              </button>
                            </span>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
  strong,
  small,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
  strong?: boolean;
  small?: boolean;
}) {
  return (
    <div className={`${cardCls} p-3.5`}>
      <div className="text-[12.5px] font-semibold text-text-faint">{label}</div>
      <div
        className={`tabular mt-0.5 font-extrabold ${small ? 'text-[17px]' : 'text-[22px]'} ${strong ? 'text-text-strong' : 'text-text-mid'}`}
        style={tone ? { color: tone } : undefined}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[12px] text-text-sub">{sub}</div>}
    </div>
  );
}

// 추이 — 가벼운 선 그래프. 실제는 채운 점, 참고는 빈 점으로 그려 근거를 구분한다.
function TrendChart({ points }: { points: { date: string; price: number; priceType: string }[] }) {
  const W = 880;
  const H = 232;
  const padL = 58;
  const padR = 42;
  const padT = 14;
  const padB = 46;
  if (points.length < 2) {
    return <div className="py-12 text-center text-[13px] text-text-faint">그릴 만한 기록이 아직 적습니다.</div>;
  }
  const values = points.map((p) => p.price);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.max(max * 0.1, 10);
  const lo = min - span * 0.2;
  const hi = max + span * 0.2;
  const x = (i: number) => padL + (i * (W - padL - padR)) / (points.length - 1);
  const y = (v: number) => padT + ((hi - v) * (H - padT - padB)) / (hi - lo);
  const line = points.map((p, i) => `${x(i)},${y(p.price)}`).join(' ');
  const ticks = [0, 1, 2, 3].map((k) => lo + ((hi - lo) * k) / 3);
  // 점이 많으면 날짜를 모두 적을 수 없다. 대여섯 개만 골라 적는다.
  const step = Math.ceil(points.length / 6);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-[232px] w-full" role="img" aria-label="단가 추이">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} y1={y(t)} x2={W - padR} y2={y(t)} stroke="var(--color-border)" strokeWidth="1" />
          <text x={padL - 10} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-text-faint)">
            {Math.round(t).toLocaleString()}
          </text>
        </g>
      ))}
      <polyline points={line} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={`${p.date}-${i}`}>
          <circle
            cx={x(i)}
            cy={y(p.price)}
            r="4"
            fill={p.priceType === '실제' ? 'var(--color-accent)' : 'var(--color-card)'}
            stroke="var(--color-accent)"
            strokeWidth="2"
          />
          {(i % step === 0 || i === points.length - 1) && (
            <text x={x(i)} y={H - 18} textAnchor="middle" fontSize="10.5" fill="var(--color-text-faint)">
              {p.date.slice(5)}
            </text>
          )}
        </g>
      ))}
      <text
        x={W - padR}
        y={y(points[points.length - 1].price) - 12}
        textAnchor="end"
        fontSize="12"
        fontWeight="700"
        fill="var(--color-text-strong)"
      >
        {points[points.length - 1].price.toLocaleString()}원
      </text>
    </svg>
  );
}
