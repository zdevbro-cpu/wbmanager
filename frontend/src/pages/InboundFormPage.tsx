import { useState } from 'react';
import { Truck, CheckCircle2, AlertTriangle, ScanLine } from 'lucide-react';
import { api, API_BASE_URL } from '../api/client';
import { auth } from '../lib/firebase';
import { useProjects, useItemMasters } from '../hooks/useMasters';
import { MasterSelect } from '../components/MasterSelect';
import { VehicleDriverFields } from '../components/VehicleDriverFields';
import { FileUpload } from '../components/FileUpload';
import { StagedFileUpload } from '../components/StagedFileUpload';
import { uploadStagedFiles } from '../lib/uploadStaged';
import { pageTitleCls, cardPadCls, primaryBtnCls, outlineBtnCls, inputCls } from '../components/ui/classes';
import type { Inbound } from '../types';

interface Props {
  embedded?: boolean;
  onCreated?: () => void;
}

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

export function InboundFormPage({ embedded = false, onCreated }: Props = {}) {
  const { projects } = useProjects();
  const { items, quickCreate: quickCreateItem } = useItemMasters();

  const [projectId, setProjectId] = useState('');
  const [inboundDate, setInboundDate] = useState('');
  const [unloadingPoint, setUnloadingPoint] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [grossWeight, setGrossWeight] = useState('');
  const [tareWeight, setTareWeight] = useState('');
  const [lossWeight, setLossWeight] = useState('');
  const [stockWeight, setStockWeight] = useState('');
  const [memo, setMemo] = useState('');
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
  const netWeight = netWeightNum === null ? '-' : netWeightNum.toFixed(3);

  // 재고반영중량은 ecount 필수 항목이며 입고량과 일치해야 한다. 미입력 시 입고량을 그대로 사용한다.
  const stockWeightValue = stockWeight === '' ? netWeight : stockWeight;
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
      if (f.driverName && !driverName) setDriverName(f.driverName);
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
      const inbound = await api.post<Inbound>('/api/inbounds', {
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
      });
      // 첨부는 부모 id가 있어야 붙일 수 있어 등록 성공 후 올린다.
      await uploadStagedFiles(
        [
          { fileType: '계량증명서', files: certFiles },
          { fileType: '참고서류', files: refFiles },
        ],
        'inbound',
        inbound.id,
      );
      setCreated(inbound);
      setCertFiles([]);
      setRefFiles([]);
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록 실패');
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
        <div className="grid grid-cols-3 gap-x-3 gap-y-3.5">
          <div>
            <label className={labelCls}>프로젝트(차수)</label>
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
            <input type="date" value={inboundDate} onChange={(e) => setInboundDate(e.target.value)} required className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>하차지</label>
            <input
              value={unloadingPoint}
              onChange={(e) => setUnloadingPoint(e.target.value)}
              placeholder="원방 / 세화철강 / 선진알앤디 등"
              className={inputCls}
            />
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
            <input type="number" step="0.001" value={grossWeight} onChange={(e) => setGrossWeight(e.target.value)} required className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>공차중량(kg)</label>
            <input type="number" step="0.001" value={tareWeight} onChange={(e) => setTareWeight(e.target.value)} required className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>감량(kg)</label>
            <input type="number" step="0.001" value={lossWeight} onChange={(e) => setLossWeight(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>재고반영중량(kg)</label>
            <input
              type="number"
              step="0.001"
              value={stockWeightValue === '-' ? '' : stockWeightValue}
              onChange={(e) => setStockWeight(e.target.value)}
              className={inputCls}
            />
          </div>

          <p className="col-span-3 text-[13px] text-text-sub">
            입고량(자동계산): <span className="tabular font-bold text-text-strong">{netWeight}</span> kg
            <span className="ml-1 text-text-faint">= 총중량 − 공차중량 − 감량</span>
          </p>

          {stockMismatch && (
            <p className="col-span-3 flex items-center gap-1 text-[12.5px] text-danger">
              <AlertTriangle size={13} /> 재고반영중량이 입고량({netWeight}kg)과 일치하지 않습니다. 확인 후 저장하세요.
            </p>
          )}

          <div className="col-span-3">
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
          <button type="button" onClick={reset} className={outlineBtnCls}>
            초기화
          </button>
          <button type="submit" disabled={submitting} className={primaryBtnCls}>
            {submitting ? '등록 중...' : '등록'}
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
