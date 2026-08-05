import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layers, Plus, Eye, RotateCcw } from 'lucide-react';
import { api } from '../api/client';
import { useVendors, useEmployees, useCommonCodes } from '../hooks/useMasters';
import { FormModal } from '../components/FormModal';
import { FilterField, DateRangeField } from '../components/FilterField';
import { Badge } from '../components/ui/Badge';
import { NumberInput } from '../components/ui/NumberInput';
import { formatNumber } from '../lib/number';
import {
  pageTitleCls,
  sectionTitleCls,
  cardCls,
  primaryBtnCls,
  outlineBtnCls,
  inputCls,
  tableWrapCls,
  thCls,
  tdCls,
  trCls,
} from '../components/ui/classes';
import type { Project, Vendor, Employee } from '../types';

const STATUSES = ['진행', '완료', '보류'];
const DEFAULT_CYCLES = ['월별', '차수완료', '수시'];

const day = (v?: string | null) => (v ? v.slice(0, 10) : '-');
const money = (v?: string | null) => formatNumber(v);
const show = (v?: string | null) => (v == null || v === '' ? '-' : v);
const labelCls = 'mb-1.5 block text-[13px] font-semibold text-text-mid';

// 프로젝트(차수) 관리 — 목록에서 계약 현황을 보고, 등록·수정은 모달에서 처리한다.
// 거래·재고·손익이 모두 이 프로젝트를 참조하므로 삭제는 두지 않고 상태로 종료한다.
export function ProjectManagementPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [ordererId, setOrdererId] = useState('');
  const [managerEmpId, setManagerEmpId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [detail, setDetail] = useState<Project | null>(null);
  const [detailEdit, setDetailEdit] = useState(false);

  const reload = useCallback(async () => {
    const list = await api.get<Project[]>('/api/projects');
    setProjects(list);
    return list;
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // 상세 모달에서 바꾼 상태·수정 결과를 목록과 열려 있는 상세에 함께 반영한다.
  const syncDetail = async (id: string) => {
    const list = await reload();
    setDetail(list.find((x) => x.id === id) ?? null);
  };

  const changeDetailStatus = async (p: Project, next: string) => {
    await api.patch(`/api/projects/${p.id}`, { status: next });
    await syncDetail(p.id);
  };

  // 건수가 많지 않아 화면에서 거른다. 계약기간은 구간이 겹치는 건을 남긴다.
  const rows = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    return projects.filter((p) => {
      if (status && p.status !== status) return false;
      if (ordererId && p.ordererId !== ordererId) return false;
      if (managerEmpId && p.managerEmpId !== managerEmpId) return false;
      if (from && p.endDate && p.endDate.slice(0, 10) < from) return false;
      if (to && p.startDate && p.startDate.slice(0, 10) > to) return false;
      if (keyword) {
        const hay = [
          p.projectCode,
          p.roundName,
          p.roundNo,
          p.siteName,
          p.region,
          p.orderer?.name,
          p.contractor?.name,
          p.buyer?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(keyword)) return false;
      }
      return true;
    });
  }, [projects, q, status, ordererId, managerEmpId, from, to]);

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <Layers size={20} className="text-primary" />
        <h1 className={pageTitleCls}>프로젝트 관리</h1>
        <span className="ml-1 text-[13px] text-text-sub">
          {rows.length}건{rows.length !== projects.length ? ` / ${projects.length}건` : ''}
        </span>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className={`${primaryBtnCls} ml-auto`}
        >
          <Plus size={15} /> 프로젝트 등록
        </button>
      </div>

      <ProjectFilterBar
        q={q}
        setQ={setQ}
        status={status}
        setStatus={setStatus}
        ordererId={ordererId}
        setOrdererId={setOrdererId}
        managerEmpId={managerEmpId}
        setManagerEmpId={setManagerEmpId}
        from={from}
        setFrom={setFrom}
        to={to}
        setTo={setTo}
        onReset={() => {
          setQ('');
          setStatus('');
          setOrdererId('');
          setManagerEmpId('');
          setFrom('');
          setTo('');
        }}
      />

      <div className={`${tableWrapCls} overflow-x-auto`}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-border">
              <th className={thCls}>코드</th>
              <th className={thCls}>프로젝트(사업)명</th>
              <th className={thCls}>차수</th>
              <th className={thCls}>발주처</th>
              <th className={thCls}>시공사</th>
              <th className={thCls}>현장</th>
              <th className={thCls}>계약기간</th>
              <th className={thCls}>계약금액</th>
              <th className={thCls}>매입가</th>
              <th className={thCls}>담당자</th>
              <th className={thCls}>상태</th>
              <th className={thCls}>관리</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className={trCls}>
                <td className={`${tdCls} tabular whitespace-nowrap`}>{show(p.projectCode)}</td>
                <td className={`${tdCls} font-semibold text-text-strong`}>{p.roundName}</td>
                <td className={tdCls}>{show(p.roundNo)}</td>
                <td className={tdCls}>{show(p.orderer?.name)}</td>
                <td className={tdCls}>{show(p.contractor?.name)}</td>
                <td className={tdCls}>{show(p.siteName ?? p.region)}</td>
                <td className={`${tdCls} tabular whitespace-nowrap`}>
                  {day(p.startDate)} ~ {day(p.endDate)}
                </td>
                <td className={`${tdCls} tabular text-right`}>{money(p.contractAmount)}</td>
                <td className={`${tdCls} tabular text-right`}>{money(p.purchasePrice)}</td>
                <td className={tdCls}>{show(p.manager?.name)}</td>
                <td className={tdCls}>
                  <Badge tone={p.status === '완료' ? 'slate' : p.status === '보류' ? 'amber' : 'blue'}>{p.status}</Badge>
                </td>
                <td className={`${tdCls} whitespace-nowrap`}>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      title="상세"
                      onClick={() => setDetail(p)}
                      className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-text-strong"
                    >
                      <Eye size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={12} className="py-10 text-center text-[13px] text-text-faint">
                  {projects.length === 0 ? '등록된 프로젝트가 없습니다.' : '검색 조건에 맞는 프로젝트가 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[12.5px] text-text-faint">
        입출고·재고·손익 집계가 모두 이 프로젝트를 참조합니다. 종료된 차수는 삭제하지 말고 상태를 완료로 바꿔 주세요.
      </p>

      {detail && (
        <FormModal
          title={`${detail.roundName} ${detailEdit ? '수정' : '상세'}`}
          icon={Layers}
          onClose={() => {
            setDetail(null);
            setDetailEdit(false);
          }}
        >
          {detailEdit ? (
            <ProjectForm
              project={detail}
              onDone={async () => {
                await syncDetail(detail.id);
                setDetailEdit(false);
              }}
              onCancel={() => setDetailEdit(false)}
            />
          ) : (
            <ProjectDetail
              project={detail}
              onEdit={() => setDetailEdit(true)}
              onStatusChange={(next) => changeDetailStatus(detail, next)}
            />
          )}
        </FormModal>
      )}

      {open && (
        <FormModal
          title={editing ? '프로젝트 수정' : '프로젝트 등록'}
          icon={Layers}
          onClose={() => {
            setOpen(false);
            setEditing(null);
          }}
        >
          <ProjectForm
            project={editing}
            onDone={() => {
              setOpen(false);
              setEditing(null);
              reload();
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

function ProjectDetail({
  project: p,
  onEdit,
  onStatusChange,
}: {
  project: Project;
  onEdit: () => void;
  onStatusChange: (next: string) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  const changeStatus = async (next: string) => {
    setSaving(true);
    try {
      await onStatusChange(next);
    } finally {
      setSaving(false);
    }
  };

  const fields: { label: string; value: string }[] = [
    { label: '프로젝트 코드', value: show(p.projectCode) },
    { label: '사업명', value: p.roundName },
    { label: '차수', value: show(p.roundNo) },
    { label: '발주처', value: show(p.orderer?.name) },
    { label: '시공사', value: show(p.contractor?.name) },
    { label: '매입처', value: show(p.buyer?.name) },
    { label: '현장명', value: show(p.siteName) },
    { label: '지역', value: show(p.region) },
    { label: '배출자', value: show(p.dischargerName) },
    { label: '계약기간', value: `${day(p.startDate)} ~ ${day(p.endDate)}` },
    { label: '계약금액', value: `${money(p.contractAmount)}${p.vatIncluded ? ' (부가세 포함)' : ''}` },
    { label: '매입가', value: money(p.purchasePrice) },
    { label: '계약중량(kg)', value: formatNumber(p.contractWeight) },
    { label: '계약보증금', value: money(p.deposit) },
    { label: '선급금', value: money(p.advancePayment) },
    { label: '정산주기', value: show(p.settlementCycle) },
    { label: '담당자', value: show(p.manager?.name) },
  ];

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-3 gap-x-5 gap-y-2">
        {fields.map((f) => (
          <div key={f.label} className="flex justify-between gap-3 border-b border-border pb-1.5">
            <dt className="text-[12.5px] text-text-sub">{f.label}</dt>
            <dd className="text-[13px] font-semibold text-text-strong">{f.value}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 border-b border-border pb-1.5">
          <dt className="text-[12.5px] text-text-sub">상태</dt>
          <dd>
            <select
              value={p.status}
              disabled={saving}
              onChange={(e) => changeStatus(e.target.value)}
              aria-label="상태 변경"
              className={`${inputCls} h-8 w-[86px] px-2 text-[12.5px]`}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </dd>
        </div>
      </dl>
      {p.memo && (
        <div>
          <h3 className={`${sectionTitleCls} mb-1 text-[14px]`}>비고</h3>
          <p className="text-[13px] text-text">{p.memo}</p>
        </div>
      )}
      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <button type="button" onClick={onEdit} className={primaryBtnCls}>
          수정
        </button>
      </div>
    </div>
  );
}

function ProjectForm({
  project,
  onDone,
  onCancel,
}: {
  project: Project | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { vendors } = useVendors();
  const { employees } = useEmployees();
  const { labels: cycleCodes } = useCommonCodes('정산주기');
  const cycles = cycleCodes.length > 0 ? cycleCodes : DEFAULT_CYCLES;

  const [f, setF] = useState({
    roundName: project?.roundName ?? '',
    roundNo: project?.roundNo ?? '',
    ordererId: project?.ordererId ?? '',
    contractorId: project?.contractorId ?? '',
    buyerId: project?.buyerId ?? '',
    siteName: project?.siteName ?? '',
    region: project?.region ?? '',
    dischargerName: project?.dischargerName ?? '',
    startDate: project?.startDate?.slice(0, 10) ?? '',
    endDate: project?.endDate?.slice(0, 10) ?? '',
    contractAmount: project?.contractAmount ? String(project.contractAmount) : '',
    purchasePrice: project?.purchasePrice ? String(project.purchasePrice) : '',
    contractWeight: project?.contractWeight ? String(project.contractWeight) : '',
    deposit: project?.deposit ? String(project.deposit) : '',
    advancePayment: project?.advancePayment ? String(project.advancePayment) : '',
    settlementCycle: project?.settlementCycle ?? '',
    managerEmpId: project?.managerEmpId ?? '',
    memo: project?.memo ?? '',
    status: project?.status ?? '진행',
  });
  const [vatIncluded, setVatIncluded] = useState(project?.vatIncluded ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch });

  const vendorOptions = (label: string) => (
    <>
      <option value="">{label}</option>
      {vendors.map((v: Vendor) => (
        <option key={v.id} value={v.id}>
          {v.name}
        </option>
      ))}
    </>
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.roundName.trim()) return;
    if (f.startDate && f.endDate && f.startDate > f.endDate) {
      setError('계약 종료일이 시작일보다 빠릅니다.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const payload = { ...f, vatIncluded };
      if (project) await api.patch(`/api/projects/${project.id}`, payload);
      else await api.post('/api/projects', payload);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-3 gap-x-3 gap-y-3.5">
        <div className="col-span-2">
          <label className={labelCls}>프로젝트(사업)명</label>
          <input
            value={f.roundName}
            onChange={(e) => set({ roundName: e.target.value })}
            required
            placeholder="포스코_KM_안산"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>차수</label>
          <input value={f.roundNo} onChange={(e) => set({ roundNo: e.target.value })} placeholder="26-1차" className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>발주처(원청)</label>
          <select value={f.ordererId} onChange={(e) => set({ ordererId: e.target.value })} className={inputCls}>
            {vendorOptions('선택')}
          </select>
        </div>
        <div>
          <label className={labelCls}>시공사(계약상대)</label>
          <select value={f.contractorId} onChange={(e) => set({ contractorId: e.target.value })} className={inputCls}>
            {vendorOptions('선택')}
          </select>
        </div>
        <div>
          <label className={labelCls}>매입처</label>
          <select value={f.buyerId} onChange={(e) => set({ buyerId: e.target.value })} className={inputCls}>
            {vendorOptions('선택')}
          </select>
        </div>

        <div>
          <label className={labelCls}>현장명</label>
          <input value={f.siteName} onChange={(e) => set({ siteName: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>지역</label>
          <input value={f.region} onChange={(e) => set({ region: e.target.value })} placeholder="안산 / 평택" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>배출자</label>
          <input
            value={f.dischargerName}
            onChange={(e) => set({ dischargerName: e.target.value })}
            placeholder="폐기물 등록 기본값"
            className={inputCls}
          />
        </div>

        <div className="col-span-2">
          <label className={labelCls}>계약기간</label>
          <div className="flex items-center gap-2">
            <input type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} className={inputCls} />
            <span className="text-center text-text-faint">~</span>
            <input type="date" value={f.endDate} onChange={(e) => set({ endDate: e.target.value })} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>상태</label>
          <select value={f.status} onChange={(e) => set({ status: e.target.value })} className={inputCls}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>계약금액(원)</label>
          <NumberInput value={f.contractAmount} onChange={(v) => set({ contractAmount: v })} />
        </div>
        <div>
          <label className={labelCls}>매입가(원)</label>
          <NumberInput value={f.purchasePrice} onChange={(v) => set({ purchasePrice: v })} />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-[13px] font-semibold text-text-mid">
            <input
              type="checkbox"
              checked={vatIncluded}
              onChange={(e) => setVatIncluded(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            계약금액 부가세 포함
          </label>
        </div>

        <div>
          <label className={labelCls}>계약(예상)중량(kg)</label>
          <NumberInput value={f.contractWeight} onChange={(v) => set({ contractWeight: v })} decimals={3} />
        </div>
        <div>
          <label className={labelCls}>계약보증금(원)</label>
          <NumberInput value={f.deposit} onChange={(v) => set({ deposit: v })} />
        </div>
        <div>
          <label className={labelCls}>선급금(원)</label>
          <NumberInput value={f.advancePayment} onChange={(v) => set({ advancePayment: v })} />
        </div>

        <div>
          <label className={labelCls}>정산주기</label>
          <select value={f.settlementCycle} onChange={(e) => set({ settlementCycle: e.target.value })} className={inputCls}>
            <option value="">선택</option>
            {cycles.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>담당자</label>
          <select value={f.managerEmpId} onChange={(e) => set({ managerEmpId: e.target.value })} className={inputCls}>
            <option value="">선택</option>
            {employees.map((emp: Employee) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>
        <p className="self-end pb-2 text-[12.5px] text-text-faint">
          매입가는 손익 대시보드의 취득원가, 계약중량은 회수율 기준입니다.
        </p>

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
        <button type="submit" disabled={submitting} className={primaryBtnCls}>
          {submitting ? '저장 중...' : project ? '수정' : '등록'}
        </button>
      </div>
    </form>
  );
}

// 검색 필터 — 가로 스크롤 없이 한 줄에 들어가도록 남는 폭을 셀렉트가 나눠 갖는다.
function ProjectFilterBar({
  q,
  setQ,
  status,
  setStatus,
  ordererId,
  setOrdererId,
  managerEmpId,
  setManagerEmpId,
  from,
  setFrom,
  to,
  setTo,
  onReset,
}: {
  q: string;
  setQ: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  ordererId: string;
  setOrdererId: (v: string) => void;
  managerEmpId: string;
  setManagerEmpId: (v: string) => void;
  from: string;
  setFrom: (v: string) => void;
  to: string;
  setTo: (v: string) => void;
  onReset: () => void;
}) {
  const { vendors } = useVendors();
  const { employees } = useEmployees();

  return (
    <div
      className={`${cardCls} mb-4 grid items-end gap-3 p-3 [grid-template-columns:280px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)_auto]`}
    >
      <DateRangeField label="계약기간" from={from} to={to} setFrom={setFrom} setTo={setTo} />

      <FilterField label="발주처">
        <select value={ordererId} onChange={(e) => setOrdererId(e.target.value)} className={`${inputCls} px-2`}>
          <option value="">전체</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </FilterField>

      <FilterField label="담당자">
        <select value={managerEmpId} onChange={(e) => setManagerEmpId(e.target.value)} className={`${inputCls} px-2`}>
          <option value="">전체</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </FilterField>

      <FilterField label="상태">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} px-2`}>
          <option value="">전체</option>
          {STATUSES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      </FilterField>

      <FilterField label="검색어">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="코드 / 사업명 / 차수 / 현장 / 거래처"
          className={inputCls}
        />
      </FilterField>

      <button type="button" onClick={onReset} className={`${outlineBtnCls} whitespace-nowrap px-3`}>
        <RotateCcw size={15} /> 초기화
      </button>
    </div>
  );
}
