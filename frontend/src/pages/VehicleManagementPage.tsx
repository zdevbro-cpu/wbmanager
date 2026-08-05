import { useEffect, useState } from 'react';
import { Truck, Wrench, ClipboardCheck, FileText } from 'lucide-react';
import { api } from '../api/client';
import { useVehicles } from '../hooks/useMasters';
import { FileUpload } from '../components/FileUpload';
import { Badge } from '../components/ui/Badge';
import {
  pageTitleCls,
  sectionTitleCls,
  primaryBtnCls,
  outlineBtnCls,
  inputCls,
  cardPadCls,
  tableWrapCls,
  thCls,
  tdCls,
  trCls,
} from '../components/ui/classes';
import type { Vehicle, VehicleMaintenance, Attachment } from '../types';

const VEHICLE_KINDS = ['법인차량', '중장비', '어테치'];

// 차량 관련 문서 종류 — 등록 / 검사 / 정비 문서를 fileType으로 구분해 보관한다.
const VEHICLE_DOC_TYPES = ['차량등록증', '보험증서', '검사증', '기타'];

function daysUntil(dateStr?: string | null) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(diff / 86400000);
}

export function VehicleManagementPage({ embedded = false }: { embedded?: boolean }) {
  const { vehicles, reload } = useVehicles();
  const [selectedId, setSelectedId] = useState('');

  const selected = vehicles.find((v) => v.id === selectedId) ?? null;

  return (
    <div>
      {!embedded && (
        <div className="mb-5 flex items-center gap-2">
          <Truck size={20} className="text-primary" />
          <h1 className={pageTitleCls}>차량/장비 관리</h1>
        </div>
      )}

      <VehicleRegister onRegistered={reload} />

      <div className="mt-8">
        <h2 className={`${sectionTitleCls} mb-2`}>등록된 차량/중장비</h2>
        <div className={tableWrapCls}>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-y border-border">
                <th className={thCls}>차량번호</th>
                <th className={thCls}>구분</th>
                <th className={thCls}>검사 만료일</th>
                <th className={thCls}>D-day</th>
                <th className={thCls}>사용 현장</th>
                <th className={thCls}>관리</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => {
                const d = daysUntil(v.inspectionExpiry);
                return (
                  <tr key={v.id} className={trCls}>
                    <td className={tdCls}>{v.vehicleNo}</td>
                    <td className={tdCls}>{v.vehicleType ?? '-'}</td>
                    <td className={`${tdCls} tabular`}>
                      {v.inspectionExpiry ? v.inspectionExpiry.slice(0, 10) : '미등록'}
                    </td>
                    <td className={tdCls}>
                      {d === null ? (
                        <span className="text-text-faint">-</span>
                      ) : (
                        <Badge tone={d < 0 ? 'red' : d <= 30 ? 'amber' : 'green'}>
                          {d >= 0 ? `D-${d}` : `D+${-d}`}
                        </Badge>
                      )}
                    </td>
                    <td className={tdCls}>{v.currentSite ?? '-'}</td>
                    <td className={tdCls}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(selectedId === v.id ? '' : v.id)}
                        className="text-[12px] font-semibold text-primary hover:underline"
                      >
                        {selectedId === v.id ? '닫기' : '정비이력 · 문서'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {vehicles.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[13px] text-text-faint">
                    등록된 차량/중장비가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="mt-8 space-y-8">
          <InspectionSection vehicle={selected} onUpdated={reload} />
          <MaintenanceSection vehicle={selected} />
          <VehicleDocSection vehicle={selected} />
        </div>
      )}
    </div>
  );
}

function VehicleRegister({ onRegistered }: { onRegistered: () => void }) {
  const [vehicleNo, setVehicleNo] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [inspectionExpiry, setInspectionExpiry] = useState('');
  const [currentSite, setCurrentSite] = useState('');
  const [created, setCreated] = useState<Vehicle | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleNo) return;
    const vehicle = await api.post<Vehicle>('/api/vehicles', {
      vehicleNo,
      vehicleType: vehicleType || undefined,
      inspectionExpiry: inspectionExpiry || undefined,
      currentSite: currentSite || undefined,
    });
    setCreated(vehicle);
    setVehicleNo('');
    setVehicleType('');
    setInspectionExpiry('');
    setCurrentSite('');
    onRegistered();
  };

  return (
    <div>
      <h2 className={`${sectionTitleCls} mb-2`}>차량/장비 등록</h2>
      <form onSubmit={handleSubmit} className={`${cardPadCls} flex flex-wrap items-end gap-2`}>
        <div className="min-w-[140px] flex-1">
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">차량번호</label>
          <input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} className={inputCls} />
        </div>
        <div className="min-w-[130px] flex-1">
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">구분</label>
          <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className={inputCls}>
            <option value="">선택</option>
            {VEHICLE_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[150px] flex-1">
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">검사 만료일</label>
          <input type="date" value={inspectionExpiry} onChange={(e) => setInspectionExpiry(e.target.value)} className={inputCls} />
        </div>
        <div className="min-w-[130px] flex-1">
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">사용 현장</label>
          <input value={currentSite} onChange={(e) => setCurrentSite(e.target.value)} className={inputCls} />
        </div>
        <button type="submit" className={`${primaryBtnCls} shrink-0`}>
          등록
        </button>
      </form>

      {created && (
        <div className={`${cardPadCls} mt-3`}>
          <p className="mb-2 text-[13px] font-semibold text-success">
            {created.vehicleNo} 등록 완료. 차량등록증·보험증서를 첨부하세요.
          </p>
          <FileUpload label="차량등록증" fileType="차량등록증" parentType="vehicle" parentId={created.id} />
        </div>
      )}
    </div>
  );
}

// 검사관리 — 검사 만료일 수정 + 검사증 문서 등록
function InspectionSection({ vehicle, onUpdated }: { vehicle: Vehicle; onUpdated: () => void }) {
  const [expiry, setExpiry] = useState(vehicle.inspectionExpiry?.slice(0, 10) ?? '');

  useEffect(() => {
    setExpiry(vehicle.inspectionExpiry?.slice(0, 10) ?? '');
  }, [vehicle.id, vehicle.inspectionExpiry]);

  const save = async () => {
    await api.patch(`/api/vehicles/${vehicle.id}`, { inspectionExpiry: expiry || null });
    onUpdated();
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <ClipboardCheck size={16} className="text-text-sub" />
        <h2 className={sectionTitleCls}>검사관리 — {vehicle.vehicleNo}</h2>
      </div>
      <div className={`${cardPadCls} flex flex-wrap items-end gap-2`}>
        <div className="min-w-[160px]">
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">검사 만료일</label>
          <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className={inputCls} />
        </div>
        <button type="button" onClick={save} className={`${outlineBtnCls} shrink-0`}>
          저장
        </button>
      </div>
      <div className={`${cardPadCls} mt-3`}>
        <FileUpload label="검사증 첨부" fileType="검사증" parentType="vehicle" parentId={vehicle.id} />
      </div>
    </div>
  );
}

// 정비이력 — 이력 등록/조회 + 정비명세서 문서 등록
function MaintenanceSection({ vehicle }: { vehicle: Vehicle }) {
  const [maintenances, setMaintenances] = useState<VehicleMaintenance[]>([]);
  const [maintenanceDate, setMaintenanceDate] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [created, setCreated] = useState<VehicleMaintenance | null>(null);

  const load = () => {
    api.get<VehicleMaintenance[]>(`/api/vehicles/${vehicle.id}/maintenances`).then(setMaintenances);
  };

  useEffect(() => {
    load();
    setCreated(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintenanceDate) return;
    const created = await api.post<VehicleMaintenance>(`/api/vehicles/${vehicle.id}/maintenances`, {
      maintenanceDate,
      description: description || undefined,
      cost: cost ? Number(cost) : undefined,
    });
    setCreated(created);
    setMaintenanceDate('');
    setDescription('');
    setCost('');
    load();
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <Wrench size={16} className="text-text-sub" />
        <h2 className={sectionTitleCls}>정비이력 — {vehicle.vehicleNo}</h2>
      </div>

      <form onSubmit={handleSubmit} className={`${cardPadCls} mb-3 flex flex-wrap items-end gap-2`}>
        <div className="min-w-[150px]">
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">정비일</label>
          <input type="date" value={maintenanceDate} onChange={(e) => setMaintenanceDate(e.target.value)} className={inputCls} />
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">정비 내용</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
        </div>
        <div className="min-w-[130px]">
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">비용(원)</label>
          <input type="number" step="1" value={cost} onChange={(e) => setCost(e.target.value)} className={inputCls} />
        </div>
        <button type="submit" className={`${outlineBtnCls} shrink-0`}>
          등록
        </button>
      </form>

      {created && (
        <div className={`${cardPadCls} mb-3`}>
          <p className="mb-2 text-[13px] font-semibold text-success">정비이력 등록 완료. 정비명세서를 첨부하세요.</p>
          <FileUpload
            label="정비명세서"
            fileType="정비명세서"
            parentType="vehicle_maintenance"
            parentId={created.id}
          />
        </div>
      )}

      <div className={tableWrapCls}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-border">
              <th className={thCls}>정비일</th>
              <th className={thCls}>내용</th>
              <th className={thCls}>비용</th>
              <th className={thCls}>명세서</th>
            </tr>
          </thead>
          <tbody>
            {maintenances.map((m) => (
              <tr key={m.id} className={trCls}>
                <td className={`${tdCls} tabular`}>{m.maintenanceDate.slice(0, 10)}</td>
                <td className={tdCls}>{m.description ?? '-'}</td>
                <td className={`${tdCls} tabular`}>{m.cost ? Number(m.cost).toLocaleString() : '-'}</td>
                <td className={tdCls}>
                  <AttachmentLinks attachments={m.attachments} />
                </td>
              </tr>
            ))}
            {maintenances.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-[13px] text-text-faint">
                  등록된 정비이력이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 차량 관련 문서 — 차량등록증/보험증서/검사증 등
function VehicleDocSection({ vehicle }: { vehicle: Vehicle }) {
  const [docType, setDocType] = useState(VEHICLE_DOC_TYPES[0]);
  const [docs, setDocs] = useState<Attachment[]>([]);

  const load = () => {
    api.get<Attachment[]>(`/api/vehicles/${vehicle.id}/attachments`).then(setDocs);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.id]);

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <FileText size={16} className="text-text-sub" />
        <h2 className={sectionTitleCls}>차량 문서 — {vehicle.vehicleNo}</h2>
      </div>
      <div className={`${cardPadCls} space-y-3`}>
        <div className="max-w-[200px]">
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">문서 종류</label>
          <select value={docType} onChange={(e) => setDocType(e.target.value)} className={inputCls}>
            {VEHICLE_DOC_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <FileUpload
          key={docType}
          label={`${docType} 첨부`}
          fileType={docType}
          parentType="vehicle"
          parentId={vehicle.id}
          onUploaded={load}
        />
        {docs.length > 0 && (
          <ul className="space-y-1 border-t border-border pt-3">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-[13px] text-text">
                <Badge tone="blue">{d.fileType ?? '문서'}</Badge>
                {d.webViewLink ? (
                  <a href={d.webViewLink} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    {d.fileName ?? '파일'}
                  </a>
                ) : (
                  <span>{d.fileName ?? '파일'}</span>
                )}
                <span className="text-text-faint">{d.uploadedAt.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AttachmentLinks({ attachments }: { attachments?: Attachment[] }) {
  if (!attachments || attachments.length === 0) return <span className="text-text-faint">-</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((a) =>
        a.webViewLink ? (
          <a key={a.id} href={a.webViewLink} target="_blank" rel="noreferrer" className="text-[12px] text-primary hover:underline">
            {a.fileName ?? '파일'}
          </a>
        ) : (
          <span key={a.id} className="text-[12px] text-text-sub">
            {a.fileName ?? '파일'}
          </span>
        ),
      )}
    </div>
  );
}
