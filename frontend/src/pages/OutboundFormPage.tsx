import { useEffect, useState } from 'react';
import { PackageMinus, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { registerVehicleAfterSave } from '../lib/vehicleRegister';
import { formatPhone } from '../lib/phone';
import { useProjects, useVendors, useItemMasters, useCommonCodes, useEmployees, useExternalDrivers } from '../hooks/useMasters';
import { MasterSelect } from '../components/MasterSelect';
import { SearchSelect } from '../components/SearchSelect';
import { VehicleDriverFields } from '../components/VehicleDriverFields';
import { FileUpload } from '../components/FileUpload';
import { StagedFileUpload } from '../components/StagedFileUpload';
import { OcrResult } from '../components/OcrResult';
import { useCertificateOcr, type OcrFields } from '../hooks/useCertificateOcr';
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
  // 끝난 현장은 새로 적을 일이 없어 고르는 목록에서 뺀다(요청 2026-11-13).
  const { activeProjects: projects } = useProjects();
  const { employees } = useEmployees();
  const { drivers } = useExternalDrivers();
  const { vendors, quickCreate: quickCreateVendor } = useVendors();
  const { items, quickCreate: quickCreateItem } = useItemMasters();
  const { labels: loadingPointOptions } = useCommonCodes('상차지');

  const isEdit = !!record;

  const [projectId, setProjectId] = useState(record?.projectId ?? '');
  // 이 건에 든 운반비 — 저장하면 운반비 관리에 한 줄로 들어간다(리뷰회의 5-6).
  const [transportCost, setTransportCost] = useState(record?.transportCost ? String(Number(record.transportCost)) : '');
  // 세금계산서와 맞추려 공급가액과 따로 적는다. 비우면 10%로 채운다(요청 2026-11-13).
  const [transportTax, setTransportTax] = useState(record?.transportTax ? String(Number(record.transportTax)) : '');
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
  // 계량증명서를 올리면 계근 항목을 읽어 빈 칸만 채운다. 이미 적은 값은 건드리지 않는다.
  const { ocr, ocrBusy, ocrNote, runOcr } = useCertificateOcr();
  const applyOcr = (f: OcrFields) => {
      if (f.weighDate && !outboundDate) setOutboundDate(f.weighDate);
      if (f.vehicleNo && !vehicleNo) setVehicleNo(f.vehicleNo);
      if (f.driverName && !driverName) {
        setDriverName(f.driverName);
        // 계근표에는 연락처가 찍히지 않는다. 등록된 운전자면 연락처를 가져와 채운다.
        // 운전자는 임직원과 외부 운전자 두 곳에 있으므로 둘 다 본다.
        const matchedDriver =
          employees.find((e) => e.name === f.driverName) ?? drivers.find((d) => d.name === f.driverName);
        if (matchedDriver?.phone && !driverPhone) setDriverPhone(formatPhone(matchedDriver.phone));
      }
      if (f.siteName && !loadingPoint) setLoadingPoint(f.siteName);
      if (f.grossWeight != null && !grossWeight) setGrossWeight(String(f.grossWeight));
      if (f.tareWeight != null && !tareWeight) setTareWeight(String(f.tareWeight));
      if (f.itemName && !itemCode) {
        const matched = items.find((i) => i.itemName === f.itemName);
        if (matched) setItemCode(matched.itemCode);
      }
  };
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
  // 거래처와 제품명이 정해지면 그 조합의 최근 단가를 끌어온다(요청 2026-11-13).
  // 이미 적어 둔 값은 덮지 않는다 — 고쳐 쓴 값을 지우면 안 되기 때문이다.
  const [priceHint, setPriceHint] = useState('');
  useEffect(() => {
    if (!buyerId || !itemCode) {
      setPriceHint('');
      return;
    }
    let alive = true;
    api
      .get<{ found: boolean; price?: number; priceType?: string; effectiveDate?: string }>(
        `/api/prices/recent?vendorId=${buyerId}&itemCode=${encodeURIComponent(itemCode)}`,
      )
      .then((r) => {
        if (!alive) return;
        if (!r.found) {
          setPriceHint('이 거래처·품목의 등록된 단가가 없습니다');
          return;
        }
        setPriceHint(`최근 단가 ${formatNumber(r.price ?? 0)}원 (${r.priceType ?? ''} · ${(r.effectiveDate ?? '').slice(0, 10)})`);
        setUnitPrice((cur) => (cur ? cur : String(r.price ?? '')));
      })
      .catch(() => {
        if (alive) setPriceHint('');
      });
    return () => {
      alive = false;
    };
  }, [buyerId, itemCode]);
  // 계량증명서 한 장을 여러 현장·품목으로 나눠 적는다(요청 2026-11-13).
  // 줄이 없으면 지금까지처럼 한 현장·한 품목으로 통째로 들어간다.
  type Split = { projectId: string; itemCode: string; weight: string; memo: string };
  const [splits, setSplits] = useState<Split[]>(
    (record?.splits ?? []).map((sp) => ({
      projectId: sp.projectId,
      itemCode: sp.itemCode,
      weight: String(Number(sp.weight)),
      memo: sp.memo ?? '',
    })),
  );
  const splitSum = splits.reduce((acc, sp) => acc + (sp.weight ? Number(sp.weight) : 0), 0);
  const splitOff = splits.length > 0 && Math.abs(splitSum - (settledWeightNum ?? 0)) > 0.001;
  const setSplit = (i: number, patch: Partial<Split>) =>
    setSplits((prev) => prev.map((sp, k) => (k === i ? { ...sp, ...patch } : sp)));


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
        transportCost: transportCost ? Number(transportCost) : undefined,
        transportTax: transportTax ? Number(transportTax) : undefined,
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
        // 비어 있으면 보내지 않는다 — 다른 칸만 고치러 들어왔을 때 줄이 지워지면 안 된다.
        ...(splits.length > 0 || record ? { splits: splits.filter((sp) => sp.projectId && sp.itemCode && sp.weight) } : {}),
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
            <label className={labelCls}>계량일</label>
            <DateField value={outboundDate} onChange={(e) => setOutboundDate(e.target.value)} required className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>상차지</label>
            {/* 등록할 때 적은 값은 저장 시 상차지 목록에 쌓여, 다음부터 골라 쓸 수 있다. */}
            <input
              list="out-loading-points"
              value={loadingPoint}
              onChange={(e) => setLoadingPoint(e.target.value)}
              placeholder="원방 등"
              className={inputCls}
            />
            <datalist id="out-loading-points">
              {loadingPointOptions.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>


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
            {priceHint && <p className="mt-1 text-[12px] text-text-faint">{priceHint}</p>}
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

          <p className="col-span-4 text-[12.5px] text-text-faint">
            실중량 = 총중량 − 공차중량 · 정산중량 = 총중량 − 공차중량 − 감량
          </p>

          {/* 공급가액 · 구분 · 입금일 · 직납을 한 줄에 둔다. */}
          <div>
            <label className={labelCls}>공급가액(원)</label>
            <NumberInput
              value={amount}
              onChange={setAmount}
              placeholder={autoAmountNum === null ? '' : String(Math.round(autoAmountNum))}
            />
            <p className="mt-1 text-[12px] text-text-faint">비우면 정산중량 × 단가</p>
          </div>

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

          <p className="col-span-4 text-[13px] text-text-sub">
            공급가액: <span className="tabular font-bold text-text-strong">{formatNumber(amountNum)}</span> 원
            <span className="mx-2 text-text-faint">/</span>
            부가세: <span className="tabular font-bold text-text-strong">{formatNumber(vatNum)}</span> 원
          </p>

          <p className="col-span-4 text-[12px] text-text-faint">
            구분은 집계·보고서에서 묶어 보기 위한 분류입니다. 금액 계산에는 쓰이지 않습니다.
            {isSubsidiary && (
              <span className="ml-1 text-primary">
                직납으로 저장하면 같은 날·같은 물량의 입고가 함께 만들어집니다(재고 증감 없음).
              </span>
            )}
          </p>

          <div>
            <label className={labelCls}>운반비(원)</label>
            <NumberInput value={transportCost} onChange={setTransportCost} />
            <p className="mt-1 text-[12px] text-text-faint">적으면 운반비 관리에 자동으로 들어갑니다</p>
          </div>

          <div>
            <label className={labelCls}>운반비 세액(원)</label>
            <NumberInput value={transportTax} onChange={setTransportTax} />
            <p className="mt-1 text-[12px] text-text-faint">비우면 공급가액의 10%로 채웁니다</p>
          </div>

          {/* 계량증명서 한 장을 여러 현장·품목으로 나눠 적는 자리(요청 2026-11-13).
              줄을 더하지 않으면 위에서 고른 현장·품목으로 통째로 들어간다. */}
          <div className="col-span-3 rounded-[10px] border border-border p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[13px] font-bold text-text-strong">현장 · 품목 나누기</span>
              <span className="text-[12px] text-text-faint">
                한 계량증명서가 여러 현장이나 품목으로 갈릴 때만 씁니다
              </span>
              <button
                type="button"
                onClick={() => setSplits((prev) => [...prev, { projectId: '', itemCode: '', weight: '', memo: '' }])}
                className={`${outlineBtnCls} ml-auto px-2 py-1 text-[12.5px]`}
              >
                줄 추가
              </button>
            </div>

            {splits.length === 0 ? (
              <p className="text-[12.5px] text-text-faint">
                나누지 않으면 위에서 고른 현장과 제품명으로 {settledWeight}kg 전부가 들어갑니다.
              </p>
            ) : (
              <>
                {splits.map((sp, i) => (
                  <div key={i} className="mb-2 grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)_auto] items-center gap-2">
                    <SearchSelect
                      ariaLabel="나눌 현장"
                      options={projects.map((pr) => ({ value: pr.id, label: pr.roundName }))}
                      value={sp.projectId}
                      onChange={(v) => setSplit(i, { projectId: v })}
                      placeholder="현장"
                    />
                    <SearchSelect
                      ariaLabel="나눌 품목"
                      options={items.map((it) => ({ value: it.itemCode, label: it.itemName }))}
                      value={sp.itemCode}
                      onChange={(v) => setSplit(i, { itemCode: v })}
                      placeholder="품목"
                    />
                    <NumberInput value={sp.weight} onChange={(v) => setSplit(i, { weight: v })} />
                    <input
                      value={sp.memo}
                      onChange={(e) => setSplit(i, { memo: e.target.value })}
                      placeholder="비고 (예: 검수에서 갈림)"
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={() => setSplits((prev) => prev.filter((_, k) => k !== i))}
                      className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-danger"
                      title="이 줄 지우기"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <p className={`text-[12.5px] ${splitOff ? 'font-semibold text-danger' : 'text-text-faint'}`}>
                  나눈 합계 {formatNumber(splitSum)}kg / 정산중량 {settledWeight}kg
                  {splitOff && ' — 두 값이 같아야 저장됩니다'}
                </p>
              </>
            )}
          </div>

          <div className="col-span-3">
            <label className={labelCls}>비고(특이사항)</label>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4">
          <StagedFileUpload
              label="계량증명서"
              files={certFiles}
              setFiles={setCertFiles}
              onAdd={(picked) => runOcr(picked, applyOcr)}
              busy={ocrBusy}
              hint="올리면 계근 항목을 자동 인식합니다"
            />
          <StagedFileUpload label="참고 서류" files={refFiles} setFiles={setRefFiles} />
        </div>

        <OcrResult ocr={ocr} note={ocrNote} />

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
