import { useState } from 'react';
import { PackageMinus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../api/client';
import { useProjects, useVendors, useItemMasters } from '../hooks/useMasters';
import { MasterSelect } from '../components/MasterSelect';
import { VehicleDriverFields } from '../components/VehicleDriverFields';
import { FileUpload } from '../components/FileUpload';
import { StagedFileUpload } from '../components/StagedFileUpload';
import { uploadStagedFiles } from '../lib/uploadStaged';
import { pageTitleCls, cardPadCls, primaryBtnCls, outlineBtnCls, inputCls } from '../components/ui/classes';
import type { OutboundSale } from '../types';

// 구분 목록 — 원본 엑셀 `스크랩출고량` 시트 실제 사용값
const CATEGORIES = ['출고', '보류', '기타'];

interface Props {
  embedded?: boolean;
  onCreated?: () => void;
}

export function OutboundFormPage({ embedded = false, onCreated }: Props = {}) {
  const { projects } = useProjects();
  const { vendors, quickCreate: quickCreateVendor } = useVendors();
  const { items, quickCreate: quickCreateItem } = useItemMasters();

  const [projectId, setProjectId] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [outboundDate, setOutboundDate] = useState('');
  const [loadingPoint, setLoadingPoint] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [grossWeight, setGrossWeight] = useState('');
  const [tareWeight, setTareWeight] = useState('');
  const [preLossWeight, setPreLossWeight] = useState('');
  const [lossWeight, setLossWeight] = useState('');
  const [stockWeight, setStockWeight] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [category, setCategory] = useState('');
  const [isSubsidiary, setIsSubsidiary] = useState(false);
  const [memo, setMemo] = useState('');
  const [paidDate, setPaidDate] = useState('');
  const [certFiles, setCertFiles] = useState<File[]>([]);
  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [created, setCreated] = useState<OutboundSale | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setProjectId('');
    setItemCode('');
    setBuyerId('');
    setOutboundDate('');
    setLoadingPoint('');
    setVehicleType('');
    setVehicleNo('');
    setDriverName('');
    setDriverPhone('');
    setGrossWeight('');
    setTareWeight('');
    setPreLossWeight('');
    setLossWeight('');
    setStockWeight('');
    setUnitPrice('');
    setCategory('');
    setIsSubsidiary(false);
    setMemo('');
    setPaidDate('');
    setCertFiles([]);
    setRefFiles([]);
    setCreated(null);
    setError('');
  };

  // 실중량 = 총중량 - 공차중량 (거래처 감량 반영 전)
  const actualWeightNum =
    grossWeight && tareWeight ? Number(grossWeight) - Number(tareWeight) : null;
  const actualWeight = actualWeightNum === null ? '-' : actualWeightNum.toFixed(3);

  // 정산중량 = 총중량 - 공차중량 - 감량
  const settledWeightNum =
    actualWeightNum === null ? null : actualWeightNum - Number(lossWeight || 0);
  const settledWeight = settledWeightNum === null ? '-' : settledWeightNum.toFixed(3);

  // 재고반영중량은 ecount 필수 항목이며 정산중량과 일치해야 한다.
  const stockWeightValue = stockWeight === '' ? settledWeight : stockWeight;
  const stockMismatch =
    settledWeightNum !== null && stockWeight !== '' && Number(stockWeight) !== settledWeightNum;

  // 공급가액 = 정산중량 × 단가, 부가세 = 공급가액 10%
  const amountNum =
    settledWeightNum !== null && unitPrice ? settledWeightNum * Number(unitPrice) : null;
  const vatNum = amountNum === null ? null : Math.round(amountNum * 0.1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const outbound = await api.post<OutboundSale>('/api/outbounds', {
        projectId,
        itemCode,
        buyerId: buyerId || undefined,
        outboundDate,
        loadingPoint: loadingPoint || undefined,
        vehicleType: vehicleType || undefined,
        vehicleNo: vehicleNo || undefined,
        driverName: driverName || undefined,
        driverPhone: driverPhone || undefined,
        grossWeight: grossWeight ? Number(grossWeight) : undefined,
        tareWeight: tareWeight ? Number(tareWeight) : undefined,
        preLossWeight: preLossWeight ? Number(preLossWeight) : undefined,
        lossWeight: lossWeight ? Number(lossWeight) : undefined,
        stockWeight: stockWeight ? Number(stockWeight) : undefined,
        unitPrice: unitPrice ? Number(unitPrice) : undefined,
        category: category || undefined,
        isSubsidiary,
        memo: memo || undefined,
        paidDate: paidDate || undefined,
      });
      await uploadStagedFiles(
        [
          { fileType: '계량증명서', files: certFiles },
          { fileType: '참고서류', files: refFiles },
        ],
        'outbound_sale',
        outbound.id,
      );
      setCreated(outbound);
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
          <PackageMinus size={20} className="text-primary" />
          <h1 className={pageTitleCls}>출고(매각) 등록</h1>
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

        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">계량일</label>
          <input type="date" value={outboundDate} onChange={(e) => setOutboundDate(e.target.value)} required className={inputCls} />
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">상차지</label>
          <input
            value={loadingPoint}
            onChange={(e) => setLoadingPoint(e.target.value)}
            placeholder="원방 등"
            className={inputCls}
          />
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
          label="거래처(매각처)"
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
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">공차중량(kg)</label>
            <input type="number" step="0.001" value={tareWeight} onChange={(e) => setTareWeight(e.target.value)} className={inputCls} />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">총중량(kg)</label>
            <input type="number" step="0.001" value={grossWeight} onChange={(e) => setGrossWeight(e.target.value)} className={inputCls} />
          </div>
        </div>

        <p className="text-[13px] text-text-sub">
          실중량(자동계산): <span className="tabular font-bold text-text-strong">{actualWeight}</span> kg
          <span className="ml-1 text-text-faint">= 총중량 − 공차중량</span>
        </p>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">거래처 감량 전 실중량(kg)</label>
            <input type="number" step="0.001" value={preLossWeight} onChange={(e) => setPreLossWeight(e.target.value)} className={inputCls} />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">감량(kg)</label>
            <input type="number" step="0.001" value={lossWeight} onChange={(e) => setLossWeight(e.target.value)} className={inputCls} />
          </div>
        </div>

        <p className="text-[13px] text-text-sub">
          정산중량(자동계산): <span className="tabular font-bold text-text-strong">{settledWeight}</span> kg
          <span className="ml-1 text-text-faint">= 총중량 − 공차중량 − 감량</span>
        </p>

        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">재고반영중량(kg)</label>
          <input
            type="number"
            step="0.001"
            value={stockWeightValue === '-' ? '' : stockWeightValue}
            onChange={(e) => setStockWeight(e.target.value)}
            className={inputCls}
          />
          {stockMismatch && (
            <p className="mt-1 flex items-center gap-1 text-[12.5px] text-danger">
              <AlertTriangle size={13} /> 정산중량({settledWeight}kg)과 일치하지 않습니다. 확인 후 저장하세요.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">단가(원)</label>
          <input type="number" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className={inputCls} />
        </div>

        <p className="text-[13px] text-text-sub">
          공급가액: <span className="tabular font-bold text-text-strong">{amountNum === null ? '-' : amountNum.toLocaleString()}</span> 원
          <span className="mx-2 text-text-faint">/</span>
          부가세: <span className="tabular font-bold text-text-strong">{vatNum === null ? '-' : vatNum.toLocaleString()}</span> 원
        </p>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">구분</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              <option value="">선택</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">입금일</label>
            <input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} className={inputCls} />
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
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">비고(특이사항)</label>
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
          <FileUpload label="추가 첨부" fileType="참고서류" parentType="outbound_sale" parentId={created.id} />
        </div>
      )}
    </div>
  );
}
