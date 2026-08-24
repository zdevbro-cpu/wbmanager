import { useState } from 'react';
import { Recycle, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client';
import { registerVehicleAfterSave } from '../lib/vehicleRegister';
import { useProjects, useItemMasters, useCommonCodes } from '../hooks/useMasters';
import { MasterSelect } from '../components/MasterSelect';
import { VehicleDriverFields } from '../components/VehicleDriverFields';
import { FileUpload } from '../components/FileUpload';
import { StagedFileUpload } from '../components/StagedFileUpload';
import { NumberInput } from '../components/ui/NumberInput';
import { formatNumber } from '../lib/number';
import { uploadStagedFiles } from '../lib/uploadStaged';
import { pageTitleCls, cardPadCls, primaryBtnCls, outlineBtnCls, inputCls } from '../components/ui/classes';
import type { WasteInbound } from '../types';
import { DateField } from '../components/ui/DateField';

interface Props {
  embedded?: boolean;
  onCreated?: () => void;
  /** 넘기면 수정 모드 — 값이 채워진 채로 열리고 저장 시 PATCH한다. */
  record?: WasteInbound | null;
  onSaved?: () => void;
}

// 수정 모드 초기값 — 날짜는 YYYY-MM-DD, 숫자는 문자열로 맞춰 넣는다.
const initDate = (v?: string | null) => (v ? v.slice(0, 10) : '');
const initNum = (v?: string | number | null) => (v == null ? '' : String(Number(v)));

export function WasteInboundFormPage({ embedded = false, onCreated, record = null, onSaved }: Props = {}) {
  const { projects } = useProjects();
  const { items, quickCreate: quickCreateItem } = useItemMasters();
  // 반복 입력값은 공통코드 관리에서 유지한다.
  const { labels: dischargerOptions } = useCommonCodes('배출자');
  const { labels: unloadingPointOptions } = useCommonCodes('하차지');

  const [projectId, setProjectId] = useState(record?.projectId ?? '');
  const [receiveDate, setReceiveDate] = useState(initDate(record?.receiveDate));
  const [handoverDate, setHandoverDate] = useState(initDate(record?.handoverDate));
  const [olbaroReported, setOlbaroReported] = useState(record?.olbaroReported ?? false);
  const [dischargerName, setDischargerName] = useState(record?.dischargerName ?? '');
  const [unloadingPoint, setUnloadingPoint] = useState(record?.unloadingPoint ?? '');
  const [vehicleType, setVehicleType] = useState(record?.vehicleType ?? '');
  const [vehicleNo, setVehicleNo] = useState(record?.vehicleNo ?? '');
  const [driverName, setDriverName] = useState(record?.driverName ?? '');
  const [driverPhone, setDriverPhone] = useState(record?.driverPhone ?? '');
  const [itemCode, setItemCode] = useState(record?.itemCode ?? '');
  const [grossWeight, setGrossWeight] = useState(initNum(record?.grossWeight));
  const [tareWeight, setTareWeight] = useState(initNum(record?.tareWeight));
  const [lossWeight, setLossWeight] = useState(initNum(record?.lossWeight));
  const [transporterName, setTransporterName] = useState(record?.transporterName ?? '');
  const [processorName, setProcessorName] = useState(record?.processorName ?? '');
  const [actualWeight, setActualWeight] = useState(initNum(record?.actualWeight));
  const [settledWeight, setSettledWeight] = useState(initNum(record?.settledWeight));
  const [cubicMeter, setCubicMeter] = useState(initNum(record?.cubicMeter));
  const [memo, setMemo] = useState(record?.memo ?? '');
  const [certFiles, setCertFiles] = useState<File[]>([]);
  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [created, setCreated] = useState<WasteInbound | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isEdit = !!record;

  const reset = () => {
    setProjectId('');
    setReceiveDate('');
    setHandoverDate('');
    setOlbaroReported(false);
    setDischargerName('');
    setUnloadingPoint('');
    setVehicleType('');
    setVehicleNo('');
    setDriverName('');
    setDriverPhone('');
    setItemCode('');
    setGrossWeight('');
    setTareWeight('');
    setLossWeight('');
    setTransporterName('');
    setProcessorName('');
    setActualWeight('');
    setSettledWeight('');
    setCubicMeter('');
    setMemo('');
    setCertFiles([]);
    setRefFiles([]);
    setCreated(null);
    setError('');
  };

  // 입고량 = 총중량 - 공차중량 - 감량 (원본 엑셀 `폐기물 입고` 시트 기준)
  const netWeightNum =
    grossWeight && tareWeight
      ? Number(grossWeight) - Number(tareWeight) - Number(lossWeight || 0)
      : null;
  const netWeight = formatNumber(netWeightNum);

  // 실중량·정산중량은 비워 두면 계근값이 그대로 저장된다. 수집·운반은 정산을 하지 않아 단가·금액을 받지 않는다.
  const actualWeightNum =
    actualWeight !== '' ? Number(actualWeight) : grossWeight && tareWeight ? Number(grossWeight) - Number(tareWeight) : null;
  const settledWeightNum = settledWeight !== '' ? Number(settledWeight) : netWeightNum;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        projectId,
        receiveDate,
        handoverDate: handoverDate || undefined,
        olbaroReported,
        dischargerName: dischargerName || undefined,
        unloadingPoint: unloadingPoint || undefined,
        vehicleType: vehicleType || undefined,
        vehicleNo: vehicleNo || undefined,
        driverName: driverName || undefined,
        driverPhone: driverPhone || undefined,
        itemCode: itemCode || undefined,
        grossWeight: Number(grossWeight),
        tareWeight: Number(tareWeight),
        lossWeight: lossWeight ? Number(lossWeight) : undefined,
        transporterName: transporterName || undefined,
        processorName: processorName || undefined,
        actualWeight: actualWeightNum ?? undefined,
        settledWeight: settledWeightNum ?? undefined,
        cubicMeter: cubicMeter ? Number(cubicMeter) : undefined,
        memo: memo || undefined,
      };
      const wasteInbound = isEdit
        ? await api.patch<WasteInbound>(`/api/waste-inbounds/${record.id}`, payload)
        : await api.post<WasteInbound>('/api/waste-inbounds', payload);

      // 저장이 끝난 뒤에 차량번호를 목록에 올린다. 번호 꼴이 아닌 값은 올리지 않는다.
      await registerVehicleAfterSave(vehicleNo, vehicleType);
      await uploadStagedFiles(
        [
          { fileType: '계량증명서', files: certFiles },
          { fileType: '참고서류', files: refFiles },
        ],
        'waste_inbound',
        wasteInbound.id,
      );
      setCertFiles([]);
      setRefFiles([]);
      if (isEdit) {
        onSaved?.();
      } else {
        setCreated(wasteInbound);
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
    <div className={embedded ? '' : 'max-w-[760px]'}>
      {!embedded && (
        <div className="mb-5 flex items-center gap-2">
          <Recycle size={20} className="text-primary" />
          <h1 className={pageTitleCls}>폐기물 수집·운반 등록</h1>
        </div>
      )}

      <form onSubmit={handleSubmit} className={cardPadCls}>
        {/* 3열 그리드 — 모달 폭은 그대로 두고 한 행에 세 항목씩 배치한다. */}
        <div className="grid grid-cols-4 gap-x-3 gap-y-3.5">
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
            <label className={labelCls}>상차일</label>
            <DateField value={receiveDate} onChange={(e) => setReceiveDate(e.target.value)} required className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>인계일</label>
            <DateField value={handoverDate} onChange={(e) => setHandoverDate(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>배출자</label>
            <input
              list="wi-dischargers"
              value={dischargerName}
              onChange={(e) => setDischargerName(e.target.value)}
              placeholder="케이엠티엘에스 / 크로스특수 등"
              className={inputCls}
            />
            <datalist id="wi-dischargers">
              {dischargerOptions.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>

          <div>
            <label className={labelCls}>운반자</label>
            <input
              value={transporterName}
              onChange={(e) => setTransporterName(e.target.value)}
              placeholder="운반 업체"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>처리자</label>
            <input
              value={processorName}
              onChange={(e) => setProcessorName(e.target.value)}
              placeholder="처리 업체"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>하차지</label>
            <input
              list="wi-unloading-points"
              value={unloadingPoint}
              onChange={(e) => setUnloadingPoint(e.target.value)}
              placeholder="투플러스 / 주원 / 도솔환경산업 등"
              className={inputCls}
            />
            <datalist id="wi-unloading-points">
              {unloadingPointOptions.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>

          <label className="flex items-end gap-2 pb-2 text-[13px] font-semibold text-text-mid">
            <input
              type="checkbox"
              checked={olbaroReported}
              onChange={(e) => setOlbaroReported(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            올바로 신고 완료(O)
          </label>

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

          <p className="col-span-4 text-[13px] text-text-sub">
            입고량(자동계산): <span className="tabular font-bold text-text-strong">{netWeight}</span> kg
            <span className="ml-1 text-text-faint">= 총중량 − 공차중량 − 감량</span>
          </p>

          <div>
            <label className={labelCls}>실중량(kg)</label>
            <NumberInput value={actualWeight} onChange={setActualWeight} decimals={3} />
            <p className="mt-1 text-[12px] text-text-faint">비우면 총중량 − 공차중량</p>
          </div>

          <div>
            <label className={labelCls}>정산중량(kg)</label>
            <NumberInput value={settledWeight} onChange={setSettledWeight} decimals={3} />
            <p className="mt-1 text-[12px] text-text-faint">비우면 입고량</p>
          </div>

          <div>
            <label className={labelCls}>루베 적용(㎥)</label>
            <NumberInput value={cubicMeter} onChange={setCubicMeter} decimals={3} />
          </div>


          <div className="col-span-4">
            <label className={labelCls}>비고</label>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} className={inputCls} />
          </div>

          <StagedFileUpload label="계량증명서" files={certFiles} setFiles={setCertFiles} />
          <StagedFileUpload label="참고 서류" files={refFiles} setFiles={setRefFiles} />
        </div>

        {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}

        <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
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
          <FileUpload label="추가 첨부" fileType="참고서류" parentType="waste_inbound" parentId={created.id} />
        </div>
      )}
    </div>
  );
}
