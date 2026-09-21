import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Plus, Trash2, Pencil } from 'lucide-react';
import { api } from '../api/client';
import { ExcelDownloadButton, excelSheet, conditionText } from './ExcelDownloadButton';
import { FormModal } from './FormModal';
import { SearchSelect } from './SearchSelect';
import { NumberInput } from './ui/NumberInput';
import { DateField } from './ui/DateField';
import { useProjects, useItemMasters, useCommonCodes } from '../hooks/useMasters';
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

// 이동 — 우리 물건을 다른 자리로 옮긴 기록 (리뷰회의 5-5).
// 예: 원방 ↔ 투플러스 · 원방 ↔ 크로스창고 · 원방 ↔ 도림리
// 판 것도 처리 맡긴 것도 아니라 재고 총량은 그대로다. 오간 기록만 남긴다.

export interface InventoryMove {
  id: string;
  projectId: string;
  moveDate: string;
  itemCode?: string | null;
  itemName?: string | null;
  fromPlace?: string | null;
  toPlace?: string | null;
  weight?: string | null;
  /** 자리 간 운반에 든 비용 — 운반비 관리에 자동으로 들어간다 */
  transportCost?: string | null;
  vehicleNo?: string | null;
  driverName?: string | null;
  memo?: string | null;
  project?: { roundName: string };
  item?: { itemName: string };
}

const num = (v?: string | null) => (v == null || v === '' ? 0 : Number(v));
const show = (v?: string | null) => (v == null || v === '' ? '-' : v);
const day = (v?: string | null) => (v ? v.slice(0, 10) : '-');
const labelCls = 'mb-1.5 block text-[13px] font-semibold text-text-mid';

export function InventoryMoveTab({ projectId, itemCode }: { projectId: string; itemCode: string }) {
  const { projects } = useProjects();
  const [rows, setRows] = useState<InventoryMove[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [fromPlace, setFromPlace] = useState('');
  const [toPlace, setToPlace] = useState('');
  const [editing, setEditing] = useState<InventoryMove | null>(null);
  const [open, setOpen] = useState(false);

  const { labels: places } = useCommonCodes('이동장소');

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    if (itemCode) params.set('itemCode', itemCode);
    if (fromPlace) params.set('fromPlace', fromPlace);
    if (toPlace) params.set('toPlace', toPlace);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    api.get<InventoryMove[]>(`/api/inventory-moves?${params.toString()}`).then(setRows);
  }, [projectId, itemCode, fromPlace, toPlace, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  // 어느 자리에서 어느 자리로 얼마나 갔는지 — 쌍으로 묶어 본다.
  const pairs = useMemo(() => {
    const map = new Map<string, { pair: string; weight: number; count: number }>();
    for (const r of rows) {
      const pair = `${r.fromPlace ?? '-'} → ${r.toPlace ?? '-'}`;
      const cur = map.get(pair) ?? { pair, weight: 0, count: 0 };
      cur.weight += num(r.weight);
      cur.count += 1;
      map.set(pair, cur);
    }
    return [...map.values()].sort((a, b) => b.weight - a.weight);
  }, [rows]);

  const total = rows.reduce((s, r) => s + num(r.weight), 0);
  const totalCost = rows.reduce((s, r) => s + num(r.transportCost), 0);

  const remove = async (row: InventoryMove) => {
    if (!window.confirm(`${day(row.moveDate)} ${row.fromPlace ?? ''} → ${row.toPlace ?? ''} 이동 기록을 지울까요?`)) return;
    await api.del(`/api/inventory-moves/${row.id}`);
    load();
  };

  return (
    <div>
      <div className={`${cardCls} mb-3 grid items-center gap-2 px-3 py-2.5`} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <div className="flex min-w-0 items-center gap-1" style={{ gridColumn: 'span 2' }}>
          <DateField value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} w-full min-w-0 px-2`} />
          <span className="shrink-0 text-text-faint">~</span>
          <DateField value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} w-full min-w-0 px-2`} />
        </div>
        <SearchSelect
          ariaLabel="출발지"
          options={places.map((p) => ({ value: p, label: p }))}
          value={fromPlace}
          onChange={setFromPlace}
          placeholder="출발지"
          allowFree
        />
        <SearchSelect
          ariaLabel="도착지"
          options={places.map((p) => ({ value: p, label: p }))}
          value={toPlace}
          onChange={setToPlace}
          placeholder="도착지"
          allowFree
        />
        {(from || to || fromPlace || toPlace) && (
          <button
            type="button"
            onClick={() => {
              setFrom('');
              setTo('');
              setFromPlace('');
              setToPlace('');
            }}
            className={`${outlineBtnCls} h-[38px] justify-center px-2`}
          >
            초기화
          </button>
        )}
        <div className="flex items-center justify-end gap-2">
          <ExcelDownloadButton
            fileName="이동현황"
            conditions={conditionText([
              ['기간', from || to ? `${from || ''}~${to || ''}` : ''],
              ['출발지', fromPlace],
              ['도착지', toPlace],
            ])}
            sheets={[
              excelSheet('이동현황', rows, [
                { header: '이동일', value: (r) => day(r.moveDate), width: 12 },
                { header: '프로젝트', value: (r) => r.project?.roundName, width: 22 },
                { header: '품목', value: (r) => r.item?.itemName ?? r.itemName, width: 16 },
                { header: '출발지', value: (r) => r.fromPlace, width: 14 },
                { header: '도착지', value: (r) => r.toPlace, width: 14 },
                { header: '중량(kg)', value: (r) => num(r.weight), width: 12 },
                { header: '운반비(원)', value: (r) => num(r.transportCost), width: 12 },
                { header: '차량번호', value: (r) => r.vehicleNo, width: 12 },
                { header: '운전자', value: (r) => r.driverName, width: 10 },
                { header: '비고', value: (r) => r.memo, width: 24 },
              ]),
            ]}
          />
          <button type="button" onClick={() => { setEditing(null); setOpen(true); }} className={primaryBtnCls}>
            <Plus size={15} /> 이동 등록
          </button>
        </div>
      </div>

      {pairs.length > 0 && (
        <div className="mb-3 rounded-[12px] border border-border bg-card px-4 py-3">
          <div className="mb-2 text-[12.5px] font-semibold text-text-faint">오간 자리별 합계</div>
          <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2 xl:grid-cols-4">
            {pairs.map((p) => (
              <div key={p.pair} className="flex items-center justify-between gap-2 border-b border-border py-1">
                <span className="min-w-0 truncate text-[13px] text-text">{p.pair}</span>
                <span className="tabular shrink-0 text-[13px] font-semibold text-text-strong">
                  {formatNumber(p.weight)}kg
                  <span className="ml-2 font-normal text-text-sub">{p.count}건</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={tableWrapCls}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-border">
              <th className={thCls}>이동일</th>
              <th className={thCls}>프로젝트</th>
              <th className={thCls}>품목</th>
              <th className={thCls}>출발지</th>
              <th className={thCls}>도착지</th>
              <th className={thNumCls}>중량(kg)</th>
              <th className={thNumCls}>운반비(원)</th>
              <th className={thCls}>차량번호</th>
              <th className={thCls}>운전자</th>
              <th className={thCls}>비고</th>
              <th className={thCls}>관리</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={trCls}>
                <td className={`${tdCls} tabular whitespace-nowrap`}>{day(r.moveDate)}</td>
                <td className={tdCls}>{show(r.project?.roundName)}</td>
                <td className={tdCls}>{show(r.item?.itemName ?? r.itemName)}</td>
                <td className={`${tdCls} whitespace-nowrap`}>{show(r.fromPlace)}</td>
                <td className={`${tdCls} whitespace-nowrap`}>{show(r.toPlace)}</td>
                <td className={tdNumCls}>{formatNumber(num(r.weight))}</td>
                <td className={tdNumCls}>{r.transportCost ? formatNumber(num(r.transportCost)) : '-'}</td>
                <td className={`${tdCls} whitespace-nowrap`}>{show(r.vehicleNo)}</td>
                <td className={tdCls}>{show(r.driverName)}</td>
                <td className={tdCls}>{show(r.memo)}</td>
                <td className={tdCls}>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      title="수정"
                      onClick={() => { setEditing(r); setOpen(true); }}
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
                <td colSpan={11} className="py-10 text-center text-[13px] text-text-faint">
                  이동 기록이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-border">
                <td className={`${tdCls} font-bold text-text-strong`} colSpan={5}>
                  합계 {rows.length}건
                </td>
                <td className={`${tdNumCls} font-bold text-text-strong`}>{formatNumber(total)}</td>
                <td className={`${tdNumCls} font-bold text-text-strong`}>{formatNumber(totalCost)}</td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="mt-2 text-[12px] text-text-faint">
        이동은 우리 물건을 다른 자리로 옮긴 기록입니다. 판 것도 처리 맡긴 것도 아니라 재고 총량은 바뀌지 않습니다.
        통합 원장 조회에서도 「이동」 유형으로 함께 볼 수 있습니다.
      </p>

      {open && (
        <FormModal
          title={editing ? '이동 수정' : '이동 등록'}
          icon={ArrowLeftRight}
          onClose={() => {
            setOpen(false);
            setEditing(null);
          }}
        >
          <MoveForm
            projects={projects}
            places={places}
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

function MoveForm({
  projects,
  places,
  defaultProjectId,
  record,
  onDone,
  onCancel,
}: {
  projects: { id: string; roundName: string }[];
  places: string[];
  defaultProjectId: string;
  record: InventoryMove | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { items } = useItemMasters();
  const [f, setF] = useState({
    projectId: record?.projectId ?? defaultProjectId ?? '',
    moveDate: record?.moveDate ? record.moveDate.slice(0, 10) : kstToday(),
    itemCode: record?.itemCode ?? '',
    fromPlace: record?.fromPlace ?? '',
    toPlace: record?.toPlace ?? '',
    weight: record?.weight ? String(Number(record.weight)) : '',
    transportCost: record?.transportCost ? String(Number(record.transportCost)) : '',
    vehicleNo: record?.vehicleNo ?? '',
    driverName: record?.driverName ?? '',
    memo: record?.memo ?? '',
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
    if (f.fromPlace && f.toPlace && f.fromPlace === f.toPlace) {
      setError('출발지와 도착지가 같습니다.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const payload = {
        projectId: f.projectId,
        moveDate: f.moveDate,
        itemCode: f.itemCode || undefined,
        itemName: items.find((i) => i.itemCode === f.itemCode)?.itemName,
        fromPlace: f.fromPlace || undefined,
        toPlace: f.toPlace || undefined,
        weight: f.weight ? Number(f.weight) : 0,
        transportCost: f.transportCost ? Number(f.transportCost) : undefined,
        vehicleNo: f.vehicleNo || undefined,
        driverName: f.driverName || undefined,
        memo: f.memo || undefined,
      };
      if (record) await api.patch(`/api/inventory-moves/${record.id}`, payload);
      else await api.post('/api/inventory-moves', payload);
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
          <label className={labelCls}>이동일</label>
          <DateField value={f.moveDate} onChange={(e) => set({ moveDate: e.target.value })} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>출발지</label>
          <SearchSelect
            ariaLabel="출발지"
            options={places.map((p) => ({ value: p, label: p }))}
            value={f.fromPlace}
            onChange={(v) => set({ fromPlace: v })}
            placeholder="검색 또는 직접 입력"
            allowFree
          />
        </div>

        <div>
          <label className={labelCls}>도착지</label>
          <SearchSelect
            ariaLabel="도착지"
            options={places.map((p) => ({ value: p, label: p }))}
            value={f.toPlace}
            onChange={(v) => set({ toPlace: v })}
            placeholder="검색 또는 직접 입력"
            allowFree
          />
        </div>

        <div>
          <label className={labelCls}>품목</label>
          <SearchSelect
            ariaLabel="품목"
            options={items.map((i) => ({ value: i.itemCode, label: i.itemName }))}
            value={f.itemCode}
            onChange={(v) => set({ itemCode: v })}
            placeholder="검색"
          />
        </div>

        <div>
          <label className={labelCls}>중량(kg)</label>
          <NumberInput value={f.weight} onChange={(v) => set({ weight: v })} decimals={3} />
        </div>

        <div>
          <label className={labelCls}>운반비(원)</label>
          <NumberInput value={f.transportCost} onChange={(v) => set({ transportCost: v })} />
          <p className="mt-1 text-[12px] text-text-faint">적으면 운반비 관리에 자동으로 들어갑니다</p>
        </div>

        <div>
          <label className={labelCls}>차량번호</label>
          <input value={f.vehicleNo} onChange={(e) => set({ vehicleNo: e.target.value })} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>운전자</label>
          <input value={f.driverName} onChange={(e) => set({ driverName: e.target.value })} className={inputCls} />
        </div>

        <div className="col-span-3">
          <label className={labelCls}>비고</label>
          <input value={f.memo} onChange={(e) => set({ memo: e.target.value })} className={inputCls} />
        </div>
      </div>

      {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}

      <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
        <button type="button" onClick={onCancel} className={outlineBtnCls}>
          취소
        </button>
        <button type="submit" disabled={busy} className={primaryBtnCls}>
          {busy ? '저장 중...' : record ? '수정' : '등록'}
        </button>
      </div>
    </form>
  );
}
