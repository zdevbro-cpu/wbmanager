import { useCallback, useEffect, useState } from 'react';
import { Boxes, Plus, Eye, Car, Wrench, RotateCcw, ScanLine, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { useCommonCodes, useEmployees } from '../hooks/useMasters';
import { FormModal } from '../components/FormModal';
import { FilterField } from '../components/FilterField';
import { FileUpload } from '../components/FileUpload';
import { StagedFileUpload } from '../components/StagedFileUpload';
import { AssetMaintenanceForm } from '../components/AssetMaintenanceForm';
import { uploadStagedFiles } from '../lib/uploadStaged';
import { API_BASE_URL } from '../api/client';
import { auth } from '../lib/firebase';
import { Badge, type BadgeTone } from '../components/ui/Badge';
import { useEscapeClose } from '../hooks/useEscapeClose';
import {
  pageTitleCls,
  sectionTitleCls,
  cardCls,
  cardPadCls,
  primaryBtnCls,
  outlineBtnCls,
  inputCls,
  tableWrapCls,
  thCls,
  tdCls,
  trCls,
} from '../components/ui/classes';
import type { Asset, AssetSchedule, Employee } from '../types';

// 근거: data/차량장비_자산관리_설계정리.md
// 1차 범위 — 자산 마스터 + 유형별 상세 + 일정 + 첨부. 배정/운행일지/정비/비용은 이후 단계.
const STATUSES = ['가용', '사용중', '정비중', '수리대기', '유휴', '매각', '폐기', '분실'];
const OWNERSHIPS = ['자가', '리스', '렌트', '임차'];
const FUEL_TYPES = ['휘발유', '경유', 'LPG', '전기', '수소', '하이브리드'];

const STATUS_TONE: Record<string, BadgeTone> = {
  가용: 'green',
  사용중: 'blue',
  정비중: 'amber',
  수리대기: 'amber',
  유휴: 'slate',
  매각: 'slate',
  폐기: 'red',
  분실: 'red',
};

const show = (v?: string | number | null) => (v == null || v === '' ? '-' : String(v));
const date = (v?: string | null) => (v ? v.slice(0, 10) : '-');

function daysLeft(due?: string | null) {
  if (!due) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(due.slice(0, 10));
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function DDay({ due, alertDaysBefore = 30 }: { due?: string | null; alertDaysBefore?: number }) {
  const left = daysLeft(due);
  if (left === null) return <span className="text-text-faint">-</span>;
  if (left < 0) return <Badge tone="red">D+{Math.abs(left)} 경과</Badge>;
  if (left === 0) return <Badge tone="red">D-DAY</Badge>;
  if (left <= alertDaysBefore) return <Badge tone="red">D-{left}</Badge>;
  return <Badge tone="slate">D-{left}</Badge>;
}

export function AssetManagementPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetType, setAssetType] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [openForm, setOpenForm] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { labels: categories } = useCommonCodes('자산 분류');

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (assetType) params.set('assetType', assetType);
    if (status) params.set('status', status);
    if (category) params.set('category', category);
    if (q) params.set('q', q);
    api.get<Asset[]>(`/api/assets?${params.toString()}`).then(setAssets);
  }, [assetType, status, category, q]);

  useEffect(() => {
    load();
  }, [load]);

  // 임박한 일정이 있으면 목록에서 바로 보이게 가장 가까운 건을 뽑는다.
  const nearestSchedule = (a: Asset) =>
    (a.schedules ?? [])
      .filter((s) => s.status !== '완료')
      .sort((x, y) => new Date(x.dueDate).getTime() - new Date(y.dueDate).getTime())[0];

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <Boxes size={20} className="text-primary" />
        <h1 className={pageTitleCls}>자산 관리 (차량 · 장비)</h1>
        <span className="ml-1 text-[13px] text-text-sub">{assets.length}건</span>
        <button type="button" onClick={() => setOpenForm(true)} className={`${primaryBtnCls} ml-auto`}>
          <Plus size={15} /> 자산 등록
        </button>
      </div>

      <div
        className={`${cardCls} mb-4 grid items-end gap-3 p-3 [grid-template-columns:minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)_auto]`}
      >
        <FilterField label="자산유형">
          <select value={assetType} onChange={(e) => setAssetType(e.target.value)} className={`${inputCls} px-2`}>
            <option value="">전체</option>
            <option value="VEHICLE">차량</option>
            <option value="EQUIPMENT">장비</option>
          </select>
        </FilterField>

        <FilterField label="분류">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputCls} px-2`}>
            <option value="">전체</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="상태">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} px-2`}>
            <option value="">전체</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="검색어">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="자산번호 / 자산명 / 모델 / 차대번호"
            className={inputCls}
          />
        </FilterField>

        <button
          type="button"
          onClick={() => {
            setAssetType('');
            setCategory('');
            setStatus('');
            setQ('');
          }}
          className={`${outlineBtnCls} whitespace-nowrap px-3`}
        >
          <RotateCcw size={15} /> 초기화
        </button>
      </div>

      <div className={`${tableWrapCls} overflow-x-auto`}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-border">
              <th className={thCls}>자산번호</th>
              <th className={thCls}>유형</th>
              <th className={thCls}>분류</th>
              <th className={thCls}>자산명</th>
              <th className={thCls}>모델/규격</th>
              <th className={thCls}>차량번호/제조번호</th>
              <th className={thCls}>보유형태</th>
              <th className={thCls}>관리부서</th>
              <th className={thCls}>책임자</th>
              <th className={thCls}>위치</th>
              <th className={thCls}>상태</th>
              <th className={thCls}>다음 일정</th>
              <th className={thCls}>관리</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => {
              const next = nearestSchedule(a);
              return (
                <tr key={a.id} className={trCls}>
                  <td className={`${tdCls} tabular whitespace-nowrap`}>{a.assetNo}</td>
                  <td className={tdCls}>
                    <span className="inline-flex items-center gap-1">
                      {a.assetType === 'VEHICLE' ? <Car size={13} /> : <Wrench size={13} />}
                      {a.assetType === 'VEHICLE' ? '차량' : '장비'}
                    </span>
                  </td>
                  <td className={tdCls}>{show(a.category)}</td>
                  <td className={tdCls}>{a.name}</td>
                  <td className={tdCls}>{show(a.modelName ?? a.equipment?.spec)}</td>
                  <td className={`${tdCls} whitespace-nowrap`}>{show(a.vehicle?.plateNo ?? a.serialNo)}</td>
                  <td className={tdCls}>{show(a.ownershipType)}</td>
                  <td className={tdCls}>{show(a.ownerDept)}</td>
                  <td className={tdCls}>{show(a.manager?.name)}</td>
                  <td className={tdCls}>{show(a.location)}</td>
                  <td className={tdCls}>
                    <Badge tone={STATUS_TONE[a.status] ?? 'slate'}>{a.status}</Badge>
                  </td>
                  <td className={`${tdCls} whitespace-nowrap`}>
                    {next ? (
                      <span className="inline-flex items-center gap-1.5">
                        {next.scheduleType} {date(next.dueDate)}
                        <DDay due={next.dueDate} alertDaysBefore={next.alertDaysBefore} />
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className={tdCls}>
                    <button
                      type="button"
                      title="상세"
                      onClick={() => setDetailId(a.id)}
                      className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-text-strong"
                    >
                      <Eye size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {assets.length === 0 && (
              <tr>
                <td colSpan={13} className="py-10 text-center text-[13px] text-text-faint">
                  등록된 자산이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {openForm && (
        <FormModal title="자산 등록" icon={Boxes} onClose={() => setOpenForm(false)}>
          <AssetForm
            categories={categories}
            onCreated={() => {
              load();
              setOpenForm(false);
            }}
          />
        </FormModal>
      )}

      {detailId && <AssetDetail assetId={detailId} onClose={() => setDetailId(null)} onChanged={load} />}
    </div>
  );
}

const labelCls = 'mb-1.5 block text-[13px] font-semibold text-text-mid';

function AssetForm({ categories, onCreated }: { categories: string[]; onCreated: () => void }) {
  const { employees } = useEmployees();
  const { labels: departments } = useCommonCodes('부서');

  const [assetType, setAssetType] = useState<'VEHICLE' | 'EQUIPMENT'>('VEHICLE');
  const [form, setForm] = useState<Record<string, string>>({
    assetNo: '',
    name: '',
    category: '',
    modelName: '',
    manufacturer: '',
    serialNo: '',
    ownerDept: '',
    managerEmpId: '',
    location: '',
    ownershipType: '자가',
    acquiredAt: '',
    acquireCost: '',
    usefulLifeMonth: '',
    status: '가용',
    memo: '',
  });
  const [vehicle, setVehicle] = useState<Record<string, string>>({
    plateNo: '',
    vin: '',
    vehicleType: '',
    fuelType: '',
    yearModel: '',
    loadCapacity: '',
    currentMileage: '',
    insuranceCompany: '',
    insuranceEnd: '',
    inspectionNext: '',
    leaseCompany: '',
    leaseEnd: '',
  });
  const [equipment, setEquipment] = useState<Record<string, string>>({
    spec: '',
    powerType: '',
    licenseType: '',
    inspectionCycleMonth: '',
    inspectionNext: '',
    calibrationNext: '',
    warrantyEnd: '',
    quantity: '',
  });
  const [regFiles, setRegFiles] = useState<File[]>([]);
  const [contractFiles, setContractFiles] = useState<File[]>([]);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrNote, setOcrNote] = useState('');
  const [requiresLicense, setRequiresLicense] = useState(false);
  const [isLegalInspection, setIsLegalInspection] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (patch: Record<string, string>) => setForm({ ...form, ...patch });
  const clean = (o: Record<string, string>) =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v !== ''));

  // 보험만료·정기검사·리스만료 등 입력한 날짜는 일정으로도 만들어 알림 로직 하나로 모은다.
  const buildSchedules = () => {
    const rows: { scheduleType: string; dueDate: string }[] = [];
    if (assetType === 'VEHICLE') {
      if (vehicle.insuranceEnd) rows.push({ scheduleType: '보험만료', dueDate: vehicle.insuranceEnd });
      if (vehicle.inspectionNext) rows.push({ scheduleType: '정기검사', dueDate: vehicle.inspectionNext });
      if (vehicle.leaseEnd) rows.push({ scheduleType: '리스만료', dueDate: vehicle.leaseEnd });
    } else {
      if (equipment.inspectionNext) rows.push({ scheduleType: '정기점검', dueDate: equipment.inspectionNext });
      if (equipment.calibrationNext) rows.push({ scheduleType: '교정', dueDate: equipment.calibrationNext });
    }
    return rows;
  };

  // 차량등록증을 올리면 Gemini OCR로 읽어 빈 칸만 채운다. 이미 입력한 값은 덮어쓰지 않는다.
  const runOcr = async (picked: File[]) => {
    const file = picked[0];
    if (!file || assetType !== 'VEHICLE') return;
    setOcrBusy(true);
    setOcrNote('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/ocr/vehicle-registration`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data: { enabled: boolean; fields: Record<string, string>; error?: string } = await res.json();

      if (!data.enabled) {
        setOcrNote('OCR이 설정되지 않아 자동 인식을 건너뜁니다. 직접 입력해 주세요.');
        return;
      }
      if (data.error) setOcrNote(data.error);

      const f = data.fields ?? {};
      const filled: string[] = [];
      const fillVehicle: Record<string, string> = {};
      const fillForm: Record<string, string> = {};

      const put = (target: Record<string, string>, current: string, key: string, value?: string, label?: string) => {
        if (value && !current) {
          target[key] = value;
          if (label) filled.push(label);
        }
      };

      put(fillVehicle, vehicle.plateNo, 'plateNo', f.plateNo, '차량번호');
      put(fillVehicle, vehicle.vin, 'vin', f.vin, '차대번호');
      put(fillVehicle, vehicle.vehicleType, 'vehicleType', f.vehicleType, '차종');
      put(fillVehicle, vehicle.fuelType, 'fuelType', f.fuelType, '연료');
      put(fillVehicle, vehicle.yearModel, 'yearModel', f.yearModel, '연식');
      put(fillVehicle, vehicle.loadCapacity, 'loadCapacity', f.loadCapacity, '적재중량');
      put(fillForm, form.modelName, 'modelName', f.modelName, '모델');
      put(fillForm, form.manufacturer, 'manufacturer', f.manufacturer, '제조사');
      put(fillForm, form.serialNo, 'serialNo', f.vin, '차대번호(제조번호)');
      put(fillForm, form.name, 'name', f.modelName, '자산명');

      if (Object.keys(fillVehicle).length) setVehicle((v) => ({ ...v, ...fillVehicle }));
      if (Object.keys(fillForm).length) setForm((o) => ({ ...o, ...fillForm }));
      if (filled.length) setOcrNote(`차량등록증에서 ${filled.join(', ')} 항목을 채웠습니다. 확인 후 수정하세요.`);
      else if (!data.error) setOcrNote('인식된 값이 없거나 이미 입력된 항목뿐입니다.');
    } catch {
      setOcrNote('인식에 실패했습니다. 직접 입력해 주세요.');
    } finally {
      setOcrBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const asset = await api.post<{ id: string }>('/api/assets', {
        ...clean(form),
        assetType,
        ...(assetType === 'VEHICLE'
          ? { vehicle: clean(vehicle) }
          : { equipment: { ...clean(equipment), requiresLicense, isLegalInspection } }),
        schedules: buildSchedules(),
      });
      // 첨부는 자산 id가 있어야 붙일 수 있어 등록 성공 후 올린다.
      await uploadStagedFiles(
        [
          { fileType: '차량등록증', files: regFiles },
          { fileType: '계약서', files: contractFiles },
        ],
        'asset',
        asset.id,
      );
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-3 gap-x-3 gap-y-3.5">
        <div>
          <label className={labelCls}>자산유형</label>
          <select
            value={assetType}
            onChange={(e) => setAssetType(e.target.value as 'VEHICLE' | 'EQUIPMENT')}
            className={inputCls}
          >
            <option value="VEHICLE">차량</option>
            <option value="EQUIPMENT">장비</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>자산번호</label>
          <input
            value={form.assetNo}
            onChange={(e) => set({ assetNo: e.target.value })}
            required
            placeholder={assetType === 'VEHICLE' ? 'V-2026-001' : 'E-2026-001'}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>분류</label>
          <input list="asset-categories" value={form.category} onChange={(e) => set({ category: e.target.value })} className={inputCls} />
          <datalist id="asset-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div>
          <label className={labelCls}>자산명</label>
          <input value={form.name} onChange={(e) => set({ name: e.target.value })} required className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>모델/규격</label>
          <input value={form.modelName} onChange={(e) => set({ modelName: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>제조사</label>
          <input value={form.manufacturer} onChange={(e) => set({ manufacturer: e.target.value })} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>제조번호/차대번호</label>
          <input value={form.serialNo} onChange={(e) => set({ serialNo: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>관리부서</label>
          <input list="asset-depts" value={form.ownerDept} onChange={(e) => set({ ownerDept: e.target.value })} className={inputCls} />
          <datalist id="asset-depts">
            {departments.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </div>
        <div>
          <label className={labelCls}>관리 책임자</label>
          <select value={form.managerEmpId} onChange={(e) => set({ managerEmpId: e.target.value })} className={inputCls}>
            <option value="">선택</option>
            {employees.map((emp: Employee) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>보관/주차 위치</label>
          <input value={form.location} onChange={(e) => set({ location: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>보유형태</label>
          <select value={form.ownershipType} onChange={(e) => set({ ownershipType: e.target.value })} className={inputCls}>
            {OWNERSHIPS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>상태</label>
          <select value={form.status} onChange={(e) => set({ status: e.target.value })} className={inputCls}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>취득일</label>
          <input type="date" value={form.acquiredAt} onChange={(e) => set({ acquiredAt: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>취득가액(원)</label>
          <input type="number" value={form.acquireCost} onChange={(e) => set({ acquireCost: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>내용연수(개월)</label>
          <input
            type="number"
            value={form.usefulLifeMonth}
            onChange={(e) => set({ usefulLifeMonth: e.target.value })}
            className={inputCls}
          />
        </div>

        <p className="col-span-3 border-t border-border pt-3 text-[13px] font-bold text-text-strong">
          {assetType === 'VEHICLE' ? '차량 상세' : '장비 상세'}
          <span className="ml-1 text-[12px] font-normal text-text-faint">
            — 입력한 만료·점검일은 자산 일정으로 등록되어 만료 알림에 표시됩니다.
          </span>
        </p>

        {assetType === 'VEHICLE' ? (
          <>
            <div>
              <label className={labelCls}>차량번호</label>
              <input value={vehicle.plateNo} onChange={(e) => setVehicle({ ...vehicle, plateNo: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>차종</label>
              <input
                value={vehicle.vehicleType}
                onChange={(e) => setVehicle({ ...vehicle, vehicleType: e.target.value })}
                placeholder="승용/승합/화물/특수"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>연료</label>
              <select value={vehicle.fuelType} onChange={(e) => setVehicle({ ...vehicle, fuelType: e.target.value })} className={inputCls}>
                <option value="">선택</option>
                {FUEL_TYPES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>차대번호(VIN)</label>
              <input value={vehicle.vin} onChange={(e) => setVehicle({ ...vehicle, vin: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>연식</label>
              <input value={vehicle.yearModel} onChange={(e) => setVehicle({ ...vehicle, yearModel: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>적재중량</label>
              <input
                value={vehicle.loadCapacity}
                onChange={(e) => setVehicle({ ...vehicle, loadCapacity: e.target.value })}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>현재 주행거리(km)</label>
              <input
                type="number"
                value={vehicle.currentMileage}
                onChange={(e) => setVehicle({ ...vehicle, currentMileage: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>보험사</label>
              <input
                value={vehicle.insuranceCompany}
                onChange={(e) => setVehicle({ ...vehicle, insuranceCompany: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>보험 만료일</label>
              <input
                type="date"
                value={vehicle.insuranceEnd}
                onChange={(e) => setVehicle({ ...vehicle, insuranceEnd: e.target.value })}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>다음 정기검사일</label>
              <input
                type="date"
                value={vehicle.inspectionNext}
                onChange={(e) => setVehicle({ ...vehicle, inspectionNext: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>리스/렌트사</label>
              <input
                value={vehicle.leaseCompany}
                onChange={(e) => setVehicle({ ...vehicle, leaseCompany: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>리스 만료일</label>
              <input
                type="date"
                value={vehicle.leaseEnd}
                onChange={(e) => setVehicle({ ...vehicle, leaseEnd: e.target.value })}
                className={inputCls}
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className={labelCls}>규격/용량</label>
              <input value={equipment.spec} onChange={(e) => setEquipment({ ...equipment, spec: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>동력</label>
              <input
                value={equipment.powerType}
                onChange={(e) => setEquipment({ ...equipment, powerType: e.target.value })}
                placeholder="전기/유압/공압/엔진"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>수량</label>
              <input
                type="number"
                value={equipment.quantity}
                onChange={(e) => setEquipment({ ...equipment, quantity: e.target.value })}
                className={inputCls}
              />
            </div>

            <div className="flex items-end gap-4 pb-2">
              <label className="flex items-center gap-2 text-[13px] font-semibold text-text-mid">
                <input
                  type="checkbox"
                  checked={requiresLicense}
                  onChange={(e) => setRequiresLicense(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                자격 필요
              </label>
              <label className="flex items-center gap-2 text-[13px] font-semibold text-text-mid">
                <input
                  type="checkbox"
                  checked={isLegalInspection}
                  onChange={(e) => setIsLegalInspection(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                법정검사 대상
              </label>
            </div>
            <div>
              <label className={labelCls}>필요 면허/자격</label>
              <input
                value={equipment.licenseType}
                onChange={(e) => setEquipment({ ...equipment, licenseType: e.target.value })}
                placeholder="지게차운전기능사 등"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>점검 주기(개월)</label>
              <input
                type="number"
                value={equipment.inspectionCycleMonth}
                onChange={(e) => setEquipment({ ...equipment, inspectionCycleMonth: e.target.value })}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>다음 점검일</label>
              <input
                type="date"
                value={equipment.inspectionNext}
                onChange={(e) => setEquipment({ ...equipment, inspectionNext: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>다음 교정일</label>
              <input
                type="date"
                value={equipment.calibrationNext}
                onChange={(e) => setEquipment({ ...equipment, calibrationNext: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>보증 만료일</label>
              <input
                type="date"
                value={equipment.warrantyEnd}
                onChange={(e) => setEquipment({ ...equipment, warrantyEnd: e.target.value })}
                className={inputCls}
              />
            </div>
          </>
        )}

        <div className="col-span-3">
          <label className={labelCls}>비고</label>
          <input value={form.memo} onChange={(e) => set({ memo: e.target.value })} className={inputCls} />
        </div>

        <p className="col-span-3 border-t border-border pt-3 text-[13px] font-bold text-text-strong">
          첨부 서류
          {assetType === 'VEHICLE' && (
            <span className="ml-1 text-[12px] font-normal text-text-faint">
              — 차량등록증을 올리면 차량번호·차대번호·차종·연료·연식을 자동으로 읽어 빈 칸을 채웁니다.
            </span>
          )}
        </p>

        <StagedFileUpload
          label={assetType === 'VEHICLE' ? '차량등록증' : '규격서 · 매뉴얼'}
          files={regFiles}
          setFiles={setRegFiles}
          onAdd={runOcr}
          busy={ocrBusy}
          hint={assetType === 'VEHICLE' ? '올리면 차량 정보를 자동 인식합니다' : undefined}
        />
        <StagedFileUpload label="계약서" files={contractFiles} setFiles={setContractFiles} hint="리스·렌트·매매 계약서" />

        {ocrNote && (
          <p className="col-span-3 flex items-center gap-1.5 text-[12.5px] text-primary">
            <ScanLine size={14} /> {ocrNote}
          </p>
        )}
      </div>

      {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}

      <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
        <button type="submit" disabled={submitting} className={primaryBtnCls}>
          {submitting ? '등록 중...' : '등록'}
        </button>
      </div>
    </form>
  );
}

function AssetDetail({ assetId, onClose, onChanged }: { assetId: string; onClose: () => void; onChanged: () => void }) {
  useEscapeClose(onClose);
  const [asset, setAsset] = useState<Asset | null>(null);
  const { labels: scheduleTypes } = useCommonCodes('일정 구분');
  const [scheduleType, setScheduleType] = useState('');
  const [addingMaint, setAddingMaint] = useState(false);
  const [moveDate, setMoveDate] = useState('');
  const [moveTo, setMoveTo] = useState('');
  const [dueDate, setDueDate] = useState('');

  const load = useCallback(() => {
    api.get<Asset>(`/api/assets/${assetId}`).then(setAsset);
  }, [assetId]);

  useEffect(() => {
    load();
  }, [load]);

  const addSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleType || !dueDate) return;
    await api.post(`/api/assets/${assetId}/schedules`, { scheduleType, dueDate });
    setScheduleType('');
    setDueDate('');
    load();
    onChanged();
  };

  const completeSchedule = async (s: AssetSchedule) => {
    await api.patch(`/api/assets/${assetId}/schedules/${s.id}`, {
      status: '완료',
      completedAt: new Date().toISOString().slice(0, 10),
    });
    load();
    onChanged();
  };

  const changeStatus = async (status: string) => {
    await api.patch(`/api/assets/${assetId}`, { status });
    load();
    onChanged();
  };

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/50 p-6">
      <div className="w-full max-w-[820px] rounded-[14px] border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[16px] font-extrabold text-text-strong">
            <Boxes size={17} className="text-primary" /> {asset?.assetNo} {asset?.name}
          </h2>
          <button type="button" onClick={onClose} className={outlineBtnCls}>
            닫기
          </button>
        </div>

        {!asset ? (
          <p className="text-[13px] text-text-sub">불러오는 중...</p>
        ) : (
          <>
            <dl className="mb-5 grid grid-cols-3 gap-x-5 gap-y-2">
              {[
                { label: '유형', value: asset.assetType === 'VEHICLE' ? '차량' : '장비' },
                { label: '분류', value: show(asset.category) },
                { label: '모델/규격', value: show(asset.modelName) },
                { label: '제조사', value: show(asset.manufacturer) },
                { label: '제조/차대번호', value: show(asset.serialNo) },
                { label: '보유형태', value: show(asset.ownershipType) },
                { label: '관리부서', value: show(asset.ownerDept) },
                { label: '책임자', value: show(asset.manager?.name) },
                { label: '위치', value: show(asset.location) },
                { label: '취득일', value: date(asset.acquiredAt) },
                { label: '취득가액', value: asset.acquireCost ? Number(asset.acquireCost).toLocaleString() : '-' },
                { label: '내용연수(개월)', value: show(asset.usefulLifeMonth) },
                ...(asset.assetType === 'VEHICLE'
                  ? [
                      { label: '차량번호', value: show(asset.vehicle?.plateNo) },
                      { label: '차종', value: show(asset.vehicle?.vehicleType) },
                      { label: '연료', value: show(asset.vehicle?.fuelType) },
                      { label: '주행거리(km)', value: show(asset.vehicle?.currentMileage) },
                      { label: '보험사', value: show(asset.vehicle?.insuranceCompany) },
                      { label: '보험 만료', value: date(asset.vehicle?.insuranceEnd) },
                      { label: '다음 정기검사', value: date(asset.vehicle?.inspectionNext) },
                      { label: '리스사', value: show(asset.vehicle?.leaseCompany) },
                      { label: '리스 만료', value: date(asset.vehicle?.leaseEnd) },
                    ]
                  : [
                      { label: '규격/용량', value: show(asset.equipment?.spec) },
                      { label: '동력', value: show(asset.equipment?.powerType) },
                      { label: '수량', value: show(asset.equipment?.quantity) },
                      { label: '자격 필요', value: asset.equipment?.requiresLicense ? `O (${show(asset.equipment?.licenseType)})` : '-' },
                      { label: '법정검사', value: asset.equipment?.isLegalInspection ? 'O' : '-' },
                      { label: '점검주기(개월)', value: show(asset.equipment?.inspectionCycleMonth) },
                      { label: '다음 점검', value: date(asset.equipment?.inspectionNext) },
                      { label: '다음 교정', value: date(asset.equipment?.calibrationNext) },
                      { label: '보증 만료', value: date(asset.equipment?.warrantyEnd) },
                    ]),
                { label: '비고', value: show(asset.memo) },
              ].map((f) => (
                <div key={f.label} className="flex justify-between gap-3 border-b border-border pb-1.5">
                  <dt className="text-[12.5px] text-text-sub">{f.label}</dt>
                  <dd className="text-[13px] font-semibold text-text-strong">{f.value}</dd>
                </div>
              ))}
            </dl>

            <div className="mb-5 flex items-center gap-2">
              <span className="text-[13px] font-semibold text-text-mid">상태</span>
              <select value={asset.status} onChange={(e) => changeStatus(e.target.value)} className={`${inputCls} w-[140px]`}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <span className="text-[12px] text-text-faint">자산은 삭제하지 않고 상태(매각/폐기)로 종료합니다.</span>
            </div>

            <div className="mb-5">
              <h3 className={`${sectionTitleCls} mb-2 text-[15px]`}>일정 (보험·검사·점검·교정·리스)</h3>
              <form onSubmit={addSchedule} className="mb-2 flex gap-2">
                <select value={scheduleType} onChange={(e) => setScheduleType(e.target.value)} className={`${inputCls} w-[150px]`}>
                  <option value="">구분 선택</option>
                  {scheduleTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={`${inputCls} w-[150px]`} />
                <button type="submit" className={`${primaryBtnCls} shrink-0 whitespace-nowrap px-4`}>
                  일정 추가
                </button>
              </form>

              <div className={tableWrapCls}>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-y border-border">
                      <th className={thCls}>구분</th>
                      <th className={thCls}>예정일</th>
                      <th className={thCls}>D-day</th>
                      <th className={thCls}>상태</th>
                      <th className={thCls}>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(asset.schedules ?? []).map((s) => (
                      <tr key={s.id} className={trCls}>
                        <td className={tdCls}>{s.scheduleType}</td>
                        <td className={`${tdCls} tabular`}>{date(s.dueDate)}</td>
                        <td className={tdCls}>
                          {s.status === '완료' ? <span className="text-text-faint">-</span> : <DDay due={s.dueDate} alertDaysBefore={s.alertDaysBefore} />}
                        </td>
                        <td className={tdCls}>
                          <Badge tone={s.status === '완료' ? 'green' : 'amber'}>{s.status}</Badge>
                        </td>
                        <td className={tdCls}>
                          {s.status !== '완료' && (
                            <button type="button" onClick={() => completeSchedule(s)} className="text-[12px] font-bold text-primary">
                              완료 처리
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {(asset.schedules ?? []).length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-[13px] text-text-faint">
                          등록된 일정이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mb-5">
              <div className="mb-2 flex items-center gap-2">
                <h3 className={`${sectionTitleCls} text-[15px]`}>정비 이력</h3>
                <button
                  type="button"
                  onClick={() => setAddingMaint(!addingMaint)}
                  className={`${outlineBtnCls} ml-auto h-8 px-3 text-[12.5px]`}
                >
                  <Plus size={14} /> 정비 등록
                </button>
              </div>

              {addingMaint && (
                <div className="mb-3">
                  <AssetMaintenanceForm
                    assetId={assetId}
                    onDone={() => {
                      setAddingMaint(false);
                      load();
                      onChanged();
                    }}
                    onCancel={() => setAddingMaint(false)}
                  />
                </div>
              )}

              <div className={tableWrapCls}>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-y border-border">
                      <th className={thCls}>구분</th>
                      <th className={thCls}>완료일</th>
                      <th className={thCls}>업체</th>
                      <th className={thCls}>조치</th>
                      <th className={thCls}>계기판</th>
                      <th className={thCls}>비용</th>
                      <th className={thCls}>다음 예정</th>
                      <th className={thCls}>상태</th>
                      <th className={thCls}>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(asset.maintenances ?? []).map((m) => (
                      <tr key={m.id} className={trCls}>
                        <td className={tdCls}>{m.maintType}</td>
                        <td className={`${tdCls} tabular`}>{date(m.completedAt)}</td>
                        <td className={tdCls}>{show(m.vendor?.name)}</td>
                        <td className={tdCls}>{show(m.action ?? m.symptom)}</td>
                        <td className={`${tdCls} tabular`}>{show(m.mileageAt)}</td>
                        <td className={`${tdCls} tabular`}>{m.cost ? Number(m.cost).toLocaleString() : '-'}</td>
                        <td className={`${tdCls} tabular`}>{date(m.nextDueDate)}</td>
                        <td className={tdCls}>
                          <Badge tone={m.status === '완료' ? 'green' : 'amber'}>{m.status}</Badge>
                        </td>
                        <td className={tdCls}>
                          <button
                            type="button"
                            title="삭제"
                            onClick={async () => {
                              if (!window.confirm('이 정비 이력을 삭제하시겠습니까?')) return;
                              await api.del(`/api/assets/${assetId}/maintenances/${m.id}`);
                              load();
                              onChanged();
                            }}
                            className="text-text-faint hover:text-danger"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(asset.maintenances ?? []).length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-6 text-center text-[13px] text-text-faint">
                          등록된 정비 이력이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mb-5">
              <h3 className={`${sectionTitleCls} mb-2 text-[15px]`}>이동 이력</h3>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!moveDate) return;
                  await api.post(`/api/assets/${assetId}/movements`, {
                    moveDate,
                    fromSite: asset.location || undefined,
                    toSite: moveTo || undefined,
                  });
                  setMoveDate('');
                  setMoveTo('');
                  load();
                  onChanged();
                }}
                className="mb-2 flex gap-2"
              >
                <input type="date" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} className={`${inputCls} w-[150px]`} />
                <input
                  value={moveTo}
                  onChange={(e) => setMoveTo(e.target.value)}
                  placeholder="도착지(현장)"
                  className={`${inputCls} w-[200px]`}
                />
                <button type="submit" className={`${primaryBtnCls} shrink-0 whitespace-nowrap px-4`}>
                  이동 등록
                </button>
              </form>

              <div className={tableWrapCls}>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-y border-border">
                      <th className={thCls}>이동일</th>
                      <th className={thCls}>출발지</th>
                      <th className={thCls}>도착지</th>
                      <th className={thCls}>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(asset.movements ?? []).map((mv) => (
                      <tr key={mv.id} className={trCls}>
                        <td className={`${tdCls} tabular`}>{date(mv.moveDate)}</td>
                        <td className={tdCls}>{show(mv.fromSite)}</td>
                        <td className={tdCls}>{show(mv.toSite)}</td>
                        <td className={tdCls}>
                          <button
                            type="button"
                            title="삭제"
                            onClick={async () => {
                              if (!window.confirm('이 이동 이력을 삭제하시겠습니까?')) return;
                              await api.del(`/api/assets/${assetId}/movements/${mv.id}`);
                              load();
                              onChanged();
                            }}
                            className="text-text-faint hover:text-danger"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(asset.movements ?? []).length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-[13px] text-text-faint">
                          등록된 이동 이력이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={cardPadCls}>
              <h3 className={`${sectionTitleCls} mb-2 text-[15px]`}>첨부 서류</h3>
              {(asset.attachments ?? []).length > 0 && (
                <ul className="mb-3 space-y-1">
                  {(asset.attachments ?? []).map((a) => (
                    <li key={a.id} className="text-[13px]">
                      <span className="text-text-sub">{a.fileType ?? '문서'} </span>
                      {a.webViewLink ? (
                        <a href={a.webViewLink} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          {a.fileName ?? '파일'}
                        </a>
                      ) : (
                        <span>{a.fileName ?? '파일'}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <FileUpload label="차량등록증 · 보험증권 · 검사증 · 매뉴얼 등" fileType="자산서류" parentType="asset" parentId={asset.id} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
