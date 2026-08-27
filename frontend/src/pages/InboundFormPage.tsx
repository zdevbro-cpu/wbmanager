import { useState } from 'react';
import { Truck, CheckCircle2, AlertTriangle, ScanLine } from 'lucide-react';
import { api, API_BASE_URL } from '../api/client';
import { registerVehicleAfterSave } from '../lib/vehicleRegister';
import { auth } from '../lib/firebase';
import { formatPhone } from '../lib/phone';
import { useProjects, useItemMasters, useCommonCodes, useEmployees } from '../hooks/useMasters';
import { MasterSelect } from '../components/MasterSelect';
import { VehicleDriverFields } from '../components/VehicleDriverFields';
import { FileUpload } from '../components/FileUpload';
import { StagedFileUpload } from '../components/StagedFileUpload';
import { NumberInput } from '../components/ui/NumberInput';
import { formatNumber } from '../lib/number';
import { uploadStagedFiles } from '../lib/uploadStaged';
import { pageTitleCls, cardPadCls, primaryBtnCls, outlineBtnCls, inputCls } from '../components/ui/classes';
import type { Inbound } from '../types';
import { DateField } from '../components/ui/DateField';

interface Props {
  embedded?: boolean;
  onCreated?: () => void;
  /** 넘기면 수정 모드 — 값이 채워진 채로 열리고 저장 시 PATCH한다. */
  record?: Inbound | null;
  onSaved?: () => void;
}

// 수정 모드 초기값 — 날짜는 YYYY-MM-DD, 숫자는 문자열로 맞춰 넣는다.
const initDate = (v?: string | null) => (v ? v.slice(0, 10) : '');
const initNum = (v?: string | number | null) => (v == null ? '' : String(Number(v)));

interface OcrFields {
  weighDate?: string;
  vehicleNo?: string;
  driverName?: string;
  itemName?: string;
  grossWeight?: number | null;
  tareWeight?: number | null;
  netWeight?: number | null;
  companyName?: string;
  siteName?: string;
}

const OCR_LABEL: Record<keyof OcrFields, string> = {
  weighDate: '계량일',
  vehicleNo: '차량번호',
  driverName: '운전자',
  itemName: '품명',
  grossWeight: '총중량',
  tareWeight: '공차중량',
  netWeight: '실중량',
  companyName: '업체명',
  siteName: '현장/하차지',
};

export function InboundFormPage({ embedded = false, onCreated, record = null, onSaved }: Props = {}) {
  const { projects } = useProjects();
  const { employees } = useEmployees();
  const { items, quickCreate: quickCreateItem } = useItemMasters();
  const { labels: unloadingPointOptions } = useCommonCodes('하차지');
  const isEdit = !!record;

  const [projectId, setProjectId] = useState(record?.projectId ?? '');
  const [inboundDate, setInboundDate] = useState(initDate(record?.inboundDate));
  const [unloadingPoint, setUnloadingPoint] = useState(record?.unloadingPoint ?? '');
  const [vehicleType, setVehicleType] = useState(record?.vehicleType ?? '');
  const [vehicleNo, setVehicleNo] = useState(record?.vehicleNo ?? '');
  const [driverName, setDriverName] = useState(record?.driverName ?? '');
  const [driverPhone, setDriverPhone] = useState(record?.driverPhone ?? '');
  const [itemCode, setItemCode] = useState(record?.itemCode ?? '');
  const [grossWeight, setGrossWeight] = useState(initNum(record?.grossWeight));
  const [tareWeight, setTareWeight] = useState(initNum(record?.tareWeight));
  const [lossWeight, setLossWeight] = useState(initNum(record?.lossWeight));
  const [stockWeight, setStockWeight] = useState(initNum(record?.stockWeight));
  const [memo, setMemo] = useState(record?.memo ?? '');
  const [certFiles, setCertFiles] = useState<File[]>([]);
  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [ocr, setOcr] = useState<OcrFields | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrNote, setOcrNote] = useState('');
  const [created, setCreated] = useState<Inbound | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setProjectId('');
    setInboundDate('');
    setUnloadingPoint('');
    setVehicleType('');
    setVehicleNo('');
    setDriverName('');
    setDriverPhone('');
    setItemCode('');
    setGrossWeight('');
    setTareWeight('');
    setLossWeight('');
    setStockWeight('');
    setMemo('');
    setCertFiles([]);
    setRefFiles([]);
    setOcr(null);
    setOcrNote('');
    setCreated(null);
    setError('');
  };

  // 입고량 = 총중량 - 공차중량 - 감량 (원본 엑셀 / ecount 구매입력 기준)
  const netWeightNum =
    grossWeight && tareWeight
      ? Number(grossWeight) - Number(tareWeight) - Number(lossWeight || 0)
      : null;
  // 입력창에 넣을 원시값과 화면에 보여 줄 포맷값을 분리한다. 콤마가 붙은 값을 입력창에 넣으면 안 된다.
  const netWeightRaw = netWeightNum === null ? '' : String(Number(netWeightNum.toFixed(3)));
  const netWeight = formatNumber(netWeightNum);

  // 재고반영중량은 ecount 필수 항목이며 입고량과 일치해야 한다. 미입력 시 입고량을 그대로 사용한다.
  const stockWeightValue = stockWeight === '' ? netWeightRaw : stockWeight;
  const stockMismatch =
    netWeightNum !== null && stockWeight !== '' && Number(stockWeight) !== netWeightNum;

  // 계량증명서를 올리면 OCR로 계근 항목을 읽어 빈 칸만 채운다.
  // 이미 입력한 값은 덮어쓰지 않고, 인식 결과는 아래에 그대로 표시해 손으로 고칠 수 있게 한다.
  const runOcr = async (picked: File[]) => {
    const file = picked[0];
    if (!file) return;
    setOcrBusy(true);
    setOcrNote('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/ocr/weighing-certificate`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data: { enabled: boolean; fields: OcrFields; error?: string } = await res.json();

      if (!data.enabled) {
        setOcrNote('OCR이 설정되지 않아 자동 인식을 건너뜁니다. 직접 입력해 주세요.');
        return;
      }
      if (data.error) setOcrNote(data.error);

      const f = data.fields ?? {};
      setOcr(f);
      if (f.weighDate && !inboundDate) setInboundDate(f.weighDate);
      if (f.vehicleNo && !vehicleNo) setVehicleNo(f.vehicleNo);
      if (f.driverName && !driverName) {
        setDriverName(f.driverName);
        // 계근표에는 연락처가 찍히지 않는다. 이름이 임직원 마스터에 있으면 거기서 가져와 채운다.
        const matchedDriver = employees.find((e) => e.name === f.driverName);
        if (matchedDriver?.phone && !driverPhone) setDriverPhone(formatPhone(matchedDriver.phone));
      }
      if (f.siteName && !unloadingPoint) setUnloadingPoint(f.siteName);
      if (f.grossWeight != null && !grossWeight) setGrossWeight(String(f.grossWeight));
      if (f.tareWeight != null && !tareWeight) setTareWeight(String(f.tareWeight));
      if (f.itemName && !itemCode) {
        const matched = items.find((i) => i.itemName === f.itemName);
        if (matched) setItemCode(matched.itemCode);
      }
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
      const payload = {
        projectId,
        inboundDate,
        unloadingPoint: unloadingPoint || undefined,
        vehicleType: vehicleType || undefined,
        vehicleNo: vehicleNo || undefined,
        driverName: driverName || undefined,
        driverPhone: driverPhone || undefined,
        itemCode: itemCode || undefined,
        grossWeight: Number(grossWeight),
        tareWeight: Number(tareWeight),
        lossWeight: lossWeight ? Number(lossWeight) : undefined,
        stockWeight: stockWeight ? Number(stockWeight) : undefined,
        memo: memo || undefined,
      };
      const inbound = isEdit
        ? await api.patch<Inbound>(`/api/inbounds/${record.id}`, payload)
        : await api.post<Inbound>('/api/inbounds', payload);

      // 저장이 끝난 뒤에 차량번호를 목록에 올린다. 번호 꼴이 아닌 값은 올리지 않는다.
      await registerVehicleAfterSave(vehicleNo, vehicleType);
      // 첨부는 부모 id가 있어야 붙일 수 있어 저장 성공 후 올린다.
      await uploadStagedFiles(
        [
          { fileType: '계량증명서', files: certFiles },
          { fileType: '참고서류', files: refFiles },
        ],
        'inbound',
        inbound.id,
      );
      setCertFiles([]);
      setRefFiles([]);
      if (isEdit) {
        onSaved?.();
      } else {
        setCreated(inbound);
        onCreated?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : isEdit ? '수정 실패' : '등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const labelCls = 'mb-1.5 block text-[13px] font-semibold text-text-mid';

  return (
    <div className={embedded ? '' : 'max-w-[720px]'}>
      {!embedded && (
        <div className="mb-5 flex items-center gap-2">
          <Truck size={20} className="text-primary" />
          <h1 className={pageTitleCls}>입고(반입) 등록</h1>
        </div>
      )}

      <form onSubmit={handleSubmit} className={`${cardPadCls} space-y-4`}>
        {/* 3열 그리드 — 모달 폭은 그대로 두고 한 행에 세 항목씩 배치한다. */}
        <div className="grid grid-cols-4 gap-x-3 gap-y-3.5">
          <div>
            <label className={labelCls}>프로젝트</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} required className={inputCls}>
              <option value="">선택</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.roundName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>상차일(계근일)</label>
            <DateField value={inboundDate} onChange={(e) => setInboundDate(e.target.value)} required className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>하차지</label>
            {/* 등록할 때 적은 값은 저장 시 하차지 목록에 쌓여, 다음부터 골라 쓸 수 있다. */}
            <input
              list="in-unloading-points"
              value={unloadingPoint}
              onChange={(e) => setUnloadingPoint(e.target.value)}
              placeholder="원방 / 세화철강 / 선진알앤디 등"
              className={inputCls}
            />
            <datalist id="in-unloading-points">
              {unloadingPointOptions.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>


          <div className="col-span-2">
            <MasterSelect
              label="제품명(품목)"
              options={items.map((i) => ({ value: i.itemCode, label: `${i.itemName} (${i.itemCode})`, isTemporary: i.isTemporary }))}
              value={itemCode}
              onChange={setItemCode}
              onQuickCreate={quickCreateItem}
            />
          </div>

          <div>
            <label className={labelCls}>총중량(kg)</label>
            <NumberInput value={grossWeight} onChange={setGrossWeight} decimals={3} required />
          </div>

          <div>
            <label className={labelCls}>공차중량(kg)</label>
            <NumberInput value={tareWeight} onChange={setTareWeight} decimals={3} required />
          </div>

          <div>
            <label className={labelCls}>감량(kg)</label>
            <NumberInput value={lossWeight} onChange={setLossWeight} decimals={3} />
          </div>

          <div>
            <label className={labelCls}>재고반영중량(kg)</label>
            <NumberInput value={stockWeightValue} onChange={setStockWeight} decimals={3} />
          </div>

          <VehicleDriverFields
            vehicleType={vehicleType}
            setVehicleType={setVehicleType}
            vehicleNo={vehicleNo}
            setVehicleNo={setVehicleNo}
            driverName={driverName}
            setDriverName={setDriverName}
            driverPhone={driverPhone}
            setDriverPhone={setDriverPhone}
          />

          <p className="col-span-4 text-[13px] text-text-sub">
            입고량(자동계산): <span className="tabular font-bold text-text-strong">{netWeight}</span> kg
            <span className="ml-1 text-text-faint">= 총중량 − 공차중량 − 감량</span>
          </p>

          {stockMismatch && (
            <p className="col-span-4 flex items-center gap-1 text-[12.5px] text-danger">
              <AlertTriangle size={13} /> 재고반영중량이 입고량({netWeight}kg)과 일치하지 않습니다. 확인 후 저장하세요.
            </p>
          )}

          <div className="col-span-4">
            <label className={labelCls}>비고</label>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* 계량증명서를 올리면 OCR로 계근 항목을 자동 인식한다. */}
        <div className="grid grid-cols-2 gap-x-4">
          <StagedFileUpload
            label="계량증명서"
            files={certFiles}
            setFiles={setCertFiles}
            onAdd={runOcr}
            busy={ocrBusy}
            hint="올리면 계근 항목을 자동 인식합니다"
          />
          <StagedFileUpload label="참고 서류" files={refFiles} setFiles={setRefFiles} />
        </div>

        {(ocr || ocrNote) && (
          <div className="rounded-[10px] border border-border bg-input p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-primary">
              <ScanLine size={14} /> 계량증명서 인식 결과
              <span className="font-normal text-text-faint">— 빈 칸만 자동으로 채웠습니다. 위에서 직접 수정하세요.</span>
            </p>
            {ocrNote && <p className="mb-2 text-[12.5px] text-warning">{ocrNote}</p>}
            {ocr && (
              <dl className="grid grid-cols-3 gap-x-4 gap-y-1">
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

        {error && <p className="text-[13px] text-danger">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <button type="button" onClick={isEdit ? () => onSaved?.() : reset} className={outlineBtnCls}>
            {isEdit ? '취소' : '초기화'}
          </button>
          <button type="submit" disabled={submitting} className={primaryBtnCls}>
            {submitting ? '저장 중...' : isEdit ? '수정' : '등록'}
          </button>
        </div>
      </form>

      {created && (
        <div className={`${cardPadCls} mt-4`}>
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-success">
            <CheckCircle2 size={15} /> 등록 완료. 서류를 더 첨부할 수 있습니다.
          </p>
          <FileUpload label="추가 첨부" fileType="참고서류" parentType="inbound" parentId={created.id} />
        </div>
      )}
    </div>
  );
}
