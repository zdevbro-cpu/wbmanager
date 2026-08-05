import { useState } from 'react';
import { Recycle, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client';
import { useProjects, useItemMasters, useCommonCodes } from '../hooks/useMasters';
import { MasterSelect } from '../components/MasterSelect';
import { VehicleDriverFields } from '../components/VehicleDriverFields';
import { FileUpload } from '../components/FileUpload';
import { StagedFileUpload } from '../components/StagedFileUpload';
import { uploadStagedFiles } from '../lib/uploadStaged';
import { pageTitleCls, cardPadCls, primaryBtnCls, outlineBtnCls, inputCls } from '../components/ui/classes';
import type { WasteInbound } from '../types';

interface Props {
  embedded?: boolean;
  onCreated?: () => void;
}

export function WasteInboundFormPage({ embedded = false, onCreated }: Props = {}) {
  const { projects } = useProjects();
  const { items, quickCreate: quickCreateItem } = useItemMasters();
  // 반복 입력값은 공통코드 관리에서 유지한다.
  const { labels: dischargerOptions } = useCommonCodes('배출자');
  const { labels: unloadingPointOptions } = useCommonCodes('하차지');

  const [projectId, setProjectId] = useState('');
  const [receiveDate, setReceiveDate] = useState('');
  const [handoverDate, setHandoverDate] = useState('');
  const [olbaroReported, setOlbaroReported] = useState(false);
  const [dischargerName, setDischargerName] = useState('');
  const [unloadingPoint, setUnloadingPoint] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [grossWeight, setGrossWeight] = useState('');
  const [tareWeight, setTareWeight] = useState('');
  const [lossWeight, setLossWeight] = useState('');
  const [memo, setMemo] = useState('');
  const [certFiles, setCertFiles] = useState<File[]>([]);
  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [created, setCreated] = useState<WasteInbound | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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
  const netWeight = netWeightNum === null ? '-' : netWeightNum.toFixed(3);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const wasteInbound = await api.post<WasteInbound>('/api/waste-inbounds', {
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
        memo: memo || undefined,
      });
      await uploadStagedFiles(
        [
          { fileType: '계량증명서', files: certFiles },
          { fileType: '참고서류', files: refFiles },
        ],
        'waste_inbound',
        wasteInbound.id,
      );
      setCreated(wasteInbound);
      setCertFiles([]);
      setRefFiles([]);
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={embedded ? '' : 'max-w-[520px]'}>
      {!embedded && (
        <div className="mb-5 flex items-center gap-2">
          <Recycle size={20} className="text-primary" />
          <h1 className={pageTitleCls}>폐기물 입고 등록</h1>
        </div>
      )}

      <form onSubmit={handleSubmit} className={`${cardPadCls} space-y-3.5`}>
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">프로젝트(차수)</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} required className={inputCls}>
            <option value="">선택</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.roundName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">인수일</label>
            <input type="date" value={receiveDate} onChange={(e) => setReceiveDate(e.target.value)} required className={inputCls} />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">인계일</label>
            <input type="date" value={handoverDate} onChange={(e) => setHandoverDate(e.target.value)} className={inputCls} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-[13px] font-semibold text-text-mid">
          <input
            type="checkbox"
            checked={olbaroReported}
            onChange={(e) => setOlbaroReported(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          올바로 신고 완료(O)
        </label>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">배출자</label>
            <input
              list="wi-dischargers"
              value={dischargerName}
              onChange={(e) => setDischargerName(e.target.value)}
              placeholder="케이엠티엘에스 / 크로스특수 / 원방 등"
              className={inputCls}
            />
            <datalist id="wi-dischargers">
              {dischargerOptions.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">하차지</label>
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
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
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
        </div>

        <MasterSelect
          label="제품명(품목)"
          options={items.map((i) => ({ value: i.itemCode, label: `${i.itemName} (${i.itemCode})`, isTemporary: i.isTemporary }))}
          value={itemCode}
          onChange={setItemCode}
          onQuickCreate={quickCreateItem}
        />

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">총중량(kg)</label>
            <input type="number" step="0.001" value={grossWeight} onChange={(e) => setGrossWeight(e.target.value)} required className={inputCls} />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">공차중량(kg)</label>
            <input type="number" step="0.001" value={tareWeight} onChange={(e) => setTareWeight(e.target.value)} required className={inputCls} />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">감량(kg)</label>
            <input type="number" step="0.001" value={lossWeight} onChange={(e) => setLossWeight(e.target.value)} className={inputCls} />
          </div>
        </div>

        <p className="text-[13px] text-text-sub">
          입고량(자동계산): <span className="tabular font-bold text-text-strong">{netWeight}</span> kg
          <span className="ml-1 text-text-faint">= 총중량 − 공차중량 − 감량</span>
        </p>

        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">비고</label>
          <input value={memo} onChange={(e) => setMemo(e.target.value)} className={inputCls} />
        </div>

        <div className="grid grid-cols-2 gap-x-3">
          <StagedFileUpload label="계량증명서" files={certFiles} setFiles={setCertFiles} />
          <StagedFileUpload label="참고 서류" files={refFiles} setFiles={setRefFiles} />
        </div>

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
          <FileUpload label="추가 첨부" fileType="참고서류" parentType="waste_inbound" parentId={created.id} />
        </div>
      )}
    </div>
  );
}
