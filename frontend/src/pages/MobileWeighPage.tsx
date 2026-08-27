import { useRef, useState } from 'react';
import { Camera, Loader2, Check, ChevronLeft, ScanLine } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useProjects, useItemMasters, useEmployees, useExternalDrivers } from '../hooks/useMasters';
import { useCertificateOcr, OCR_LABEL, type OcrFields } from '../hooks/useCertificateOcr';
import { uploadStagedFiles, type ParentType } from '../lib/uploadStaged';
import { formatPhone } from '../lib/phone';
import { kstToday } from '../lib/datetime';

// 현장에서 휴대폰으로 계량증명서를 찍어 그 자리에서 등록한다.
// 사무실 화면을 휴대폰에 욱여넣지 않고, 한 줄에 한 칸씩 큼직하게 둔 별도 화면으로 만든다.
// 값은 대부분 사진에서 읽어 채우므로 손으로 고를 것은 유형과 프로젝트 정도다.

type Kind = 'inbound' | 'outbound' | 'waste_inbound' | 'waste_outbound';

const KINDS: { key: Kind; label: string; path: string; dateField: string; placeField: string }[] = [
  { key: 'inbound', label: '입고', path: '/api/inbounds', dateField: 'inboundDate', placeField: 'unloadingPoint' },
  { key: 'outbound', label: '출고', path: '/api/outbounds', dateField: 'outboundDate', placeField: 'loadingPoint' },
  {
    key: 'waste_inbound',
    label: '폐기물 수집·운반',
    path: '/api/waste-inbounds',
    dateField: 'receiveDate',
    placeField: 'unloadingPoint',
  },
  {
    key: 'waste_outbound',
    label: '폐기물 반출',
    path: '/api/waste-outbounds',
    dateField: 'outboundDate',
    placeField: 'loadingPoint',
  },
];

const PARENT_TYPE: Record<Kind, ParentType> = {
  inbound: 'inbound',
  outbound: 'outbound_sale',
  waste_inbound: 'waste_inbound',
  waste_outbound: 'waste_outbound',
};

const field = 'w-full rounded-[10px] border border-border bg-input px-3 py-3 text-[16px] text-input-text';
const labelCls = 'mb-1.5 block text-[13px] font-semibold text-text-mid';

export function MobileWeighPage() {
  const navigate = useNavigate();
  const { projects } = useProjects();
  const { items } = useItemMasters();
  const { employees } = useEmployees();
  const { drivers } = useExternalDrivers();
  const { ocr, ocrBusy, ocrNote, runOcr } = useCertificateOcr();

  const [kind, setKind] = useState<Kind>('inbound');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const cameraRef = useRef<HTMLInputElement>(null);

  const [projectId, setProjectId] = useState('');
  const [date, setDate] = useState(kstToday());
  const [place, setPlace] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [grossWeight, setGrossWeight] = useState('');
  const [tareWeight, setTareWeight] = useState('');
  const [lossWeight, setLossWeight] = useState('');
  const [memo, setMemo] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const spec = KINDS.find((k) => k.key === kind)!;
  const net = Number(grossWeight || 0) - Number(tareWeight || 0) - Number(lossWeight || 0);

  // 사진에서 읽은 값으로 빈 칸만 채운다. 손으로 고친 값은 건드리지 않는다.
  const apply = (f: OcrFields) => {
    if (f.weighDate) setDate(f.weighDate);
    if (f.vehicleNo && !vehicleNo) setVehicleNo(f.vehicleNo);
    if (f.siteName && !place) setPlace(f.siteName);
    if (f.grossWeight != null && !grossWeight) setGrossWeight(String(f.grossWeight));
    if (f.tareWeight != null && !tareWeight) setTareWeight(String(f.tareWeight));
    if (f.driverName && !driverName) {
      setDriverName(f.driverName);
      const known = employees.find((e) => e.name === f.driverName) ?? drivers.find((d) => d.name === f.driverName);
      if (known?.phone && !driverPhone) setDriverPhone(formatPhone(known.phone));
    }
    if (f.itemName && !itemCode) {
      const matched = items.find((i) => i.itemName === f.itemName);
      if (matched) setItemCode(matched.itemCode);
    }
  };

  const takePhoto = (picked: File[]) => {
    const file = picked[0];
    if (!file) return;
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
    runOcr([file], apply);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      setError('프로젝트를 고르세요.');
      return;
    }
    if (!grossWeight || !tareWeight) {
      setError('총중량과 공차중량을 채우세요.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        projectId,
        [spec.dateField]: date,
        [spec.placeField]: place || undefined,
        itemCode: itemCode || undefined,
        vehicleNo: vehicleNo || undefined,
        driverName: driverName || undefined,
        driverPhone: driverPhone || undefined,
        grossWeight: Number(grossWeight),
        tareWeight: Number(tareWeight),
        lossWeight: lossWeight ? Number(lossWeight) : undefined,
        memo: memo || undefined,
      };
      const created = await api.post<{ id: string }>(spec.path, payload);

      // 찍은 사진을 계량증명서로 붙인다. 문서로도 자동 편입된다.
      if (photo) {
        await uploadStagedFiles([{ fileType: '계량증명서', files: [photo] }], PARENT_TYPE[kind], created.id);
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setPhoto(null);
    setPreview('');
    setProjectId('');
    setDate(kstToday());
    setPlace('');
    setItemCode('');
    setVehicleNo('');
    setDriverName('');
    setDriverPhone('');
    setGrossWeight('');
    setTareWeight('');
    setLossWeight('');
    setMemo('');
    setSaved(false);
    setError('');
  };

  if (saved) {
    return (
      <div className="mx-auto flex min-h-screen max-w-[520px] flex-col items-center justify-center gap-5 bg-bg px-5 text-center">
        <Check size={44} className="text-success" />
        <p className="text-[17px] font-extrabold text-text-strong">{spec.label} 등록을 마쳤습니다.</p>
        <p className="text-[13px] text-text-sub">
          찍은 계량증명서도 함께 올라갔습니다. 사무실 화면에서 바로 확인할 수 있습니다.
        </p>
        <button type="button" onClick={reset} className="w-full rounded-[12px] bg-primary py-4 text-[16px] font-bold text-white">
          다음 건 등록
        </button>
        <button type="button" onClick={() => navigate('/')} className="text-[13px] text-text-sub underline">
          시작 화면으로
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-[520px] bg-bg px-4 pb-10 pt-4">
      <div className="mb-4 flex items-center gap-2">
        <button type="button" onClick={() => navigate('/')} className="rounded-[8px] p-1 text-text-sub">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[17px] font-extrabold text-text-strong">계근 등록 (모바일)</h1>
      </div>

      {/* 무엇을 계근한 것인지 먼저 고른다. 나머지 칸 구성은 같다. */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        {KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            onClick={() => setKind(k.key)}
            className={[
              'rounded-[10px] border py-3 text-[14px] font-bold',
              kind === k.key ? 'border-primary bg-primary/10 text-text-strong' : 'border-border text-text-sub',
            ].join(' ')}
          >
            {k.label}
          </button>
        ))}
      </div>

      {/* 사진 한 장이 이 화면의 출발점이다. 찍으면 아래 칸이 채워진다. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          takePhoto(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => cameraRef.current?.click()}
        disabled={ocrBusy}
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-[12px] bg-primary py-5 text-[16px] font-bold text-white disabled:opacity-70"
      >
        {ocrBusy ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
        {ocrBusy ? '인식 중…' : photo ? '다시 촬영' : '계량증명서 촬영'}
      </button>

      {preview && (
        <img src={preview} alt="촬영한 계량증명서" className="mb-3 w-full rounded-[12px] border border-border" />
      )}

      {(ocr || ocrNote) && (
        <div className="mb-4 rounded-[10px] border border-border bg-input p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-primary">
            <ScanLine size={14} /> 인식 결과
          </p>
          {ocrNote && <p className="mb-1.5 text-[12.5px] text-warning">{ocrNote}</p>}
          {ocr && (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
              {(Object.keys(OCR_LABEL) as (keyof OcrFields)[])
                .filter((k) => ocr[k] != null && ocr[k] !== '')
                .map((k) => (
                  <div key={k} className="flex justify-between gap-2 border-b border-border pb-1">
                    <dt className="text-[12px] text-text-sub">{OCR_LABEL[k]}</dt>
                    <dd className="text-[12.5px] font-semibold text-text-strong">{String(ocr[k])}</dd>
                  </div>
                ))}
            </dl>
          )}
        </div>
      )}

      <form onSubmit={submit} className="space-y-3.5">
        <div>
          <label className={labelCls}>프로젝트 *</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={field}>
            <option value="">선택</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.roundName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>계근일 *</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        </div>

        <div>
          <label className={labelCls}>제품명</label>
          <select value={itemCode} onChange={(e) => setItemCode(e.target.value)} className={field}>
            <option value="">선택</option>
            {items.map((i) => (
              <option key={i.itemCode} value={i.itemCode}>
                {i.itemName}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>총중량(kg) *</label>
            <input
              type="number"
              inputMode="numeric"
              value={grossWeight}
              onChange={(e) => setGrossWeight(e.target.value)}
              className={field}
            />
          </div>
          <div>
            <label className={labelCls}>공차중량(kg) *</label>
            <input
              type="number"
              inputMode="numeric"
              value={tareWeight}
              onChange={(e) => setTareWeight(e.target.value)}
              className={field}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>감량(kg)</label>
            <input
              type="number"
              inputMode="numeric"
              value={lossWeight}
              onChange={(e) => setLossWeight(e.target.value)}
              className={field}
            />
          </div>
          <div>
            <label className={labelCls}>실중량(자동)</label>
            <div className="rounded-[10px] border border-border bg-hover px-3 py-3 text-[16px] font-bold text-text-strong">
              {Number.isFinite(net) ? net.toLocaleString() : '-'}
            </div>
          </div>
        </div>

        <div>
          <label className={labelCls}>차량번호</label>
          <input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} className={field} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>운전자</label>
            <input value={driverName} onChange={(e) => setDriverName(e.target.value)} className={field} />
          </div>
          <div>
            <label className={labelCls}>연락처</label>
            <input
              inputMode="tel"
              value={driverPhone}
              onChange={(e) => setDriverPhone(formatPhone(e.target.value))}
              className={field}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>{kind === 'inbound' || kind === 'waste_inbound' ? '하차지' : '상차지'}</label>
          <input value={place} onChange={(e) => setPlace(e.target.value)} className={field} />
        </div>

        <div>
          <label className={labelCls}>비고</label>
          <input value={memo} onChange={(e) => setMemo(e.target.value)} className={field} />
        </div>

        {error && <p className="text-[13px] text-danger">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-[12px] bg-primary py-4 text-[16px] font-bold text-white disabled:opacity-70"
        >
          {saving ? '저장 중…' : `${spec.label} 등록`}
        </button>
      </form>
    </div>
  );
}
