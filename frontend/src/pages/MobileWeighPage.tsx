import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Loader2, Check, ScanLine, ListChecks } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useProjects, useItemMasters, useEmployees, useExternalDrivers } from '../hooks/useMasters';
import { useCertificateOcr, OCR_LABEL, type OcrFields } from '../hooks/useCertificateOcr';
import { uploadStagedFiles, type ParentType } from '../lib/uploadStaged';
import { formatPhone } from '../lib/phone';
import { kstToday, kstStamp } from '../lib/datetime';

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
  const { appUser, logout } = useAuth();
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

  const [today, setToday] = useState<TodayRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const spec = KINDS.find((k) => k.key === kind)!;

  // 오늘 내가 올린 건만 모은다. 네 곳에 나뉘어 있어 한꺼번에 읽어 시각순으로 세운다.
  const loadToday = useCallback(async () => {
    if (!appUser?.id) return;
    const day = kstToday();
    const lists = await Promise.all(
      KINDS.map(async (k) => {
        const rows = await api.get<Record<string, unknown>[]>(`${k.path}?from=${day}&to=${day}`);
        return rows
          .filter((r) => r.createdById === appUser.id)
          .map((r) => ({
            id: String(r.id),
            key: k.key,
            kind: k.label,
            vehicleNo: (r.vehicleNo as string) ?? '',
            weight: Number(r.netWeight ?? r.settledWeight ?? r.weight ?? 0),
            isDraft: r.isDraft === true,
            createdAt: String(r.createdAt ?? ''),
            raw: r,
          }));
      }),
    );
    setToday(lists.flat().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
  }, [appUser?.id]);

  useEffect(() => {
    loadToday();
  }, [loadToday]);
  const net = Number(grossWeight || 0) - Number(tareWeight || 0) - Number(lossWeight || 0);

  // 임직원과 외부 운전자를 한 목록으로 본다. 화면의 운전자 선택과 같은 곳이다.
  const driverOptions = [
    ...employees.map((e) => ({ name: e.name, phone: e.phone ?? '' })),
    ...drivers.filter((d) => !employees.some((e) => e.name === d.name)).map((d) => ({ name: d.name, phone: d.phone ?? '' })),
  ];

  // 사진에서 읽은 값으로 빈 칸만 채운다. 손으로 고친 값은 건드리지 않는다.
  const apply = (f: OcrFields) => {
    if (f.weighDate) setDate(f.weighDate);
    if (f.vehicleNo && !vehicleNo) setVehicleNo(f.vehicleNo);
    if (f.siteName && !place) setPlace(f.siteName);
    if (f.grossWeight != null && !grossWeight) setGrossWeight(String(f.grossWeight));
    if (f.tareWeight != null && !tareWeight) setTareWeight(String(f.tareWeight));
    if (f.driverName && !driverName) {
      setDriverName(f.driverName);
      const known = driverOptions.find((d) => d.name === f.driverName);
      if (known?.phone && !driverPhone) setDriverPhone(formatPhone(known.phone));
    }
    if (f.itemName && !itemCode) {
      const matched = items.find((i) => i.itemName === f.itemName);
      if (matched) setItemCode(matched.itemCode);
    }
  };

  // 이름을 고르거나 적으면 등록된 연락처를 채운다. 이미 적어 둔 번호는 건드리지 않는다.
  const pickDriver = (name: string) => {
    setDriverName(name);
    const known = driverOptions.find((d) => d.name === name.trim());
    if (known?.phone) setDriverPhone(formatPhone(known.phone));
  };

  // 목록에서 고르면 그 건의 값으로 폼을 채운다. 같은 칸에서 고치고 저장한다.
  const openRow = (row: TodayRow) => {
    const r = row.raw;
    const k = KINDS.find((x) => x.key === row.key)!;
    setKind(row.key);
    setEditingId(row.id);
    setPhoto(null);
    setPreview('');
    setProjectId(String(r.projectId ?? ''));
    setDate(String(r[k.dateField] ?? '').slice(0, 10));
    setPlace(String(r[k.placeField] ?? ''));
    setItemCode(String(r.itemCode ?? ''));
    setVehicleNo(String(r.vehicleNo ?? ''));
    setDriverName(String(r.driverName ?? ''));
    setDriverPhone(String(r.driverPhone ?? ''));
    setGrossWeight(r.grossWeight == null ? '' : String(r.grossWeight));
    setTareWeight(r.tareWeight == null ? '' : String(r.tareWeight));
    setLossWeight(r.lossWeight == null ? '' : String(r.lossWeight));
    setMemo(String(r.memo ?? ''));
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        // 사진에서 읽은 값이 섞여 있다. 사무실에서 확인하기 전까지 임시저장으로 둔다.
        ...(editingId ? {} : { isDraft: true }),
      };
      // 고치는 중이면 그 건을 수정한다. 임시저장 여부는 사무실이 정하므로 건드리지 않는다.
      const target = editingId
        ? await api.patch<{ id: string }>(`${spec.path}/${editingId}`, payload)
        : await api.post<{ id: string }>(spec.path, payload);

      // 찍은 사진을 계량증명서로 붙인다. 문서로도 자동 편입된다.
      if (photo) {
        await uploadStagedFiles([{ fileType: '계량증명서', files: [photo] }], PARENT_TYPE[kind], target.id ?? editingId!);
      }
      setSaved(true);
      loadToday();
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
    setEditingId(null);
    setError('');
  };

  if (saved) {
    return (
      <div className="mx-auto flex min-h-screen max-w-[520px] flex-col items-center justify-center gap-5 bg-bg px-5 text-center">
        <Check size={44} className="text-success" />
        <p className="text-[17px] font-extrabold text-text-strong">{spec.label} 등록을 마쳤습니다.</p>
        <p className="text-[13px] text-text-sub">
          「임시저장」으로 올라갔습니다. 사무실에서 값을 확인하고 정상등록으로 바꾸면 끝납니다.
        </p>
        <button type="button" onClick={reset} className="w-full rounded-[12px] bg-primary py-4 text-[16px] font-bold text-white">
          다음 건 등록
        </button>
        <div className="w-full text-left">
          <TodayList rows={today} onOpen={(row) => { setSaved(false); openRow(row); }} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-[520px] bg-bg px-4 pb-10 pt-4">
      <div className="mb-4 flex items-center gap-2">
        <img src="/원방로고.png" alt="원방" className="h-8 w-8 shrink-0 rounded-[9px] bg-white object-contain p-0.5" />
        <h1 className="text-[17px] font-extrabold text-text-strong">계근 등록</h1>
        <Link to="/mobile" className="ml-auto text-[12.5px] text-text-sub underline">
          출퇴근
        </Link>
        <button type="button" onClick={logout} className="text-[12.5px] text-text-sub underline">
          로그아웃
        </button>
      </div>

      {editingId && (
        <div className="mb-3 rounded-[10px] border border-primary/40 bg-primary/10 px-3 py-2.5 text-[12.5px] text-text-strong">
          오늘 올린 건을 고치는 중입니다. 유형은 바꿀 수 없습니다.
        </div>
      )}

      {/* 무엇을 계근한 것인지 먼저 고른다. 나머지 칸 구성은 같다. */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        {KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            disabled={!!editingId}
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
            <input
              list="mobile-driver-options"
              value={driverName}
              onChange={(e) => pickDriver(e.target.value)}
              placeholder="고르거나 직접 입력"
              className={field}
            />
            <datalist id="mobile-driver-options">
              {driverOptions.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.phone}
                </option>
              ))}
            </datalist>
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

        <div className="flex gap-2">
          {editingId && (
            <button
              type="button"
              onClick={reset}
              className="w-1/3 rounded-[12px] border border-border py-4 text-[15px] font-bold text-text-sub"
            >
              취소
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-[12px] bg-primary py-4 text-[16px] font-bold text-white disabled:opacity-70"
          >
            {saving ? '저장 중…' : editingId ? '수정 저장' : `${spec.label} 등록`}
          </button>
        </div>
      </form>

      <TodayList rows={today} onOpen={openRow} />
    </div>
  );
}

interface TodayRow {
  id: string;
  key: Kind;
  kind: string;
  vehicleNo: string;
  weight: number;
  isDraft: boolean;
  createdAt: string;
  /** 눌렀을 때 폼을 채우는 데 쓰는 원본 */
  raw: Record<string, unknown>;
}

// 오늘 올린 건 — 값이 맞는지 그 자리에서 훑어보는 용도다. 고치는 것은 사무실에서 한다.
function TodayList({ rows, onOpen }: { rows: TodayRow[]; onOpen: (row: TodayRow) => void }) {
  return (
    <div className="mt-8">
      <div className="mb-2 flex items-center gap-2">
        <ListChecks size={16} className="text-primary" />
        <h2 className="text-[14px] font-extrabold text-text-strong">오늘 내가 올린 건</h2>
        <span className="text-[12.5px] text-text-sub">{rows.length}건</span>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-[10px] border border-border px-3 py-4 text-center text-[12.5px] text-text-faint">
          아직 없습니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onOpen(r)}
                className="w-full rounded-[10px] border border-border px-3 py-2.5 text-left active:bg-hover"
              >
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-text-strong">{r.kind}</span>
                {r.isDraft ? (
                  <span className="rounded-[5px] bg-warning/15 px-1.5 py-0.5 text-[11px] font-bold text-warning">임시저장</span>
                ) : (
                  <span className="rounded-[5px] bg-success/15 px-1.5 py-0.5 text-[11px] font-bold text-success">정상등록</span>
                )}
                <span className="ml-auto text-[12px] text-text-faint">{kstStamp(r.createdAt).slice(11, 16)}</span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-[12.5px] text-text-sub">
                <span>{r.vehicleNo || '차량번호 없음'}</span>
                <span className="tabular">{r.weight ? `${r.weight.toLocaleString()} kg` : '-'}</span>
                <span className="ml-auto text-[12px] text-text-faint">눌러서 보기·수정</span>
              </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
