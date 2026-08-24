import { useState } from 'react';
import { PackageMinus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../api/client';
import { registerVehicleAfterSave } from '../lib/vehicleRegister';
import { useProjects, useVendors, useItemMasters } from '../hooks/useMasters';
import { MasterSelect } from '../components/MasterSelect';
import { VehicleDriverFields } from '../components/VehicleDriverFields';
import { FileUpload } from '../components/FileUpload';
import { StagedFileUpload } from '../components/StagedFileUpload';
import { NumberInput } from '../components/ui/NumberInput';
import { formatNumber } from '../lib/number';
import { uploadStagedFiles } from '../lib/uploadStaged';
import { pageTitleCls, cardPadCls, primaryBtnCls, outlineBtnCls, inputCls } from '../components/ui/classes';
import type { OutboundSale } from '../types';
import { DateField } from '../components/ui/DateField';

// 구분 목록 — 원본 엑셀 `스크랩출고량` 시트 실제 사용값
const CATEGORIES = ['출고', '보류', '기타'];

interface Props {
  embedded?: boolean;
  onCreated?: () => void;
  /** 넘기면 수정 모드 — 값이 채워진 채로 열리고 저장 시 PATCH한다. */
  record?: OutboundSale | null;
  onSaved?: () => void;
}

// 수정 모드 초기값 — 날짜는 YYYY-MM-DD, 숫자는 문자열로 맞춰 넣는다.
const initDate = (v?: string | null) => (v ? v.slice(0, 10) : '');
const initNum = (v?: string | number | null) => (v == null ? '' : String(Number(v)));

export function OutboundFormPage({ embedded = false, onCreated, record = null, onSaved }: Props = {}) {
  const { projects } = useProjects();
  const { vendors, quickCreate: quickCreateVendor } = useVendors();
  const { items, quickCreate: quickCreateItem } = useItemMasters();

  const isEdit = !!record;

  const [projectId, setProjectId] = useState(record?.projectId ?? '');
  const [itemCode, setItemCode] = useState(record?.itemCode ?? '');
  const [buyerId, setBuyerId] = useState(record?.buyerId ?? '');
  const [outboundDate, setOutboundDate] = useState(initDate(record?.outboundDate));
  const [loadingPoint, setLoadingPoint] = useState(record?.loadingPoint ?? '');
  const [vehicleType, setVehicleType] = useState(record?.vehicleType ?? '');
  const [vehicleNo, setVehicleNo] = useState(record?.vehicleNo ?? '');
  const [driverName, setDriverName] = useState(record?.driverName ?? '');
  const [driverPhone, setDriverPhone] = useState(record?.driverPhone ?? '');
  const [grossWeight, setGrossWeight] = useState(initNum(record?.grossWeight));
  const [tareWeight, setTareWeight] = useState(initNum(record?.tareWeight));
  const [preLossWeight, setPreLossWeight] = useState(initNum(record?.preLossWeight));
  const [lossWeight, setLossWeight] = useState(initNum(record?.lossWeight));
  const [stockWeight, setStockWeight] = useState(initNum(record?.stockWeight));
  const [unitPrice, setUnitPrice] = useState(initNum(record?.unitPrice));
  const [amount, setAmount] = useState(initNum(record?.amount));
  const [category, setCategory] = useState(record?.category ?? '');
  const [isSubsidiary, setIsSubsidiary] = useState(record?.isSubsidiary ?? false);
  const [memo, setMemo] = useState(record?.memo ?? '');
  const [paidDate, setPaidDate] = useState(initDate(record?.paidDate));
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
    setAmount('');
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
  const actualWeight = formatNumber(actualWeightNum);

  // 정산중량 = 총중량 - 공차중량 - 감량
  const settledWeightNum =
    actualWeightNum === null ? null : actualWeightNum - Number(lossWeight || 0);
  // 입력창에는 콤마 없는 원시값이, 화면에는 포맷값이 필요하다.
  const settledWeightRaw = settledWeightNum === null ? '' : String(Number(settledWeightNum.toFixed(3)));
  const settledWeight = formatNumber(settledWeightNum);

  // 재고반영중량은 ecount 필수 항목이며 정산중량과 일치해야 한다.
  const stockWeightValue = stockWeight === '' ? settledWeightRaw : stockWeight;
  const stockMismatch =
    settledWeightNum !== null && stockWeight !== '' && Number(stockWeight) !== settledWeightNum;

  // 공급가액 = 정산중량 × 단가, 부가세 = 공급가액 10%
  // 공급가액은 정산중량 × 단가로 잡되, 손으로 적으면 그 값이 우선한다(끝자리 절사·협의 금액 대응).
  const autoAmountNum = settledWeightNum !== null && unitPrice ? settledWeightNum * Number(unitPrice) : null;
  const amountNum = amount !== '' ? Number(amount) : autoAmountNum;
  const vatNum = amountNum === null ? null : Math.round(amountNum * 0.1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
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
        amount: amount !== '' ? Number(amount) : undefined,
        category: category || undefined,
        isSubsidiary,
        memo: memo || undefined,
        paidDate: paidDate || undefined,
      };
      const outbound = isEdit
        ? await api.patch<OutboundSale>(`/api/outbounds/${record.id}`, payload)
        : await api.post<OutboundSale>('/api/outbounds', payload);

      // 저장이 끝난 뒤에 차량번호를 목록에 올린다. 번호 꼴이 아닌 값은 올리지 않는다.
      await registerVehicleAfterSave(vehicleNo, vehicleType);
      await uploadStagedFiles(
        [
          { fileType: '계량증명서', files: certFiles },
          { fileType: '참고서류', files: refFiles },
        ],
        'outbound_sale',
        outbound.id,
      );
      setCertFiles([]);
      setRefFiles([]);
      if (isEdit) {
        onSaved?.();
      } else {
        setCreated(outbound);
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
          <PackageMinus size={20} className="text-primary" />
          <h1 className={pageTitleCls}>출고(매각) 등록</h1>
        </div>
      )}

      <form onSubmit={handleSubmit} className={`${cardPadCls} space-y-4`}>
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
            <label className={labelCls}>계량일</label>
            <DateField value={outboundDate} onChange={(e) => setOutboundDate(e.target.value)} required className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>상차지</label>
            <input
              value={loadingPoint}
              onChange={(e) => setLoadingPoint(e.target.value)}
              placeholder="원방 등"
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
              label="거래처(매각처)"
              options={vendors.map((v) => ({ value: v.id, label: v.name, isTemporary: v.isTemporary }))}
              value={buyerId}
              onChange={setBuyerId}
              onQuickCreate={quickCreateVendor}
            />
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
            <label className={labelCls}>공차중량(kg)</label>
            <NumberInput value={tareWeight} onChange={setTareWeight} decimals={3} />
          </div>
          <div>
            <label className={labelCls}>총중량(kg)</label>
            <NumberInput value={grossWeight} onChange={setGrossWeight} decimals={3} />
          </div>

          <div>
            <label className={labelCls}>실중량(kg) · 자동</label>
            <div className={`${inputCls} tabular flex items-center justify-end font-bold text-text-strong`}>{actualWeight}</div>
          </div>

          <div>
            <label className={labelCls}>거래처 감량 전 실중량(kg)</label>
            <NumberInput value={preLossWeight} onChange={setPreLossWeight} decimals={3} />
          </div>
          <div>
            <label className={labelCls}>감량(kg)</label>
            <NumberInput value={lossWeight} onChange={setLossWeight} decimals={3} />
          </div>

          <div>
            <label className={labelCls}>정산중량(kg) · 자동</label>
            <div className={`${inputCls} tabular flex items-center justify-end font-bold text-text-strong`}>{settledWeight}</div>
          </div>

          <div>
            <label className={labelCls}>재고반영중량(kg)</label>
            <NumberInput value={stockWeightValue} onChange={setStockWeight} decimals={3} />
            {stockMismatch && (
              <p className="mt-1 flex items-center gap-1 text-[12.5px] text-danger">
                <AlertTriangle size={13} /> 정산중량({settledWeight}kg)과 일치하지 않습니다. 확인 후 저장하세요.
              </p>
            )}
          </div>

          <div>
            <label className={labelCls}>단가(원)</label>
            <NumberInput value={unitPrice} onChange={setUnitPrice} />
          </div>

          <p className="col-span-4 text-[12.5px] text-text-faint">
            실중량 = 총중량 − 공차중량 · 정산중량 = 총중량 − 공차중량 − 감량
          </p>

          <div>
            <label className={labelCls}>공급가액(원)</label>
            <NumberInput
              value={amount}
              onChange={setAmount}
              placeholder={autoAmountNum === null ? '' : String(Math.round(autoAmountNum))}
            />
            <p className="mt-1 text-[12px] text-text-faint">비우면 정산중량 × 단가</p>
          </div>

          <p className="col-span-4 text-[13px] text-text-sub">
            공급가액: <span className="tabular font-bold text-text-strong">{formatNumber(amountNum)}</span> 원
            <span className="mx-2 text-text-faint">/</span>
            부가세: <span className="tabular font-bold text-text-strong">{formatNumber(vatNum)}</span> 원
          </p>

          {/* 구분 · 입금일 · 직납을 한 줄에 둔다. */}
          <div>
            <label className={labelCls}>구분</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              <option value="">선택</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>입금일</label>
            <DateField value={paidDate} onChange={(e) => setPaidDate(e.target.value)} className={inputCls} />
          </div>

          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-transparent select-none" aria-hidden>
              직납
            </span>
            {/* 야적장을 거치지 않고 현장에서 매각처로 바로 보낸 건 */}
            <label className="inline-flex h-[38px] items-center gap-2 text-[13px] font-semibold text-text-mid">
              <input
                type="checkbox"
                checked={isSubsidiary}
                onChange={(e) => setIsSubsidiary(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              직납
            </label>
          </div>

          <p className="col-span-4 text-[12px] text-text-faint">
            구분은 집계·보고서에서 묶어 보기 위한 분류입니다. 금액 계산에는 쓰이지 않습니다.
            {isSubsidiary && (
              <span className="ml-1 text-primary">
                직납으로 저장하면 같은 날·같은 물량의 입고가 함께 만들어집니다(재고 증감 없음).
              </span>
            )}
          </p>

          <div className="col-span-4">
            <label className={labelCls}>비고(특이사항)</label>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4">
          <StagedFileUpload label="계량증명서" files={certFiles} setFiles={setCertFiles} />
          <StagedFileUpload label="참고 서류" files={refFiles} setFiles={setRefFiles} />
        </div>

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
          <FileUpload label="추가 첨부" fileType="참고서류" parentType="outbound_sale" parentId={created.id} />
        </div>
      )}
    </div>
  );
}
