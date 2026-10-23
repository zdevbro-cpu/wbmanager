import { useCallback, useEffect, useMemo, useState } from 'react';
import { Scale, Plus, Trash2, Pencil } from 'lucide-react';
import { api } from '../api/client';
import { ExcelDownloadButton, excelSheet, conditionText } from './ExcelDownloadButton';
import { FormModal } from './FormModal';
import { SearchSelect } from './SearchSelect';
import { NumberInput } from './ui/NumberInput';
import { DateField } from './ui/DateField';
import { useProjects, useItemMasters } from '../hooks/useMasters';
import { formatNumber } from '../lib/number';
import { kstToday } from '../lib/datetime';
import {
  cardCls,
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
} from './ui/classes';

// 보정 — 계근 차이·자연 감소로 재고가 맞지 않을 때, 또는 현금 출고처럼 정식 거래가
// 아닌 것을 덜어 낼 때 쓴다 (회의 2026-10-14 3번).
//
// 금액 칸이 없다. 수량만 맞추고 매입·매출은 건드리지 않으므로 손익보고서의 숫자는
// 보정을 해도 달라지지 않는다 (회신 2026-10-23 결정-6).

export interface InventoryAdjust {
  id: string;
  projectId: string;
  itemCode: string;
  adjustDate: string;
  /** 보정(중량 오차) / 별도출고(현금 출고 등) */
  kind: string;
  /** IN = 재고를 더함 / OUT = 재고에서 뺌 */
  direction: 'IN' | 'OUT';
  weight: string;
  reason?: string | null;
  project?: { roundName: string };
  item?: { itemName: string };
}

const KINDS = ['보정', '별도출고'] as const;

const num = (v?: string | null) => (v == null || v === '' ? 0 : Number(v));
const show = (v?: string | null) => (v == null || v === '' ? '-' : v);
const day = (v?: string | null) => (v ? v.slice(0, 10) : '-');
const labelCls = 'mb-1.5 block text-[13px] font-semibold text-text-mid';
/** 뺀 것은 음수로 보여 재고가 준 것을 한눈에 알게 한다. */
const signed = (r: InventoryAdjust) => (r.direction === 'OUT' ? -num(r.weight) : num(r.weight));

export function InventoryAdjustTab({ projectId, itemCode }: { projectId: string; itemCode: string }) {
  const { projects } = useProjects();
  const [rows, setRows] = useState<InventoryAdjust[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [kind, setKind] = useState('');
  const [editing, setEditing] = useState<InventoryAdjust | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    if (itemCode) params.set('itemCode', itemCode);
    if (kind) params.set('kind', kind);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    api.get<InventoryAdjust[]>(`/api/inventory-adjusts?${params.toString()}`).then(setRows);
  }, [projectId, itemCode, kind, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  // 더한 것과 뺀 것을 갈라 보여 준다 — 재고가 얼마나 움직였는지가 한 줄로 보인다.
  const sums = useMemo(() => {
    let plus = 0;
    let minus = 0;
    for (const r of rows) {
      if (r.direction === 'IN') plus += num(r.weight);
      else minus += num(r.weight);
    }
    return { plus, minus, net: plus - minus };
  }, [rows]);

  const remove = async (row: InventoryAdjust) => {
    if (!window.confirm(`${day(row.adjustDate)} ${row.kind} ${formatNumber(num(row.weight))}kg 기록을 지울까요?\n지우면 재고가 보정 전으로 돌아갑니다.`)) return;
    await api.del(`/api/inventory-adjusts/${row.id}`);
    load();
  };

  return (
    <div>
      <div
        className={`${cardCls} mb-3 grid items-center gap-2 px-3 py-2.5`}
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}
      >
        <div className="flex min-w-0 items-center gap-1" style={{ gridColumn: 'span 2' }}>
          <DateField value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} w-full min-w-0 px-2`} />
          <span className="shrink-0 text-text-faint">~</span>
          <DateField value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} w-full min-w-0 px-2`} />
        </div>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={`${inputCls} px-2`}>
          <option value="">구분 전체</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        {(from || to || kind) && (
          <button
            type="button"
            onClick={() => {
              setFrom('');
              setTo('');
              setKind('');
            }}
            className={`${outlineBtnCls} h-[38px] justify-center px-2`}
          >
            초기화
          </button>
        )}
        <div className="flex items-center justify-end gap-2">
          <ExcelDownloadButton
            fileName="재고보정"
            conditions={conditionText([
              ['기간', from || to ? `${from || ''}~${to || ''}` : ''],
              ['구분', kind],
            ])}
            sheets={[
              excelSheet('재고보정', rows, [
                { header: '날짜', value: (r) => day(r.adjustDate), width: 12 },
                { header: '프로젝트', value: (r) => r.project?.roundName, width: 22 },
                { header: '품목', value: (r) => r.item?.itemName, width: 16 },
                { header: '구분', value: (r) => r.kind, width: 10 },
                { header: '증감', value: (r) => (r.direction === 'IN' ? '더함' : '뺌'), width: 8 },
                { header: '중량(kg)', value: (r) => signed(r), width: 12 },
                { header: '사유', value: (r) => r.reason, width: 30 },
              ]),
            ]}
          />
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
            className={primaryBtnCls}
          >
            <Plus size={15} /> 보정 등록
          </button>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="mb-3 rounded-[12px] border border-border bg-card px-4 py-3">
          <div className="mb-2 text-[12.5px] font-semibold text-text-faint">거른 기간의 보정 합계</div>
          <div className="grid grid-cols-1 gap-x-6 md:grid-cols-3">
            <div className="flex items-center justify-between gap-2 border-b border-border py-1">
              <span className="text-[13px] text-text">더한 것</span>
              <span className="tabular text-[13px] font-semibold text-text-strong">+{formatNumber(sums.plus)}kg</span>
            </div>
            <div className="flex items-center justify-between gap-2 border-b border-border py-1">
              <span className="text-[13px] text-text">뺀 것</span>
              <span className="tabular text-[13px] font-semibold text-text-strong">-{formatNumber(sums.minus)}kg</span>
            </div>
            <div className="flex items-center justify-between gap-2 border-b border-border py-1">
              <span className="text-[13px] text-text">재고 증감</span>
              <span className="tabular text-[13px] font-bold text-text-strong">
                {sums.net > 0 ? '+' : ''}
                {formatNumber(sums.net)}kg
              </span>
            </div>
          </div>
        </div>
      )}

      <div className={tableWrapCls}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-border">
              <th className={thCls}>날짜</th>
              <th className={thCls}>프로젝트</th>
              <th className={thCls}>품목</th>
              <th className={thCls}>구분</th>
              <th className={thNumCls}>중량(kg)</th>
              <th className={thCls}>사유</th>
              <th className={thCls}>관리</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={trCls}>
                <td className={`${tdCls} tabular whitespace-nowrap`}>{day(r.adjustDate)}</td>
                <td className={tdCls}>{show(r.project?.roundName)}</td>
                <td className={tdCls}>{show(r.item?.itemName)}</td>
                <td className={`${tdCls} whitespace-nowrap`}>{r.kind}</td>
                <td className={`${tdNumCls} ${r.direction === 'OUT' ? 'text-danger' : 'text-success'}`}>
                  {signed(r) > 0 ? '+' : ''}
                  {formatNumber(signed(r))}
                </td>
                <td className={tdCls}>{show(r.reason)}</td>
                <td className={tdCls}>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      title="수정"
                      onClick={() => {
                        setEditing(r);
                        setOpen(true);
                      }}
                      className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-primary"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      title="삭제"
                      onClick={() => remove(r)}
                      className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-[13px] text-text-faint">
                  보정 기록이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-border">
                <td className={`${tdCls} font-bold text-text-strong`} colSpan={4}>
                  합계 {rows.length}건
                </td>
                <td className={`${tdNumCls} font-bold text-text-strong`}>
                  {sums.net > 0 ? '+' : ''}
                  {formatNumber(sums.net)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="mt-2 text-[12px] leading-relaxed text-text-faint">
        보정은 재고 수량만 맞춥니다. 매입·매출 금액은 건드리지 않으므로 손익보고서의 숫자는 달라지지 않습니다. 통합 원장
        조회에서 「보정」 유형으로 함께 볼 수 있고, 지우면 재고가 보정 전으로 돌아갑니다.
      </p>

      {open && (
        <FormModal
          title={editing ? '보정 수정' : '보정 등록'}
          icon={Scale}
          onClose={() => {
            setOpen(false);
            setEditing(null);
          }}
        >
          <AdjustForm
            projects={projects}
            defaultProjectId={projectId}
            record={editing}
            onDone={() => {
              setOpen(false);
              setEditing(null);
              load();
            }}
            onCancel={() => {
              setOpen(false);
              setEditing(null);
            }}
          />
        </FormModal>
      )}
    </div>
  );
}

function AdjustForm({
  projects,
  defaultProjectId,
  record,
  onDone,
  onCancel,
}: {
  projects: { id: string; roundName: string }[];
  defaultProjectId: string;
  record: InventoryAdjust | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { items } = useItemMasters();
  const [f, setF] = useState({
    projectId: record?.projectId ?? defaultProjectId ?? '',
    adjustDate: record?.adjustDate ? record.adjustDate.slice(0, 10) : kstToday(),
    itemCode: record?.itemCode ?? '',
    kind: record?.kind ?? '보정',
    direction: record?.direction ?? ('OUT' as 'IN' | 'OUT'),
    weight: record?.weight ? String(Number(record.weight)) : '',
    reason: record?.reason ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.projectId) {
      setError('프로젝트를 고르세요.');
      return;
    }
    if (!f.weight || Number(f.weight) <= 0) {
      setError('중량은 0보다 큰 값으로 적으세요. 더할지 뺄지는 아래에서 고릅니다.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const payload = {
        projectId: f.projectId,
        adjustDate: f.adjustDate,
        itemCode: f.itemCode || undefined,
        kind: f.kind,
        direction: f.direction,
        weight: Number(f.weight),
        reason: f.reason || undefined,
      };
      if (record) await api.patch(`/api/inventory-adjusts/${record.id}`, payload);
      else await api.post('/api/inventory-adjusts', payload);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={cardPadCls}>
      <div className="grid grid-cols-3 gap-x-3 gap-y-3.5">
        <div className="col-span-2">
          <label className={labelCls}>프로젝트</label>
          <SearchSelect
            ariaLabel="프로젝트"
            options={projects.map((p) => ({ value: p.id, label: p.roundName }))}
            value={f.projectId}
            onChange={(v) => set({ projectId: v })}
          />
        </div>

        <div>
          <label className={labelCls}>날짜</label>
          <DateField value={f.adjustDate} onChange={(e) => set({ adjustDate: e.target.value })} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>품목</label>
          <SearchSelect
            ariaLabel="품목"
            options={items.map((i) => ({ value: i.itemCode, label: i.itemName }))}
            value={f.itemCode}
            onChange={(v) => set({ itemCode: v })}
            placeholder="비우면 미분류"
          />
        </div>

        <div>
          <label className={labelCls}>구분</label>
          <select value={f.kind} onChange={(e) => set({ kind: e.target.value })} className={`${inputCls} px-2`}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>재고를</label>
          <select
            value={f.direction}
            onChange={(e) => set({ direction: e.target.value as 'IN' | 'OUT' })}
            className={`${inputCls} px-2`}
          >
            <option value="OUT">뺍니다 (−)</option>
            <option value="IN">더합니다 (+)</option>
          </select>
        </div>

        <div>
          <label className={labelCls}>중량(kg)</label>
          <NumberInput value={f.weight} onChange={(v) => set({ weight: v })} className={inputCls} />
        </div>

        <div className="col-span-3">
          <label className={labelCls}>사유</label>
          <input
            value={f.reason}
            onChange={(e) => set({ reason: e.target.value })}
            placeholder="예: 입고 1t → 출고 900kg, 차이 100kg 보정"
            className={inputCls}
          />
        </div>
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-text-faint">
        금액은 적지 않습니다. 이 기록은 재고 수량만 맞추고 매입·매출에는 들어가지 않습니다. 현금 출고처럼 정식 출고가
        아닌 것은 구분을 「별도출고」로 두면 나중에 가려 볼 수 있습니다.
      </p>

      {error && <p className="mt-3 text-[13px] font-semibold text-danger">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={outlineBtnCls}>
          취소
        </button>
        <button type="submit" disabled={busy} className={primaryBtnCls}>
          {busy ? '저장 중...' : '저장'}
        </button>
      </div>
    </form>
  );
}
