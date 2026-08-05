import { useState } from 'react';
import { Trash2, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client';
import { useProjects, useVendors, useItemMasters, useCommonCodes } from '../hooks/useMasters';
import { MasterSelect } from '../components/MasterSelect';
import { VehicleDriverFields } from '../components/VehicleDriverFields';
import { FileUpload } from '../components/FileUpload';
import { StagedFileUpload } from '../components/StagedFileUpload';
import { uploadStagedFiles } from '../lib/uploadStaged';
import { pageTitleCls, cardPadCls, primaryBtnCls, outlineBtnCls, inputCls } from '../components/ui/classes';
import type { WasteOutbound } from '../types';

interface Props {
  embedded?: boolean;
  onCreated?: () => void;
}

export function WasteOutboundFormPage({ embedded = false, onCreated }: Props = {}) {
  const { projects } = useProjects();
  const { vendors, quickCreate: quickCreateVendor } = useVendors();
  const { items, quickCreate: quickCreateItem } = useItemMasters();
  // 반복 입력값은 공통코드 관리에서 유지한다.
  const { labels: dischargerOptions } = useCommonCodes('배출자');
  const { labels: transporterOptions } = useCommonCodes('운반자');
  const { labels: loadingPointOptions } = useCommonCodes('상차지');
  const { labels: categoryOptions } = useCommonCodes('거래 구분');
  const categories = categoryOptions.length > 0 ? categoryOptions : ['출고', '이동', '기타'];

  const [projectId, setProjectId] = useState('');
  const [outboundDate, setOutboundDate] = useState('');
  const [handoverDate, setHandoverDate] = useState('');
  const [olbaroReported, setOlbaroReported] = useState(false);
  const [dischargerName, setDischargerName] = useState('');
  const [transporterName, setTransporterName] = useState('');
  const [loadingPoint, setLoadingPoint] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [grossWeight, setGrossWeight] = useState('');
  const [tareWeight, setTareWeight] = useState('');
  const [preLossWeight, setPreLossWeight] = useState('');
  const [lossWeight, setLossWeight] = useState('');
  const [settledWeight, setSettledWeight] = useState('');
  const [cubicMeter, setCubicMeter] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('출고');
  const [isSubsidiary, setIsSubsidiary] = useState(false);
  const [transferDate, setTransferDate] = useState('');
  const [memo, setMemo] = useState('');
  const [olbaroMemo, setOlbaroMemo] = useState('');
  const [certFiles, setCertFiles] = useState<File[]>([]);
  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [created, setCreated] = useState<WasteOutbound | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setProjectId('');
    setOutboundDate('');
    setHandoverDate('');
    setOlbaroReported(false);
    setDischargerName('');
    setTransporterName('');
    setLoadingPoint('');
    setVehicleType('');
    setVehicleNo('');
    setDriverName('');
    setDriverPhone('');
    setBuyerId('');
    setItemCode('');
    setGrossWeight('');
    setTareWeight('');
    setPreLossWeight('');
    setLossWeight('');
    setSettledWeight('');
    setCubicMeter('');
    setUnitPrice('');
    setAmount('');
    setCategory('출고');
    setIsSubsidiary(false);
    setTransferDate('');
    setMemo('');
    setOlbaroMemo('');
    setCertFiles([]);
    setRefFiles([]);
    setCreated(null);
    setError('');
  };

  // 실중량 = 총중량 - 공차중량 (원본 `폐기물출고량` 시트 기준)
  const actualWeightNum =
    grossWeight && tareWeight ? Number(grossWeight) - Number(tareWeight) : null;
  // 정산중량 = 거래처 감량 전 실중량이 있으면 그 값, 없으면 실중량 - 감량
  const derivedSettledNum =
    preLossWeight !== ''
      ? Number(preLossWeight)
      : actualWeightNum === null
        ? null
        : actualWeightNum - Number(lossWeight || 0);
  const settledNum = settledWeight !== '' ? Number(settledWeight) : derivedSettledNum;
  const amountNum =
    amount !== ''
      ? Number(amount)
      : settledNum !== null && unitPrice !== ''
        ? settledNum * Number(unitPrice)
        : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const wasteOutbound = await api.post<WasteOutbound>('/api/waste-outbounds', {
        projectId,
        outboundDate,
        handoverDate: handoverDate || undefined,
        olbaroReported,
        dischargerName: dischargerName || undefined,
        transporterName: transporterName || undefined,
        loadingPoint: loadingPoint || undefined,
        vehicleType: vehicleType || undefined,
        vehicleNo: vehicleNo || undefined,
        driverName: driverName || undefined,
        driverPhone: driverPhone || undefined,
        buyerId: buyerId || undefined,
        itemCode: itemCode || undefined,
        grossWeight: grossWeight ? Number(grossWeight) : undefined,
        tareWeight: tareWeight ? Number(tareWeight) : undefined,
        preLossWeight: preLossWeight ? Number(preLossWeight) : undefined,
        lossWeight: lossWeight ? Number(lossWeight) : undefined,
        weight: settledNum ?? undefined,
        unitPrice: unitPrice ? Number(unitPrice) : undefined,
        cubicMeter: cubicMeter ? Number(cubicMeter) : undefined,
        amount: amount ? Number(amount) : undefined,
        category: category || undefined,
        isSubsidiary,
        transferDate: transferDate || undefined,
        memo: memo || undefined,
        olbaroMemo: olbaroMemo || undefined,
      });
      await uploadStagedFiles(
        [
          { fileType: '계량증명서', files: certFiles },
          { fileType: '참고서류', files: refFiles },
        ],
        'waste_outbound',
        wasteOutbound.id,
      );
      setCreated(wasteOutbound);
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
          <Trash2 size={20} className="text-primary" />
          <h1 className={pageTitleCls}>폐기물 반출 등록</h1>
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
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">상차일(반출일)</label>
            <input type="date" value={outboundDate} onChange={(e) => setOutboundDate(e.target.value)} required className={inputCls} />
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
              list="wo-dischargers"
              value={dischargerName}
              onChange={(e) => setDischargerName(e.target.value)}
              placeholder="케이엠티엘에스 / 크로스특수 / 원방 등"
              className={inputCls}
            />
            <datalist id="wo-dischargers">
              {dischargerOptions.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">운반자</label>
            <input
              list="wo-transporters"
              value={transporterName}
              onChange={(e) => setTransporterName(e.target.value)}
              placeholder="원방 / 주원 / 서윤산업 등"
              className={inputCls}
            />
            <datalist id="wo-transporters">
              {transporterOptions.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">상차지</label>
            <input
              list="wo-loading-points"
              value={loadingPoint}
              onChange={(e) => setLoadingPoint(e.target.value)}
              placeholder="현장 / 원방 등"
              className={inputCls}
            />
            <datalist id="wo-loading-points">
              {loadingPointOptions.map((o) => (
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
          label="처리자(거래처·폐기물업체)"
          options={vendors.map((v) => ({ value: v.id, label: v.name, isTemporary: v.isTemporary }))}
          value={buyerId}
          onChange={setBuyerId}
          onQuickCreate={quickCreateVendor}
        />

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
            <input type="number" step="0.001" value={grossWeight} onChange={(e) => setGrossWeight(e.target.value)} className={inputCls} />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">공차중량(kg)</label>
            <input type="number" step="0.001" value={tareWeight} onChange={(e) => setTareWeight(e.target.value)} className={inputCls} />
          </div>
        </div>

        <p className="text-[13px] text-text-sub">
          실중량(자동계산): <span className="tabular font-bold text-text-strong">{actualWeightNum === null ? '-' : actualWeightNum.toFixed(3)}</span> kg
          <span className="ml-1 text-text-faint">= 총중량 − 공차중량</span>
        </p>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">거래처 감량 전 실중량(kg)</label>
            <input type="number" step="0.001" value={preLossWeight} onChange={(e) => setPreLossWeight(e.target.value)} className={inputCls} />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">감량(계근차, kg)</label>
            <input type="number" step="0.001" value={lossWeight} onChange={(e) => setLossWeight(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">정산중량(kg)</label>
            <input
              type="number"
              step="0.001"
              value={settledWeight}
              onChange={(e) => setSettledWeight(e.target.value)}
              placeholder={derivedSettledNum === null ? '' : derivedSettledNum.toFixed(3)}
              className={inputCls}
            />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">루베 적용(㎥)</label>
            <input type="number" step="0.01" value={cubicMeter} onChange={(e) => setCubicMeter(e.target.value)} className={inputCls} />
          </div>
        </div>

        <p className="text-[13px] text-text-sub">
          정산중량(적용값): <span className="tabular font-bold text-text-strong">{settledNum === null ? '-' : settledNum.toFixed(3)}</span> kg
          <span className="ml-1 text-text-faint">= 거래처 감량 전 실중량 (없으면 실중량 − 감량)</span>
        </p>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">단가(원)</label>
            <input type="number" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className={inputCls} />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">지출금액(원)</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={amountNum === null ? '' : String(Math.round(amountNum))}
              className={inputCls}
            />
          </div>
        </div>

        <p className="text-[13px] text-text-sub">
          지출금액(적용값): <span className="tabular font-bold text-text-strong">{amountNum === null ? '-' : Math.round(amountNum).toLocaleString()}</span> 원
          <span className="ml-1 text-text-faint">= 정산중량 × 단가</span>
        </p>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">구분</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              {category && !categories.includes(category) && <option value={category}>{category}</option>}
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">이체일</label>
            <input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} className={inputCls} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-[13px] font-semibold text-text-mid">
          <input
            type="checkbox"
            checked={isSubsidiary}
            onChange={(e) => setIsSubsidiary(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          자회사 출고
        </label>

        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">비고</label>
          <input value={memo} onChange={(e) => setMemo(e.target.value)} className={inputCls} />
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">올바로 메모(기준업체량 등)</label>
          <input value={olbaroMemo} onChange={(e) => setOlbaroMemo(e.target.value)} className={inputCls} />
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
          <FileUpload label="추가 첨부" fileType="참고서류" parentType="waste_outbound" parentId={created.id} />
        </div>
      )}
    </div>
  );
}
