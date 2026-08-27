import { useEffect, useState, type ReactNode } from 'react';
import { Boxes, X } from 'lucide-react';
import { api } from '../api/client';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { SearchSelect } from '../components/SearchSelect';
import { useProjects, useItemMasters } from '../hooks/useMasters';
import { NumberInput } from '../components/ui/NumberInput';
import { formatNumber } from '../lib/number';
import { kstToday } from '../lib/datetime';
import { pageTitleCls, primaryBtnCls, inputCls, tableWrapCls, thCls,
  thNumCls,
  tdNumCls, tdCls, trCls } from '../components/ui/classes';
import type { InventoryValuation, InventoryValuationRow, LedgerEntry } from '../types';
import { DateField } from '../components/ui/DateField';

const SOURCE_LABEL: Record<string, string> = { project: '프로젝트전용', global: '전체적용', base: '기준단가' };

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
  const [itemCode, setItemCode] = useState('');
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

  // 같은 현장은 붙여 놓는다 — 현장이 흩어져 있으면 한 현장의 재고를 눈으로 모아야 한다.
  const rows = (valuation?.rows ?? [])
    .filter((r) => !itemCode || r.itemCode === itemCode)
    .sort(
      (a, b) =>
        (a.projectName ?? '').localeCompare(b.projectName ?? '') ||
        (a.itemName ?? '').localeCompare(b.itemName ?? ''),
    );

  // 현장이 바뀌는 첫 줄에만 이름을 적고, 그 현장이 몇 줄인지 세어 칸을 합친다.
  const groupSize = new Map<string, number>();
  for (const r of rows) groupSize.set(r.projectId, (groupSize.get(r.projectId) ?? 0) + 1);

  const totals = rows.reduce(
    (acc, r) => ({
      inWeight: acc.inWeight + r.inWeight,
      outWeight: acc.outWeight + r.outWeight,
      valuationAmount: acc.valuationAmount + r.valuationAmount,
    }),
    { inWeight: 0, outWeight: 0, valuationAmount: 0 },
  );

  // 품목을 고르면 합계도 그 품목만 반영한다.
  const totalValuation = itemCode ? totals.valuationAmount : (valuation?.totalValuation ?? 0);

  // 같은 품목이 여러 프로젝트에 흩어져 있으므로 품목코드로 합산한다.
  const itemTotals = Object.values(
    rows.reduce<Record<string, { itemCode: string; itemName: string; inWeight: number; outWeight: number; remaining: number }>>(
      (acc, r) => {
        const cur = acc[r.itemCode] ?? { itemCode: r.itemCode, itemName: r.itemName, inWeight: 0, outWeight: 0, remaining: 0 };
        cur.inWeight += r.inWeight;
        cur.outWeight += r.outWeight;
        cur.remaining += r.remaining;
        acc[r.itemCode] = cur;
        return acc;
      },
      {},
    ),
  ).sort((a, b) => b.inWeight - a.inWeight);

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

      {valuation && (
        <>
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryCard label="총 입고" value={`${formatNumber(totals.inWeight)}kg`} />
            <SummaryCard label="총 출고" value={`${formatNumber(totals.outWeight)}kg`} />
            <SummaryCard label="재고평가 합계" value={`${formatNumber(totalValuation)}원`} highlight />
          </div>

          <div className="mb-4 rounded-[12px] border border-border bg-card px-4 py-3">
            <div className="mb-2 text-[12.5px] font-semibold text-text-faint">품목별 입출고량</div>
            {itemTotals.length === 0 ? (
              <div className="py-2 text-[13px] text-text-faint">품목 데이터가 없습니다.</div>
            ) : (
              <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2 xl:grid-cols-4">
                {itemTotals.map((i) => (
                  <div
                    key={i.itemCode}
                    className="flex items-center justify-between gap-4 border-b border-border/60 py-1.5 text-[13px] last:border-b-0"
                  >
                    <span className="truncate text-text-sub">{i.itemName}</span>
                    <span className="tabular whitespace-nowrap">
                      <span className="font-bold text-success">입 {formatNumber(i.inWeight)}</span>
                      <span className="mx-1.5 text-text-faint">/</span>
                      <span className="font-bold text-danger">출 {formatNumber(i.outWeight)}</span>
                      <span className="mx-1.5 text-text-faint">/</span>
                      <span className="font-bold text-text-strong">잔 {formatNumber(i.remaining)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <PriceRegisterForm items={items} projects={projects} onRegistered={search} />

      <div className="mb-5 flex w-full items-center gap-2 rounded-[12px] border border-border bg-card px-4 py-2.5">
        <span className="mr-1 whitespace-nowrap text-[13px] font-extrabold text-text-strong">검색</span>
        <div className="w-[200px] shrink-0">
          <SearchSelect
            ariaLabel="프로젝트"
            options={projects.map((p) => ({ value: p.id, label: p.roundName }))}
            value={projectId}
            onChange={setProjectId}
            placeholder="전체 프로젝트"
          />
        </div>
        <div className="w-[160px] shrink-0">
          <SearchSelect
            ariaLabel="품목"
            options={items.map((i) => ({ value: i.itemCode, label: i.itemName }))}
            value={itemCode}
            onChange={setItemCode}
            placeholder="전체 품목"
          />
        </div>
      </div>

      {valuation && (
        <>
          <div className={`${tableWrapCls} mb-8`}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-y border-border">
                  <th className={thCls}>프로젝트</th>
                  <th className={thCls}>품목</th>
                  <th className={thNumCls}>입고합계</th>
                  <th className={thNumCls}>출고합계</th>
                  <th className={thNumCls}>잔량</th>
                  <th className={thNumCls}>적용단가</th>
                  <th className={thCls}>단가출처</th>
                  <th className={thNumCls}>평가금액</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const first = i === 0 || rows[i - 1].projectId !== r.projectId;
                  return (
                  <tr
                    key={`${r.projectId}-${r.itemCode}`}
                    onClick={() => openDrilldown(r)}
                    className={`${trCls} cursor-pointer ${first && i > 0 ? 'border-t-2 border-border' : ''}`}
                  >
                    {first && (
                      <td className={`${tdCls} align-top font-semibold text-text-strong`} rowSpan={groupSize.get(r.projectId)}>
                        {r.projectName}
                      </td>
                    )}
                    <td className={tdCls}>{r.itemName}</td>
                    <td className={tdNumCls}>{formatNumber(r.inWeight)}</td>
                    <td className={tdNumCls}>{formatNumber(r.outWeight)}</td>
                    <td className={`${tdNumCls} font-bold text-text-strong`}>{formatNumber(r.remaining)}</td>
                    <td className={tdNumCls}>{formatNumber(r.unitPrice)}</td>
                    <td className={tdCls}>{SOURCE_LABEL[r.priceSource]}</td>
                    <td className={tdNumCls}>{formatNumber(r.valuationAmount)}</td>
                  </tr>
                  );
                })}
                {rows.length === 0 && (
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

      {drilldown && (
        <DrilldownPanel onClose={() => setDrilldown(null)}>
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
            <table className="w-max min-w-full border-collapse">
              <thead>
                <tr className="border-y border-border">
                  <th className={`${thCls} whitespace-nowrap`}>일자</th>
                  <th className={`${thCls} whitespace-nowrap`}>구분</th>
                  <th className={`${thCls} whitespace-nowrap`}>상/하차지</th>
                  <th className={`${thCls} whitespace-nowrap`}>거래처</th>
                  <th className={`${thCls} whitespace-nowrap`}>차종</th>
                  <th className={`${thCls} whitespace-nowrap`}>차량번호</th>
                  <th className={`${thCls} whitespace-nowrap`}>운전자</th>
                  <th className={`${thCls} whitespace-nowrap`}>연락처</th>
                  <th className={`${thNumCls} whitespace-nowrap`}>총중량</th>
                  <th className={`${thNumCls} whitespace-nowrap`}>공차중량</th>
                  <th className={`${thNumCls} whitespace-nowrap`}>감량</th>
                  <th className={`${thNumCls} whitespace-nowrap`}>반영중량</th>
                  <th className={`${thCls} whitespace-nowrap`}>비고</th>
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
                      <td className={`${tdCls} whitespace-nowrap`}>{d?.place ?? '-'}</td>
                      <td className={`${tdCls} whitespace-nowrap`}>{d?.counterparty ?? '-'}</td>
                      <td className={`${tdCls} whitespace-nowrap`}>{d?.vehicleType ?? '-'}</td>
                      <td className={`${tdCls} whitespace-nowrap`}>{d?.vehicleNo ?? '-'}</td>
                      <td className={`${tdCls} whitespace-nowrap`}>{d?.driverName ?? '-'}</td>
                      <td className={`${tdCls} whitespace-nowrap`}>{d?.driverPhone ?? '-'}</td>
                      <td className={tdNumCls}>{formatNumber(d?.grossWeight)}</td>
                      <td className={tdNumCls}>{formatNumber(d?.tareWeight)}</td>
                      <td className={tdNumCls}>{formatNumber(d?.lossWeight)}</td>
                      <td className={`${tdNumCls} font-bold text-text-strong`}>{formatNumber(e.weight)}</td>
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
        </DrilldownPanel>
      )}
    </div>
  );
}

function SummaryCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-[12px] border bg-card px-4 py-3 ${highlight ? 'border-primary' : 'border-border'}`}>
      <div className="text-[12.5px] font-semibold text-text-faint">{label}</div>
      <div className="tabular text-[22px] font-extrabold text-text-strong">{value}</div>
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
  // 적용일은 오늘로 채워 둔다. 비어 있으면 등록이 조용히 막혀 아무 일도 없는 것처럼 보였다.
  const [effectiveDate, setEffectiveDate] = useState(kstToday());
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // 무엇이 모자란지 말해 준다. 말없이 끝내면 고장 난 것과 구별되지 않는다.
    if (!itemCode) return setNote({ tone: 'bad', text: '품목을 고르세요.' });
    if (!price) return setNote({ tone: 'bad', text: '단가를 적으세요.' });
    if (!effectiveDate) return setNote({ tone: 'bad', text: '적용일을 고르세요.' });

    setNote(null);
    setBusy(true);
    try {
      await api.post('/api/inventory/prices', {
        itemCode,
        price: Number(price),
        projectId: projectId || undefined,
        effectiveDate,
      });
      const name = items.find((i) => i.itemCode === itemCode)?.itemName ?? itemCode;
      setNote({ tone: 'ok', text: `${name} ${formatNumber(price)}원 · ${effectiveDate}부터 적용으로 등록했습니다.` });
      setPrice('');
      onRegistered();
    } catch (err) {
      setNote({ tone: 'bad', text: err instanceof Error ? err.message : '등록하지 못했습니다.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-3 flex w-full items-center gap-2 rounded-[12px] border border-border bg-card px-4 py-2.5"
    >
      <span className="mr-1 whitespace-nowrap text-[13px] font-extrabold text-text-strong">품목 추정단가 등록</span>
      {/* 칸마다 필요한 폭이 다르다 — 이름은 길고, 단가와 날짜는 자릿수가 정해져 있다.
          날짜칸은 감싼 상자에 폭을 줘야 한다. 안쪽 입력에만 주면 상자가 눌려 글자가 잘린다. */}
      <select
        value={itemCode}
        onChange={(e) => setItemCode(e.target.value)}
        className={`${inputCls} min-w-[150px] flex-1`}
      >
        <option value="">품목 선택</option>
        {items.map((i) => (
          <option key={i.itemCode} value={i.itemCode}>
            {i.itemName}
          </option>
        ))}
      </select>
      <div className="w-[130px] shrink-0">
        <NumberInput placeholder="단가" value={price} onChange={setPrice} className={`${inputCls} tabular text-right`} />
      </div>
      <select
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        className={`${inputCls} min-w-[170px] flex-1`}
      >
        <option value="">전체 적용</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.roundName}만 적용
          </option>
        ))}
      </select>
      <div className="w-[150px] shrink-0">
        <DateField value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
      </div>
      <button type="submit" disabled={busy} className={`${primaryBtnCls} shrink-0 whitespace-nowrap`}>
        {busy ? '등록 중...' : '등록'}
      </button>
      {note && (
        <span
          title={note.text}
          className={`min-w-0 flex-1 truncate text-[12.5px] ${note.tone === 'ok' ? 'text-success' : 'text-danger'}`}
        >
          {note.text}
        </span>
      )}
    </form>
  );
}

// 재고 상세 — ESC나 바깥 클릭으로도 닫힌다. 화면을 덮는 층이 있어야 바깥 클릭을 받을 수 있다.
function DrilldownPanel({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEscapeClose(onClose);

  return (
    <div className="fixed inset-0 z-30" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute top-0 right-0 h-screen w-[min(1320px,96vw)] overflow-y-auto border-l border-border bg-card p-5 shadow-[-8px_0_24px_rgba(0,0,0,0.35)]"
      >
        {children}
      </div>
    </div>
  );
}
