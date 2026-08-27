import { useCallback, useEffect, useMemo, useState } from 'react';
import { Settings, Building2, Package, Plus, Eye, Trash2, RotateCcw } from 'lucide-react';
import { api } from '../api/client';
import { CommonCodePage } from './CommonCodePage';
import { ExternalVehicleSection } from '../components/ExternalVehicleSection';
import { ExternalDriverSection } from '../components/ExternalDriverSection';
import { useVendors, useItemMasters } from '../hooks/useMasters';
import { Badge } from '../components/ui/Badge';
import { FormModal } from '../components/FormModal';
import { FilterField } from '../components/FilterField';
import {
  pageTitleCls,
  sectionTitleCls,
  cardCls,
  primaryBtnCls,
  outlineBtnCls,
  inputCls,
  thCls,
  tdCls,
  trCls,
} from '../components/ui/classes';
import type { Vendor, ItemMaster } from '../types';

interface CodeGroup {
  value: string;
  label: string;
  nextCode: string;
}

const labelCls = 'mb-1.5 block text-[13px] font-semibold text-text-mid';
const show = (v?: string | null) => (v == null || v === '' ? '-' : v);

const VENDOR_TYPES = ['매입처', '매각처', '자회사', '폐기물업체'];
const USAGE_TYPES = ['공용', '매입전용', '매출전용'];

const iconBtnCls = 'rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-text-strong';

// 마스터 관리 — 거래처·품목을 2열로 나란히 두고, 각 열은 검색 + 목록 + 신규등록으로 구성한다.
// 공통코드와 한 화면에 있으면 목록이 길어질수록 아래로 밀려서 별도 탭으로 분리했다.
// 마스터 관리 — 거래처·품목·공통코드를 기능별 탭으로 나눈다.
// 한 화면에 모아 두면 목록이 길어질수록 아래 것이 밀려 내려가 찾기 어려워진다.
type MasterTab = 'vendors' | 'items' | 'codes' | 'vehicles' | 'drivers';

export function MasterManagementPage({ embedded = false }: { embedded?: boolean }) {
  const { vendors, reload: reloadVendors } = useVendors();
  const { items, reload: reloadItems } = useItemMasters();
  const [tab, setTab] = useState<MasterTab>('codes');
  // 탭마다 몇 건인지 보여 준다. 목록을 열지 않고도 어디에 무엇이 쌓였는지 알 수 있어야 한다.
  const [counts, setCounts] = useState({ codes: 0, vehicles: 0, drivers: 0 });

  const loadCounts = useCallback(() => {
    Promise.all([
      api.get<unknown[]>('/api/common-codes?includeInactive=true'),
      api.get<unknown[]>('/api/assets?assetType=VEHICLE&isCompany=false'),
      api.get<unknown[]>('/api/external-drivers'),
    ]).then(([codes, vehicles, drivers]) =>
      setCounts({ codes: codes.length, vehicles: vehicles.length, drivers: drivers.length }),
    );
  }, []);

  // 탭을 옮길 때마다 다시 센다 — 방금 지우거나 고친 것이 숫자에 바로 반영되어야 한다.
  useEffect(() => {
    loadCounts();
  }, [loadCounts, tab]);

  return (
    <div>
      {!embedded && (
        <div className="mb-5 flex items-center gap-2">
          <Settings size={20} className="text-primary" />
          <h1 className={pageTitleCls}>마스터 관리</h1>
        </div>
      )}

      <div className="mb-5 flex gap-1 border-b border-border">
        <MasterTabButton active={tab === 'codes'} onClick={() => setTab('codes')}>
          공통코드 <span className="ml-1 font-semibold text-text-faint">{counts.codes}</span>
        </MasterTabButton>
        <MasterTabButton active={tab === 'vendors'} onClick={() => setTab('vendors')}>
          거래처 <span className="ml-1 font-semibold text-text-faint">{vendors.length}</span>
        </MasterTabButton>
        <MasterTabButton active={tab === 'items'} onClick={() => setTab('items')}>
          품목 <span className="ml-1 font-semibold text-text-faint">{items.length}</span>
        </MasterTabButton>
        <MasterTabButton active={tab === 'vehicles'} onClick={() => setTab('vehicles')}>
          계근 차량 <span className="ml-1 font-semibold text-text-faint">{counts.vehicles}</span>
        </MasterTabButton>
        <MasterTabButton active={tab === 'drivers'} onClick={() => setTab('drivers')}>
          운전자 <span className="ml-1 font-semibold text-text-faint">{counts.drivers}</span>
        </MasterTabButton>
      </div>

      {tab === 'drivers' ? (
        <ExternalDriverSection />
      ) : tab === 'vehicles' ? (
        <ExternalVehicleSection />
      ) : tab === 'codes' ? (
        <div>
          <p className="mb-4 text-[13px] text-text-sub">
            등록 화면에서 반복 입력되는 값 목록입니다. 기록 시점의 문자열로 저장되므로, 여기서 지워도 과거 데이터는 그대로
            남고 선택 목록에서만 사라집니다.
          </p>
          <CommonCodePage embedded />
        </div>
      ) : (
        <div className="h-[calc(100vh-260px)] min-h-[420px]">
          {tab === 'vendors' ? (
            <VendorSection vendors={vendors} reload={reloadVendors} />
          ) : (
            <ItemSection items={items} reload={reloadItems} />
          )}
        </div>
      )}
    </div>
  );
}

function MasterTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        '-mb-px border-b-2 px-4 py-2 text-[14px] font-bold transition-colors',
        active ? 'border-primary text-text-strong' : 'border-transparent text-text-sub hover:text-text-strong',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function SectionHead({
  icon: Icon,
  title,
  count,
  total,
  onAdd,
}: {
  icon: typeof Building2;
  title: string;
  count: number;
  total: number;
  onAdd: () => void;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon size={17} className="text-primary" />
      <h2 className={sectionTitleCls}>{title}</h2>
      <span className="text-[13px] text-text-sub">
        {count}건{count !== total ? ` / ${total}건` : ''}
      </span>
      <button type="button" onClick={onAdd} className={`${primaryBtnCls} ml-auto`}>
        <Plus size={15} /> 신규등록
      </button>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border pb-1.5">
      <dt className="text-[12.5px] text-text-sub">{label}</dt>
      <dd className="text-[13px] font-semibold text-text-strong">{value}</dd>
    </div>
  );
}

// ── 거래처 마스터 ──────────────────────────

function VendorSection({ vendors, reload }: { vendors: Vendor[]; reload: () => void }) {
  const [q, setQ] = useState('');
  const [vendorType, setVendorType] = useState('');
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Vendor | null>(null);
  const [detailEdit, setDetailEdit] = useState(false);
  const [error, setError] = useState('');

  const rows = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    return vendors.filter((v) => {
      if (vendorType && v.vendorType !== vendorType) return false;
      if (!keyword) return true;
      return [v.name, v.bizRegNo, v.ceoName, v.contactName, v.contactPhone, v.phone]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });
  }, [vendors, q, vendorType]);

  const promote = async (id: string) => {
    await api.patch(`/api/vendors/${id}/promote`, {});
    reload();
  };

  const remove = async (v: Vendor) => {
    if (!window.confirm(`거래처 '${v.name}'을(를) 삭제할까요?`)) return;
    setError('');
    try {
      await api.del(`/api/vendors/${v.id}`);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 실패');
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col">
      <SectionHead
        icon={Building2}
        title="거래처 마스터"
        count={rows.length}
        total={vendors.length}
        onAdd={() => setOpen(true)}
      />
      <p className="mb-3 shrink-0 text-[12.5px] text-text-faint">세금계산서 발행에 필요한 사업자 정보를 함께 등록합니다.</p>

      <div
        className={`${cardCls} mb-3 shrink-0 grid items-end gap-2 p-3 [grid-template-columns:minmax(0,1fr)_minmax(0,130px)_auto]`}
      >
        <FilterField label="검색어">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="거래처명 / 사업자번호 / 대표자 / 담당자"
            className={inputCls}
          />
        </FilterField>
        <FilterField label="구분">
          <select value={vendorType} onChange={(e) => setVendorType(e.target.value)} className={`${inputCls} px-2`}>
            <option value="">전체</option>
            {VENDOR_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </FilterField>
        <button
          type="button"
          onClick={() => {
            setQ('');
            setVendorType('');
          }}
          className={`${outlineBtnCls} whitespace-nowrap px-3`}
        >
          <RotateCcw size={15} /> 초기화
        </button>
      </div>

      {error && <p className="mb-2 shrink-0 text-[13px] text-danger">{error}</p>}

      <div className={`${cardCls} min-h-0 flex-1 overflow-auto`}>
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-[1] bg-card">
            <tr className="border-y border-border">
              <th className={thCls}>거래처명</th>
              <th className={thCls}>구분</th>
              <th className={thCls}>사업자등록번호</th>
              <th className={thCls}>담당자</th>
              <th className={thCls}>연락처</th>
              <th className={thCls}>관리</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id} className={trCls}>
                <td className={`${tdCls} font-semibold text-text-strong`}>
                  <span className="flex items-center gap-1.5">
                    {v.name}
                    {v.isTemporary && <Badge tone="amber">임시</Badge>}
                  </span>
                </td>
                <td className={tdCls}>{show(v.vendorType)}</td>
                <td className={`${tdCls} tabular whitespace-nowrap`}>{show(v.bizRegNo)}</td>
                <td className={tdCls}>{show(v.contactName)}</td>
                <td className={`${tdCls} tabular whitespace-nowrap`}>{show(v.contactPhone ?? v.phone)}</td>
                <td className={`${tdCls} whitespace-nowrap`}>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      title="상세"
                      onClick={() => {
                        setDetailEdit(false);
                        setDetail(v);
                      }}
                      className={iconBtnCls}
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      type="button"
                      title="삭제"
                      onClick={() => remove(v)}
                      className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                    {v.isTemporary && (
                      <button
                        type="button"
                        onClick={() => promote(v.id)}
                        className="text-[12px] font-semibold text-primary hover:underline"
                      >
                        정식 승격
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-[13px] text-text-faint">
                  {vendors.length === 0 ? '등록된 거래처가 없습니다.' : '검색 조건에 맞는 거래처가 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <FormModal title="거래처 신규등록" icon={Building2} onClose={() => setOpen(false)}>
          <VendorForm
            vendor={null}
            onDone={() => {
              setOpen(false);
              reload();
            }}
            onCancel={() => setOpen(false)}
          />
        </FormModal>
      )}

      {detail && (
        <FormModal
          title={`${detail.name} ${detailEdit ? '수정' : '상세'}`}
          icon={Building2}
          onClose={() => {
            setDetail(null);
            setDetailEdit(false);
          }}
        >
          {detailEdit ? (
            <VendorForm
              vendor={detail}
              onDone={(saved) => {
                setDetail(saved);
                setDetailEdit(false);
                reload();
              }}
              onCancel={() => setDetailEdit(false)}
            />
          ) : (
            <VendorDetail vendor={detail} onEdit={() => setDetailEdit(true)} />
          )}
        </FormModal>
      )}
    </section>
  );
}

function VendorDetail({ vendor: v, onEdit }: { vendor: Vendor; onEdit: () => void }) {
  const fields = [
    { label: '거래처명', value: v.name },
    { label: '구분', value: show(v.vendorType) },
    { label: '대표자', value: show(v.ceoName) },
    { label: '사업자등록번호', value: show(v.bizRegNo) },
    { label: '법인등록번호', value: show(v.corpRegNo) },
    { label: '업태', value: show(v.bizType) },
    { label: '종목', value: show(v.bizItem) },
    { label: '사업장 주소', value: show(v.address) },
    { label: '대표전화', value: show(v.phone) },
    { label: '팩스', value: show(v.fax) },
    { label: '담당자', value: show(v.contactName) },
    { label: '담당자 연락처', value: show(v.contactPhone) },
    { label: '계산서 수신 메일', value: show(v.contactEmail) },
    { label: '등록 상태', value: v.isTemporary ? '임시' : '정식' },
  ];

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-x-5 gap-y-2">
        {fields.map((f) => (
          <DetailRow key={f.label} label={f.label} value={f.value} />
        ))}
      </dl>
      {v.memo && (
        <div>
          <h3 className="mb-1 text-[14px] font-extrabold text-text-strong">비고</h3>
          <p className="text-[13px] text-text">{v.memo}</p>
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

function VendorForm({
  vendor,
  onDone,
  onCancel,
}: {
  vendor: Vendor | null;
  onDone: (saved: Vendor) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    name: vendor?.name ?? '',
    vendorType: vendor?.vendorType ?? '',
    bizRegNo: vendor?.bizRegNo ?? '',
    corpRegNo: vendor?.corpRegNo ?? '',
    ceoName: vendor?.ceoName ?? '',
    bizType: vendor?.bizType ?? '',
    bizItem: vendor?.bizItem ?? '',
    address: vendor?.address ?? '',
    phone: vendor?.phone ?? '',
    fax: vendor?.fax ?? '',
    contactName: vendor?.contactName ?? '',
    contactPhone: vendor?.contactPhone ?? '',
    contactEmail: vendor?.contactEmail ?? '',
    memo: vendor?.memo ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    setError('');
    setSubmitting(true);
    try {
      const saved = vendor
        ? await api.patch<Vendor>(`/api/vendors/${vendor.id}`, f)
        : await api.post<Vendor>('/api/vendors', f);
      onDone(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-3 gap-x-3 gap-y-3.5">
        <div>
          <label className={labelCls}>거래처명</label>
          <input value={f.name} onChange={(e) => set({ name: e.target.value })} required className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>구분</label>
          <select value={f.vendorType} onChange={(e) => set({ vendorType: e.target.value })} className={inputCls}>
            <option value="">선택</option>
            {VENDOR_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>대표자</label>
          <input value={f.ceoName} onChange={(e) => set({ ceoName: e.target.value })} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>사업자등록번호</label>
          <input
            value={f.bizRegNo}
            onChange={(e) => set({ bizRegNo: e.target.value })}
            placeholder="123-45-67890"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>법인등록번호</label>
          <input
            value={f.corpRegNo}
            onChange={(e) => set({ corpRegNo: e.target.value })}
            placeholder="110111-1234567"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>업태</label>
          <input value={f.bizType} onChange={(e) => set({ bizType: e.target.value })} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>종목</label>
          <input value={f.bizItem} onChange={(e) => set({ bizItem: e.target.value })} className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>사업장 주소</label>
          <input value={f.address} onChange={(e) => set({ address: e.target.value })} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>대표전화</label>
          <input value={f.phone} onChange={(e) => set({ phone: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>팩스</label>
          <input value={f.fax} onChange={(e) => set({ fax: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>담당자</label>
          <input value={f.contactName} onChange={(e) => set({ contactName: e.target.value })} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>담당자 연락처</label>
          <input value={f.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>계산서 수신 메일</label>
          <input
            type="email"
            value={f.contactEmail}
            onChange={(e) => set({ contactEmail: e.target.value })}
            className={inputCls}
          />
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
        <button type="submit" disabled={submitting} className={primaryBtnCls}>
          {submitting ? '저장 중...' : vendor ? '수정' : '등록'}
        </button>
      </div>
    </form>
  );
}

// ── 품목 마스터 ────────────────────────────

function ItemSection({ items, reload }: { items: ItemMaster[]; reload: () => void }) {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [usageType, setUsageType] = useState('');
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<ItemMaster | null>(null);
  const [detailEdit, setDetailEdit] = useState(false);
  const [error, setError] = useState('');

  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category).filter(Boolean))).sort(),
    [items],
  );

  const rows = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    return items.filter((i) => {
      if (category && i.category !== category) return false;
      if (usageType && (i.usageType ?? '공용') !== usageType) return false;
      if (!keyword) return true;
      return [i.itemCode, i.itemName, i.aliasNames, i.material, i.grade]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });
  }, [items, q, category, usageType]);

  const promote = async (code: string) => {
    await api.patch(`/api/item-masters/${code}/promote`, {});
    reload();
  };

  const remove = async (i: ItemMaster) => {
    if (!window.confirm(`품목 '${i.itemName}'을(를) 삭제할까요?`)) return;
    setError('');
    try {
      await api.del(`/api/item-masters/${i.itemCode}`);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 실패');
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col">
      <SectionHead icon={Package} title="품목 마스터" count={rows.length} total={items.length} onAdd={() => setOpen(true)} />
      <p className="mb-3 shrink-0 text-[12.5px] text-text-faint">
        현장 호칭(별칭)이 없으면 계근표·일보 매칭이 되지 않으니 함께 등록해 주세요.
      </p>

      <div
        className={`${cardCls} mb-3 shrink-0 grid items-end gap-2 p-3 [grid-template-columns:minmax(0,1fr)_minmax(0,120px)_minmax(0,110px)_auto]`}
      >
        <FilterField label="검색어">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="코드 / 품목명 / 현장 호칭 / 재질"
            className={inputCls}
          />
        </FilterField>
        <FilterField label="대분류">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputCls} px-2`}>
            <option value="">전체</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="용도">
          <select value={usageType} onChange={(e) => setUsageType(e.target.value)} className={`${inputCls} px-2`}>
            <option value="">전체</option>
            {USAGE_TYPES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </FilterField>
        <button
          type="button"
          onClick={() => {
            setQ('');
            setCategory('');
            setUsageType('');
          }}
          className={`${outlineBtnCls} whitespace-nowrap px-3`}
        >
          <RotateCcw size={15} /> 초기화
        </button>
      </div>

      {error && <p className="mb-2 shrink-0 text-[13px] text-danger">{error}</p>}

      <div className={`${cardCls} min-h-0 flex-1 overflow-auto`}>
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-[1] bg-card">
            <tr className="border-y border-border">
              <th className={thCls}>No</th>
              <th className={thCls}>코드</th>
              <th className={thCls}>품목명</th>
              <th className={thCls}>기본단위</th>
              <th className={thCls}>비고</th>
              <th className={thCls}>관리</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i, idx) => (
              <tr key={i.id} className={trCls}>
                <td className={`${tdCls} tabular whitespace-nowrap text-text-sub`}>{idx + 1}</td>
                <td className={`${tdCls} tabular whitespace-nowrap`}>{i.itemCode}</td>
                <td className={`${tdCls} font-semibold text-text-strong`}>
                  <span className="flex items-center gap-1.5">
                    {i.itemName}
                    {i.isTemporary && <Badge tone="amber">임시</Badge>}
                    {i.isActive === false && <Badge tone="slate">미사용</Badge>}
                  </span>
                </td>
                <td className={tdCls}>{show(i.baseUnit)}</td>
                <td className={tdCls}>{show(i.memo)}</td>
                <td className={`${tdCls} whitespace-nowrap`}>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      title="상세"
                      onClick={() => {
                        setDetailEdit(false);
                        setDetail(i);
                      }}
                      className={iconBtnCls}
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      type="button"
                      title="삭제"
                      onClick={() => remove(i)}
                      className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                    {i.isTemporary && (
                      <button
                        type="button"
                        onClick={() => promote(i.itemCode)}
                        className="text-[12px] font-semibold text-primary hover:underline"
                      >
                        정식 승격
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-[13px] text-text-faint">
                  {items.length === 0 ? '등록된 품목이 없습니다.' : '검색 조건에 맞는 품목이 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <FormModal title="품목 신규등록" icon={Package} onClose={() => setOpen(false)}>
          <ItemForm
            item={null}
            existing={items}
            onDone={() => {
              setOpen(false);
              reload();
            }}
            onCancel={() => setOpen(false)}
          />
        </FormModal>
      )}

      {detail && (
        <FormModal
          title={`${detail.itemName} ${detailEdit ? '수정' : '상세'}`}
          icon={Package}
          onClose={() => {
            setDetail(null);
            setDetailEdit(false);
          }}
        >
          {detailEdit ? (
            <ItemForm
              item={detail}
              onDone={(saved) => {
                setDetail(saved);
                setDetailEdit(false);
                reload();
              }}
              onCancel={() => setDetailEdit(false)}
            />
          ) : (
            <ItemDetail item={detail} onEdit={() => setDetailEdit(true)} />
          )}
        </FormModal>
      )}
    </section>
  );
}

function ItemDetail({ item: i, onEdit }: { item: ItemMaster; onEdit: () => void }) {
  const fields = [
    { label: '품목코드', value: i.itemCode },
    { label: '품목명', value: i.itemName },
    { label: '기본단위', value: show(i.baseUnit) },
    { label: '비고', value: show(i.memo) },
  ];


  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-x-5 gap-y-2">
        {fields.map((f) => (
          <DetailRow key={f.label} label={f.label} value={f.value} />
        ))}
      </dl>
      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <button type="button" onClick={onEdit} className={primaryBtnCls}>
          수정
        </button>
      </div>
    </div>
  );
}

// 품목 등록 — 코드는 분류를 고르면 자동 채번되고, 사람이 채우는 항목은 넷뿐이다.
// 재질·공제율 등 옛 상세 항목은 실제로 쓰이지 않아 입력에서 걷어냈다.
function ItemForm({
  item,
  existing = [],
  onDone,
  onCancel,
}: {
  item: ItemMaster | null;
  existing?: ItemMaster[];
  onDone: (saved: ItemMaster) => void;
  onCancel: () => void;
}) {
  const [groups, setGroups] = useState<CodeGroup[]>([]);
  const [codeGroup, setCodeGroup] = useState('');
  const [itemName, setItemName] = useState(item?.itemName ?? '');
  const [baseUnit, setBaseUnit] = useState(item?.baseUnit ?? 'kg');
  const [memo, setMemo] = useState(item?.memo ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 분류별 다음 코드를 서버에서 받아 미리 보여준다.
  useEffect(() => {
    if (item) return;
    api.get<CodeGroup[]>('/api/item-masters/code-groups').then(setGroups);
  }, [item]);

  const nextCode = groups.find((g) => g.value === codeGroup)?.nextCode ?? '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;
    if (!item && !codeGroup) {
      setError('품목 분류를 선택하세요.');
      return;
    }
    // 같은 이름이 이미 있으면 알려만 주고, 그래도 등록하겠다면 진행한다.
    // 같은 물건이 두 코드로 갈라지면 재고가 나뉘기 때문이다.
    if (!item) {
      const dup = existing.find((x) => x.itemName.trim().toLowerCase() === itemName.trim().toLowerCase());
      if (dup && !window.confirm(`'${dup.itemName}'은(는) 이미 ${dup.itemCode}로 등록돼 있습니다. 그래도 새 코드로 등록할까요?`)) {
        return;
      }
    }
    setError('');
    setSubmitting(true);
    try {
      const saved = item
        ? await api.patch<ItemMaster>(`/api/item-masters/${item.itemCode}`, { itemName, baseUnit, memo })
        : await api.post<ItemMaster>('/api/item-masters', { codeGroup, itemName, baseUnit, memo });
      onDone(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
        <div>
          <label className={labelCls}>코드명(분류)</label>
          {item ? (
            <input value={item.itemCode} disabled className={`${inputCls} disabled:opacity-60`} />
          ) : (
            <select value={codeGroup} onChange={(e) => setCodeGroup(e.target.value)} required className={inputCls}>
              <option value="">선택</option>
              {groups.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label} ({g.value})
                </option>
              ))}
            </select>
          )}
          {!item && (
            <p className="mt-1 text-[12px] text-text-faint">
              {nextCode ? `부여될 코드: ${nextCode}` : '분류를 고르면 코드가 자동으로 부여됩니다.'}
            </p>
          )}
        </div>

        <div>
          <label className={labelCls}>기본단위</label>
          <select value={baseUnit} onChange={(e) => setBaseUnit(e.target.value)} className={inputCls}>
            <option value="kg">kg</option>
            <option value="EA">EA</option>
          </select>
        </div>

        <div className="col-span-2">
          <label className={labelCls}>품목명</label>
          <input
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            required
            placeholder="세금계산서·전표 출력용 정식 명칭"
            className={inputCls}
          />
        </div>

        <div className="col-span-2">
          <label className={labelCls}>비고</label>
          <input value={memo} onChange={(e) => setMemo(e.target.value)} className={inputCls} />
        </div>
      </div>

      {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}

      <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
        <button type="button" onClick={onCancel} className={outlineBtnCls}>
          취소
        </button>
        <button type="submit" disabled={submitting} className={primaryBtnCls}>
          {submitting ? '저장 중...' : item ? '수정' : '등록'}
        </button>
      </div>
    </form>
  );
}
