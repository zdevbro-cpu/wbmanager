import { useState } from 'react';
import { Settings, Building2, Package, Plus } from 'lucide-react';
import { api } from '../api/client';
import { useVendors, useItemMasters } from '../hooks/useMasters';
import { Badge } from '../components/ui/Badge';
import { FormModal } from '../components/FormModal';
import {
  pageTitleCls,
  sectionTitleCls,
  primaryBtnCls,
  outlineBtnCls,
  inputCls,
  tableWrapCls,
  thCls,
  tdCls,
  trCls,
} from '../components/ui/classes';
import type { Vendor, ItemMaster } from '../types';

const labelCls = 'mb-1.5 block text-[13px] font-semibold text-text-mid';
const show = (v?: string | null) => (v == null || v === '' ? '-' : v);

const VENDOR_TYPES = ['매입처', '매각처', '자회사', '폐기물업체'];
const USAGE_TYPES = ['공용', '매입전용', '매출전용'];
const TAX_TYPES = ['과세', '면세', '영세'];
const BASE_UNITS = ['kg', 'ton'];

// 마스터 관리 — 거래처·품목을 2열로 나란히 두고, 각 열은 목록 + 신규등록으로만 구성한다.
// 공통코드와 한 화면에 있으면 목록이 길어질수록 아래로 밀려서 별도 탭으로 분리했다.
export function MasterManagementPage({ embedded = false }: { embedded?: boolean }) {
  const { vendors, reload: reloadVendors } = useVendors();
  const { items, reload: reloadItems } = useItemMasters();

  return (
    <div>
      {!embedded && (
        <div className="mb-5 flex items-center gap-2">
          <Settings size={20} className="text-primary" />
          <h1 className={pageTitleCls}>마스터 관리</h1>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <VendorSection vendors={vendors} reload={reloadVendors} />
        <ItemSection items={items} reload={reloadItems} />
      </div>
    </div>
  );
}

function SectionHead({
  icon: Icon,
  title,
  count,
  onAdd,
}: {
  icon: typeof Building2;
  title: string;
  count: number;
  onAdd: () => void;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon size={17} className="text-primary" />
      <h2 className={sectionTitleCls}>{title}</h2>
      <span className="text-[13px] text-text-sub">{count}건</span>
      <button type="button" onClick={onAdd} className={`${primaryBtnCls} ml-auto`}>
        <Plus size={15} /> 신규등록
      </button>
    </div>
  );
}

// ── 거래처 마스터 ──────────────────────────

function VendorSection({ vendors, reload }: { vendors: Vendor[]; reload: () => void }) {
  const [open, setOpen] = useState(false);

  const promote = async (id: string) => {
    await api.patch(`/api/vendors/${id}/promote`, {});
    reload();
  };

  return (
    <section>
      <SectionHead icon={Building2} title="거래처 마스터" count={vendors.length} onAdd={() => setOpen(true)} />
      <p className="mb-3 text-[12.5px] text-text-faint">세금계산서 발행에 필요한 사업자 정보를 함께 등록합니다.</p>

      <div className={`${tableWrapCls} overflow-x-auto`}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-border">
              <th className={thCls}>거래처명</th>
              <th className={thCls}>구분</th>
              <th className={thCls}>사업자등록번호</th>
              <th className={thCls}>대표자</th>
              <th className={thCls}>담당자</th>
              <th className={thCls}>연락처</th>
              <th className={thCls}>관리</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((v) => (
              <tr key={v.id} className={trCls}>
                <td className={`${tdCls} font-semibold text-text-strong`}>
                  <span className="flex items-center gap-1.5">
                    {v.name}
                    {v.isTemporary && <Badge tone="amber">임시</Badge>}
                  </span>
                </td>
                <td className={tdCls}>{show(v.vendorType)}</td>
                <td className={`${tdCls} tabular whitespace-nowrap`}>{show(v.bizRegNo)}</td>
                <td className={tdCls}>{show(v.ceoName)}</td>
                <td className={tdCls}>{show(v.contactName)}</td>
                <td className={`${tdCls} tabular whitespace-nowrap`}>{show(v.contactPhone ?? v.phone)}</td>
                <td className={`${tdCls} whitespace-nowrap`}>
                  {v.isTemporary && (
                    <button
                      type="button"
                      onClick={() => promote(v.id)}
                      className="text-[12px] font-semibold text-primary hover:underline"
                    >
                      정식 승격
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {vendors.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-[13px] text-text-faint">
                  등록된 거래처가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <FormModal title="거래처 신규등록" icon={Building2} onClose={() => setOpen(false)}>
          <VendorForm
            onDone={() => {
              setOpen(false);
              reload();
            }}
            onCancel={() => setOpen(false)}
          />
        </FormModal>
      )}
    </section>
  );
}

function VendorForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState({
    name: '',
    vendorType: '',
    bizRegNo: '',
    corpRegNo: '',
    ceoName: '',
    bizType: '',
    bizItem: '',
    address: '',
    phone: '',
    fax: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    memo: '',
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
      await api.post('/api/vendors', f);
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
          {submitting ? '저장 중...' : '등록'}
        </button>
      </div>
    </form>
  );
}

// ── 품목 마스터 ────────────────────────────

function ItemSection({ items, reload }: { items: ItemMaster[]; reload: () => void }) {
  const [open, setOpen] = useState(false);

  const promote = async (code: string) => {
    await api.patch(`/api/item-masters/${code}/promote`, {});
    reload();
  };

  return (
    <section>
      <SectionHead icon={Package} title="품목 마스터" count={items.length} onAdd={() => setOpen(true)} />
      <p className="mb-3 text-[12.5px] text-text-faint">
        현장 호칭(별칭)이 없으면 계근표·일보 매칭이 되지 않으니 함께 등록해 주세요.
      </p>

      <div className={`${tableWrapCls} overflow-x-auto`}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-border">
              <th className={thCls}>코드</th>
              <th className={thCls}>품목명</th>
              <th className={thCls}>현장 호칭</th>
              <th className={thCls}>분류</th>
              <th className={thCls}>재질/등급</th>
              <th className={thCls}>용도</th>
              <th className={thCls}>단위</th>
              <th className={thCls}>관리</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className={trCls}>
                <td className={`${tdCls} tabular whitespace-nowrap`}>{i.itemCode}</td>
                <td className={`${tdCls} font-semibold text-text-strong`}>
                  <span className="flex items-center gap-1.5">
                    {i.itemName}
                    {i.isTemporary && <Badge tone="amber">임시</Badge>}
                    {i.isActive === false && <Badge tone="slate">미사용</Badge>}
                  </span>
                </td>
                <td className={tdCls}>{show(i.aliasNames)}</td>
                <td className={tdCls}>{[i.category, i.subCategory, i.minorCategory].filter(Boolean).join(' / ')}</td>
                <td className={tdCls}>{[i.material, i.grade].filter(Boolean).join(' / ') || '-'}</td>
                <td className={tdCls}>{show(i.usageType)}</td>
                <td className={tdCls}>{show(i.baseUnit)}</td>
                <td className={`${tdCls} whitespace-nowrap`}>
                  {i.isTemporary && (
                    <button
                      type="button"
                      onClick={() => promote(i.itemCode)}
                      className="text-[12px] font-semibold text-primary hover:underline"
                    >
                      정식 승격
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="py-10 text-center text-[13px] text-text-faint">
                  등록된 품목이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <FormModal title="품목 신규등록" icon={Package} onClose={() => setOpen(false)}>
          <ItemForm
            onDone={() => {
              setOpen(false);
              reload();
            }}
            onCancel={() => setOpen(false)}
          />
        </FormModal>
      )}
    </section>
  );
}

// data/품목마스터_설계.md 의 1~5장을 그대로 입력 항목으로 옮겼다.
// 단가·거래처별 별칭·공제 실적값은 설계상 마스터에서 분리하는 항목이라 여기에 두지 않는다.
function ItemForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState({
    itemCode: '',
    itemName: '',
    aliasNames: '',
    category: '',
    subCategory: '',
    minorCategory: '',
    material: '',
    grade: '',
    baseUnit: 'kg',
    weighUnit: '',
    purchaseUnit: '',
    salesUnit: '',
    unitFactor: '',
    usageType: '공용',
    convertToItemCode: '',
    expectedYield: '',
    deductImpurity: '',
    deductSoil: '',
    deductMoisture: '',
    zoneCode: '',
    priceRefCode: '',
    taxType: '과세',
    ecountItemCode: '',
    accountCode: '',
  });
  const [qtyManaged, setQtyManaged] = useState(false);
  const [priceLinked, setPriceLinked] = useState(false);
  const [recycleDeductible, setRecycleDeductible] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.itemCode.trim() || !f.itemName.trim() || !f.category.trim()) return;
    setError('');
    setSubmitting(true);
    try {
      await api.post('/api/item-masters', { ...f, qtyManaged, priceLinked, recycleDeductible, isActive });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <FormSection title="식별 · 분류" />
      <div className="grid grid-cols-3 gap-x-3 gap-y-3.5">
        <div>
          <label className={labelCls}>품목코드</label>
          <input value={f.itemCode} onChange={(e) => set({ itemCode: e.target.value })} required className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>품목명(정식)</label>
          <input
            value={f.itemName}
            onChange={(e) => set({ itemName: e.target.value })}
            required
            placeholder="세금계산서·전표 출력용"
            className={inputCls}
          />
        </div>

        <div className="col-span-3">
          <label className={labelCls}>현장 호칭(별칭)</label>
          <input
            value={f.aliasNames}
            onChange={(e) => set({ aliasNames: e.target.value })}
            placeholder="쉼표로 구분 — 예: 혼합철, 잡철, 고철"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>대분류</label>
          <input
            value={f.category}
            onChange={(e) => set({ category: e.target.value })}
            required
            placeholder="철스크랩 / 비철 / 기타"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>중분류</label>
          <input value={f.subCategory} onChange={(e) => set({ subCategory: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>소분류</label>
          <input value={f.minorCategory} onChange={(e) => set({ minorCategory: e.target.value })} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>재질</label>
          <input
            value={f.material}
            onChange={(e) => set({ material: e.target.value })}
            placeholder="철 / 스테인리스 / 알루미늄 / 동"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>등급</label>
          <input
            value={f.grade}
            onChange={(e) => set({ grade: e.target.value })}
            placeholder="생철 / 중량 / 경량 / 선반설"
            className={inputCls}
          />
        </div>
      </div>

      <FormSection title="단위 · 수량" />
      <div className="grid grid-cols-3 gap-x-3 gap-y-3.5">
        <div>
          <label className={labelCls}>기본단위</label>
          <select value={f.baseUnit} onChange={(e) => set({ baseUnit: e.target.value })} className={inputCls}>
            {BASE_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>계근단위</label>
          <input value={f.weighUnit} onChange={(e) => set({ weighUnit: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>환산계수</label>
          <input
            type="number"
            step="0.000001"
            value={f.unitFactor}
            onChange={(e) => set({ unitFactor: e.target.value })}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>매입단위</label>
          <input value={f.purchaseUnit} onChange={(e) => set({ purchaseUnit: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>매출단위</label>
          <input value={f.salesUnit} onChange={(e) => set({ salesUnit: e.target.value })} className={inputCls} />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-[13px] font-semibold text-text-mid">
            <input
              type="checkbox"
              checked={qtyManaged}
              onChange={(e) => setQtyManaged(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            수량관리 대상(톤백 등)
          </label>
        </div>
      </div>

      <FormSection title="스크랩 특수 항목" />
      <div className="grid grid-cols-3 gap-x-3 gap-y-3.5">
        <div>
          <label className={labelCls}>용도구분</label>
          <select value={f.usageType} onChange={(e) => set({ usageType: e.target.value })} className={inputCls}>
            {USAGE_TYPES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>전환 후 품목코드</label>
          <input
            value={f.convertToItemCode}
            onChange={(e) => set({ convertToItemCode: e.target.value })}
            placeholder="선별 후 품목"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>예상수율(%)</label>
          <input
            type="number"
            step="0.001"
            value={f.expectedYield}
            onChange={(e) => set({ expectedYield: e.target.value })}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>불순물 공제율(%)</label>
          <input
            type="number"
            step="0.001"
            value={f.deductImpurity}
            onChange={(e) => set({ deductImpurity: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>토사 공제율(%)</label>
          <input
            type="number"
            step="0.001"
            value={f.deductSoil}
            onChange={(e) => set({ deductSoil: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>함수 공제율(%)</label>
          <input
            type="number"
            step="0.001"
            value={f.deductMoisture}
            onChange={(e) => set({ deductMoisture: e.target.value })}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>기본 야적장 zone</label>
          <input
            value={f.zoneCode}
            onChange={(e) => set({ zoneCode: e.target.value })}
            placeholder="구역 표지·QR과 동일 코드"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>기준시세 코드</label>
          <input
            value={f.priceRefCode}
            onChange={(e) => set({ priceRefCode: e.target.value })}
            placeholder="고철시세 / LME"
            className={inputCls}
          />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-[13px] font-semibold text-text-mid">
            <input
              type="checkbox"
              checked={priceLinked}
              onChange={(e) => setPriceLinked(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            시세연동 품목
          </label>
        </div>
      </div>

      <FormSection title="세무 · 회계 / 상태" />
      <div className="grid grid-cols-3 gap-x-3 gap-y-3.5">
        <div>
          <label className={labelCls}>과세구분</label>
          <select value={f.taxType} onChange={(e) => set({ taxType: e.target.value })} className={inputCls}>
            {TAX_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>ecount 품목코드</label>
          <input
            value={f.ecountItemCode}
            onChange={(e) => set({ ecountItemCode: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>세무사랑 계정과목</label>
          <input value={f.accountCode} onChange={(e) => set({ accountCode: e.target.value })} className={inputCls} />
        </div>

        <div className="col-span-2 flex items-end pb-2">
          <label className="flex items-center gap-2 text-[13px] font-semibold text-text-mid">
            <input
              type="checkbox"
              checked={recycleDeductible}
              onChange={(e) => setRecycleDeductible(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            재활용폐자원 의제매입세액공제 대상
          </label>
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-[13px] font-semibold text-text-mid">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            사용
          </label>
        </div>
      </div>

      {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}

      <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
        <button type="button" onClick={onCancel} className={outlineBtnCls}>
          취소
        </button>
        <button type="submit" disabled={submitting} className={primaryBtnCls}>
          {submitting ? '저장 중...' : '등록'}
        </button>
      </div>
    </form>
  );
}

function FormSection({ title }: { title: string }) {
  return (
    <h3 className="mt-5 mb-3 border-b border-border pb-1.5 text-[14px] font-extrabold text-text-strong first:mt-0">
      {title}
    </h3>
  );
}
