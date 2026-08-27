import { useCallback, useEffect, useMemo, useState } from 'react';
import { Truck, Plus, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { useProjects, useVehicles, useCommonCodes, useItemMasters } from '../hooks/useMasters';
import { FormModal } from '../components/FormModal';
import { FilterField } from '../components/FilterField';
import { SearchSelect } from '../components/SearchSelect';
import { NumberInput } from '../components/ui/NumberInput';
import { DateField } from '../components/ui/DateField';
import { formatNumber } from '../lib/number';
import { kstToday } from '../lib/datetime';
import {
  pageTitleCls,
  cardCls,
  cardPadCls,
  primaryBtnCls,
  outlineBtnCls,
  tableWrapCls,
  thCls,
  thNumCls,
  tdCls,
  tdNumCls,
  trCls,
} from '../components/ui/classes';
import type { Project } from '../types';

interface Transport {
  id: string;
  projectId: string;
  transportDate: string;
  vehicleNo?: string | null;
  vehicleType?: string | null;
  origin?: string | null;
  destination?: string | null;
  weight?: string | null;
  itemCode?: string | null;
  itemName?: string | null;
  unitPrice?: string | null;
  supplyAmount?: string | null;
  taxAmount?: string | null;
}

const labelCls = 'mb-1.5 block text-[13px] font-semibold text-text-mid';
const show = (v?: string | null) => (v == null || v === '' ? '-' : v);
const num = (v?: string | null) => (v == null ? 0 : Number(v));
const day = (v?: string | null) => (v ? v.slice(0, 10) : '-');

// 운반비 관리 — 손익보고서의 운반비는 여기 등록된 금액(공급가액 + 세액)을 합산한다.
export function TransportCostPage() {
  const { projects } = useProjects();
  const [rows, setRows] = useState<Transport[]>([]);
  const [projectId, setProjectId] = useState('');
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    api.get<Transport[]>(`/api/transports?${params.toString()}`).then(setRows);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (row: Transport) => {
    if (!window.confirm(`${day(row.transportDate)} 운반비 건을 삭제할까요?`)) return;
    await api.del(`/api/transports/${row.id}`);
    load();
  };

  const total = useMemo(
    () => rows.reduce((sum, r) => sum + num(r.supplyAmount) + num(r.taxAmount), 0),
    [rows],
  );
  const projectName = (id: string) => projects.find((p) => p.id === id)?.roundName ?? '-';

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <Truck size={20} className="text-primary" />
        <h1 className={pageTitleCls}>운반비 관리</h1>
        <span className="ml-1 text-[13px] text-text-sub">
          {rows.length}건 · {formatNumber(total)}원
        </span>
        <button type="button" onClick={() => setOpen(true)} className={`${primaryBtnCls} ml-auto`}>
          <Plus size={15} /> 운반비 등록
        </button>
      </div>

      <div className={`${cardCls} mb-4 grid items-end gap-3 p-3 [grid-template-columns:minmax(0,320px)_minmax(0,1fr)]`}>
        <FilterField label="프로젝트">
          <SearchSelect
            ariaLabel="프로젝트"
            options={projects.map((p) => ({ value: p.id, label: p.roundName }))}
            value={projectId}
            onChange={setProjectId}
          />
        </FilterField>
        <p className="pb-2 text-[12.5px] text-text-faint">
          여기 등록한 금액이 손익보고서의 운반비로 잡힙니다. 공급가액과 세액을 나눠 적으면 합계로 계산됩니다.
        </p>
      </div>

      <div className={`${tableWrapCls} overflow-x-auto`}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-border">
              <th className={thCls}>운반일</th>
              <th className={thCls}>프로젝트</th>
              <th className={thCls}>차량번호</th>
              <th className={thCls}>차종</th>
              <th className={thCls}>상차지</th>
              <th className={thCls}>하차지</th>
              <th className={thCls}>제품</th>
              <th className={thNumCls}>중량(kg)</th>
              <th className={thNumCls}>단가</th>
              <th className={thNumCls}>공급가액</th>
              <th className={thNumCls}>세액</th>
              <th className={thNumCls}>합계</th>
              <th className={thCls}>관리</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={trCls}>
                <td className={`${tdCls} tabular whitespace-nowrap`}>{day(r.transportDate)}</td>
                <td className={tdCls}>{projectName(r.projectId)}</td>
                <td className={`${tdCls} whitespace-nowrap`}>{show(r.vehicleNo)}</td>
                <td className={tdCls}>{show(r.vehicleType)}</td>
                <td className={tdCls}>{show(r.origin)}</td>
                <td className={tdCls}>{show(r.destination)}</td>
                <td className={tdCls}>{show(r.itemName)}</td>
                <td className={tdNumCls}>{formatNumber(r.weight)}</td>
                <td className={tdNumCls}>{formatNumber(r.unitPrice)}</td>
                <td className={tdNumCls}>{formatNumber(r.supplyAmount)}</td>
                <td className={tdNumCls}>{formatNumber(r.taxAmount)}</td>
                <td className={`${tdNumCls} font-bold text-text-strong`}>
                  {formatNumber(num(r.supplyAmount) + num(r.taxAmount))}
                </td>
                <td className={tdCls}>
                  <button
                    type="button"
                    title="삭제"
                    onClick={() => remove(r)}
                    className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-danger"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={13} className="py-10 text-center text-[13px] text-text-faint">
                  등록된 운반비가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <FormModal title="운반비 등록" icon={Truck} onClose={() => setOpen(false)}>
          <TransportForm
            projects={projects}
            defaultProjectId={projectId}
            onDone={() => {
              setOpen(false);
              load();
            }}
            onCancel={() => setOpen(false)}
          />
        </FormModal>
      )}
    </div>
  );
}

function TransportForm({
  projects,
  defaultProjectId,
  onDone,
  onCancel,
}: {
  projects: Project[];
  defaultProjectId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    projectId: defaultProjectId,
    transportDate: kstToday(),
    vehicleNo: '',
    vehicleType: '',
    origin: '',
    destination: '',
    itemCode: '',
    itemName: '',
    unitPrice: '',
    weight: '',
    supplyAmount: '',
    taxAmount: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch });

  // 차량번호는 차량등록관리에서, 차종·상차지·하차지는 공통코드에서 가져온다.
  // 목록에 없으면 그대로 적어 넣을 수 있고, 저장하면 다음부터 목록에 나온다.
  const { vehicles } = useVehicles();
  const { items } = useItemMasters();
  const { labels: vehicleTypes } = useCommonCodes('차종');
  const { labels: origins } = useCommonCodes('상차지');
  const { labels: destinations } = useCommonCodes('하차지');

  const pickVehicle = (no: string) => {
    const vehicle = vehicles.find((v) => v.vehicleNo === no);
    set({ vehicleNo: no, ...(vehicle?.vehicleType ? { vehicleType: vehicle.vehicleType } : {}) });
  };
  // 중량과 단가가 있으면 공급가액을 대신 낸다. 직접 적으면 적은 값이 이긴다.
  const byRate = f.weight && f.unitPrice ? Math.round(Number(f.weight) * Number(f.unitPrice)) : 0;
  const supply = f.supplyAmount !== '' ? Number(f.supplyAmount) : byRate;
  // 세액을 비워 두면 공급가액의 10%로 채운다 — 세금계산서와 맞추기 위해서다.
  const tax = f.taxAmount !== '' ? Number(f.taxAmount) : supply ? Math.round(supply * 0.1) : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.projectId) {
      setError('프로젝트를 고르세요.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await api.post('/api/transports', {
        projectId: f.projectId,
        transportDate: f.transportDate,
        vehicleNo: f.vehicleNo || undefined,
        vehicleType: f.vehicleType || undefined,
        origin: f.origin || undefined,
        destination: f.destination || undefined,
        itemCode: f.itemCode || undefined,
        itemName: f.itemName || undefined,
        unitPrice: f.unitPrice ? Number(f.unitPrice) : undefined,
        weight: f.weight ? Number(f.weight) : undefined,
        supplyAmount: supply || undefined,
        taxAmount: tax,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className={cardPadCls}>
      <div className="grid grid-cols-4 gap-x-3 gap-y-3.5">
        <div className="col-span-2">
          <label className={labelCls}>
            프로젝트 <span className="text-danger">*</span>
          </label>
          <SearchSelect
            ariaLabel="프로젝트"
            options={projects.map((p) => ({ value: p.id, label: p.roundName }))}
            value={f.projectId}
            onChange={(v) => set({ projectId: v })}
          />
        </div>

        <div>
          <label className={labelCls}>
            운반일 <span className="text-danger">*</span>
          </label>
          <DateField value={f.transportDate} onChange={(e) => set({ transportDate: e.target.value })} />
        </div>

        <div>
          <label className={labelCls}>차량번호</label>
          <SearchSelect
            ariaLabel="차량번호"
            options={vehicles.map((v) => ({ value: v.vehicleNo, label: v.vehicleNo }))}
            value={f.vehicleNo}
            onChange={pickVehicle}
            placeholder="검색 또는 직접 입력"
            allowFree
          />
        </div>

        <div>
          <label className={labelCls}>차종</label>
          <SearchSelect
            ariaLabel="차종"
            options={vehicleTypes.map((t) => ({ value: t, label: t }))}
            value={f.vehicleType}
            onChange={(v) => set({ vehicleType: v })}
            placeholder="검색 또는 직접 입력"
            allowFree
          />
        </div>

        <div>
          <label className={labelCls}>상차지</label>
          <SearchSelect
            ariaLabel="상차지"
            options={origins.map((t) => ({ value: t, label: t }))}
            value={f.origin}
            onChange={(v) => set({ origin: v })}
            placeholder="검색 또는 직접 입력"
            allowFree
          />
        </div>

        <div>
          <label className={labelCls}>하차지</label>
          <SearchSelect
            ariaLabel="하차지"
            options={destinations.map((t) => ({ value: t, label: t }))}
            value={f.destination}
            onChange={(v) => set({ destination: v })}
            placeholder="검색 또는 직접 입력"
            allowFree
          />
        </div>

        <div className="col-span-2">
          <label className={labelCls}>제품</label>
          <SearchSelect
            ariaLabel="제품"
            options={items.map((i) => ({ value: i.itemName, label: i.itemName }))}
            value={f.itemName}
            onChange={(v) =>
              set({ itemName: v, itemCode: items.find((i) => i.itemName === v)?.itemCode ?? '' })
            }
            placeholder="검색 또는 직접 입력"
            allowFree
          />
        </div>

        <div>
          <label className={labelCls}>중량(kg)</label>
          <NumberInput value={f.weight} onChange={(v) => set({ weight: v })} decimals={3} />
        </div>

        <div>
          <label className={labelCls}>단가(원/kg)</label>
          <NumberInput value={f.unitPrice} onChange={(v) => set({ unitPrice: v })} decimals={2} />
        </div>

        <div>
          <label className={labelCls}>공급가액(원)</label>
          <NumberInput
            value={f.supplyAmount}
            onChange={(v) => set({ supplyAmount: v })}
            placeholder={byRate ? String(byRate) : ''}
          />
          <p className="mt-1 text-[12px] text-text-faint">비우면 중량 × 단가</p>
        </div>

        <div>
          <label className={labelCls}>세액(원)</label>
          <NumberInput value={f.taxAmount} onChange={(v) => set({ taxAmount: v })} placeholder={String(tax)} />
          <p className="mt-1 text-[12px] text-text-faint">비우면 공급가액의 10%</p>
        </div>

        <p className="col-span-3 self-end pb-2 text-[13px] text-text-sub">
          합계: <span className="tabular font-bold text-text-strong">{formatNumber(supply + tax)}</span> 원
        </p>
      </div>

      {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}

      <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
        <button type="button" onClick={onCancel} className={outlineBtnCls}>
          취소
        </button>
        <button type="submit" disabled={submitting} className={primaryBtnCls}>
          {submitting ? '등록 중...' : '등록'}
        </button>
      </div>
    </form>
  );
}
