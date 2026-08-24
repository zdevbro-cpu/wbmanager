import { useState } from 'react';
import { Trash2, CheckCircle2, Plus } from 'lucide-react';
import { api } from '../api/client';
import { registerVehicleAfterSave } from '../lib/vehicleRegister';
import { useProjects, useVendors, useItemMasters, useCommonCodes } from '../hooks/useMasters';
import { MasterSelect } from '../components/MasterSelect';
import { SearchSelect } from '../components/SearchSelect';
import { VehicleDriverFields } from '../components/VehicleDriverFields';
import { FileUpload } from '../components/FileUpload';
import { StagedFileUpload } from '../components/StagedFileUpload';
import { NumberInput } from '../components/ui/NumberInput';
import { formatNumber } from '../lib/number';
import { uploadStagedFiles } from '../lib/uploadStaged';
import { pageTitleCls, cardPadCls, primaryBtnCls, outlineBtnCls, inputCls } from '../components/ui/classes';
import type { WasteOutbound } from '../types';
import { DateField } from '../components/ui/DateField';

interface Props {
  embedded?: boolean;
  onCreated?: () => void;
  /** 넘기면 수정 모드 — 값이 채워진 채로 열리고 저장 시 PATCH한다. */
  record?: WasteOutbound | null;
  onSaved?: () => void;
}

// 수정 모드 초기값 — 날짜는 YYYY-MM-DD, 숫자는 문자열로 맞춰 넣는다.
const initDate = (v?: string | null) => (v ? v.slice(0, 10) : '');
const initNum = (v?: string | number | null) => (v == null ? '' : String(Number(v)));

export function WasteOutboundFormPage({ embedded = false, onCreated, record = null, onSaved }: Props = {}) {
  const { projects } = useProjects();
  const { vendors, quickCreate: quickCreateVendor } = useVendors();
  const { items, quickCreate: quickCreateItem } = useItemMasters();
  // 반복 입력값은 공통코드 관리에서 유지한다.
  const { labels: dischargerOptions } = useCommonCodes('배출자');
  const { labels: transporterOptions } = useCommonCodes('운반자');
  const { labels: loadingPointOptions } = useCommonCodes('상차지');
  const { labels: categoryOptions } = useCommonCodes('거래 구분');
  const categories = categoryOptions.length > 0 ? categoryOptions : ['출고', '이동', '기타'];

  const [projectId, setProjectId] = useState(record?.projectId ?? '');
  const [outboundDate, setOutboundDate] = useState(initDate(record?.outboundDate));
  const [handoverDate, setHandoverDate] = useState(initDate(record?.handoverDate));
  const [olbaroReported, setOlbaroReported] = useState(record?.olbaroReported ?? false);
  const [dischargerName, setDischargerName] = useState(record?.dischargerName ?? '');
  const [transporterName, setTransporterName] = useState(record?.transporterName ?? '');
  const [loadingPoint, setLoadingPoint] = useState(record?.loadingPoint ?? '');
  const [vehicleType, setVehicleType] = useState(record?.vehicleType ?? '');
  const [vehicleNo, setVehicleNo] = useState(record?.vehicleNo ?? '');
  const [driverName, setDriverName] = useState(record?.driverName ?? '');
  const [driverPhone, setDriverPhone] = useState(record?.driverPhone ?? '');
  const [buyerId, setBuyerId] = useState(record?.buyerId ?? '');
  const [itemCode, setItemCode] = useState(record?.itemCode ?? '');
  const [grossWeight, setGrossWeight] = useState(initNum(record?.grossWeight));
  const [tareWeight, setTareWeight] = useState(initNum(record?.tareWeight));
  const [preLossWeight, setPreLossWeight] = useState(initNum(record?.preLossWeight));
  const [lossWeight, setLossWeight] = useState(initNum(record?.lossWeight));
  const [settledWeight, setSettledWeight] = useState(initNum(record?.weight));
  const [cubicMeter, setCubicMeter] = useState(initNum(record?.cubicMeter));
  const [unitPrice, setUnitPrice] = useState(initNum(record?.unitPrice));
  const [transportCost, setTransportCost] = useState(initNum(record?.transportCost));
  const [amount, setAmount] = useState(initNum(record?.amount));
  const [category, setCategory] = useState(record?.category ?? '출고');
  const [isSubsidiary, setIsSubsidiary] = useState(record?.isSubsidiary ?? false);
  const [transferDate, setTransferDate] = useState(initDate(record?.transferDate));
  const [memo, setMemo] = useState(record?.memo ?? '');
  const [olbaroMemo, setOlbaroMemo] = useState(record?.olbaroMemo ?? '');
  const [certFiles, setCertFiles] = useState<File[]>([]);
  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [created, setCreated] = useState<WasteOutbound | null>(null);
  // 한 차에 여러 현장이 섞이는 경우 — 행을 추가해 현장별로 나눠 등록한다(최대 5행).
  // 차량·기사·배출자 같은 공통 정보는 위 입력을 그대로 쓰고, 행마다 현장·품목·중량만 다르게 넣는다.
  const [splits, setSplits] = useState<{ projectId: string; itemCode: string; weight: string; amount: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isEdit = !!record;

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
    setTransportCost('');
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
      const payload = {
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
        transportCost: transportCost ? Number(transportCost) : undefined,
        amount: amount ? Number(amount) : undefined,
        category: category || undefined,
        isSubsidiary,
        transferDate: transferDate || undefined,
        memo: memo || undefined,
        olbaroMemo: olbaroMemo || undefined,
      };
      // 현장별로 나눈 행이 있으면 행마다 한 건씩 만든다. 없으면 지금까지처럼 한 건이다.
      const rows = splits.filter((r) => r.projectId && Number(r.weight) > 0);
      if (!isEdit && rows.length > 0) {
        for (const r of rows) {
          await api.post<WasteOutbound>('/api/waste-outbounds', {
            ...payload,
            projectId: r.projectId,
            itemCode: r.itemCode || undefined,
            weight: Number(r.weight),
            amount: r.amount ? Number(r.amount) : undefined,
          });
        }
      }
      const wasteOutbound =
        !isEdit && rows.length > 0
          ? null
          : isEdit
            ? await api.patch<WasteOutbound>(`/api/waste-outbounds/${record.id}`, payload)
            : await api.post<WasteOutbound>('/api/waste-outbounds', payload);

      // 저장이 끝난 뒤에 차량번호를 목록에 올린다. 번호 꼴이 아닌 값은 올리지 않는다.
      await registerVehicleAfterSave(vehicleNo, vehicleType);
      if (wasteOutbound) await uploadStagedFiles(
        [
          { fileType: '계량증명서', files: certFiles },
          { fileType: '참고서류', files: refFiles },
        ],
        'waste_outbound',
        wasteOutbound.id,
      );

      setCertFiles([]);
      setRefFiles([]);
      if (isEdit) {
        onSaved?.();
      } else {
        if (wasteOutbound) setCreated(wasteOutbound);
        setSplits([]);
        onCreated?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : isEdit ? '수정 실패' : '등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

  // 3열 그리드 — 모달 폭(760px)은 그대로 두고 한 행에 세 항목씩 배치한다.
  const labelCls = 'mb-1.5 block text-[13px] font-semibold text-text-mid';

  return (
    <div className={embedded ? '' : 'max-w-[760px]'}>
      {!embedded && (
        <div className="mb-5 flex items-center gap-2">
          <Trash2 size={20} className="text-primary" />
          <h1 className={pageTitleCls}>폐기물 반출 등록</h1>
        </div>
      )}

      <form onSubmit={handleSubmit} className={cardPadCls}>
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
            <label className={labelCls}>상차일(반출일)</label>
            <DateField value={outboundDate} onChange={(e) => setOutboundDate(e.target.value)} required className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>인계일</label>
            <DateField value={handoverDate} onChange={(e) => setHandoverDate(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>배출자</label>
            <SearchSelect
              ariaLabel="배출자"
              options={dischargerOptions.map((o) => ({ value: o, label: o }))}
              value={dischargerName}
              onChange={setDischargerName}
              placeholder="검색 또는 직접 입력"
              allowFree
            />
          </div>

          <div>
            <label className={labelCls}>운반자</label>
            <SearchSelect
              ariaLabel="운반자"
              options={transporterOptions.map((o) => ({ value: o, label: o }))}
              value={transporterName}
              onChange={setTransporterName}
              placeholder="검색 또는 직접 입력"
              allowFree
            />
          </div>

          <div>
            <label className={labelCls}>상차지</label>
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

          <div className="col-span-2">
            <MasterSelect
              label="처리자(거래처·폐기물업체)"
              options={vendors.map((v) => ({ value: v.id, label: v.name, isTemporary: v.isTemporary }))}
              value={buyerId}
              onChange={setBuyerId}
              onQuickCreate={quickCreateVendor}
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


          <div className="col-span-4">
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
            <div className={`${inputCls} tabular flex items-center justify-end font-bold text-text-strong`}>
              {formatNumber(actualWeightNum)}
            </div>
          </div>

          <div>
            <label className={labelCls}>거래처 감량 전 실중량(kg)</label>
            <NumberInput value={preLossWeight} onChange={setPreLossWeight} decimals={3} />
          </div>

          <div>
            <label className={labelCls}>감량(계근차, kg)</label>
            <NumberInput value={lossWeight} onChange={setLossWeight} decimals={3} />
          </div>

          <div>
            <label className={labelCls}>정산중량(kg)</label>
            <NumberInput
              value={settledWeight}
              onChange={setSettledWeight}
              decimals={3}
              placeholder={derivedSettledNum === null ? '' : formatNumber(derivedSettledNum)}
            />
          </div>

          <div>
            <label className={labelCls}>루베 적용(㎥)</label>
            <NumberInput value={cubicMeter} onChange={setCubicMeter} decimals={2} />
          </div>

          <div>
            <label className={labelCls}>단가(원)</label>
            <NumberInput value={unitPrice} onChange={setUnitPrice} />
          </div>

          <div>
            <label className={labelCls}>운반비(원)</label>
            <NumberInput value={transportCost} onChange={setTransportCost} />
          </div>

          <div>
            <label className={labelCls}>지출금액(원)</label>
            <NumberInput
              value={amount}
              onChange={setAmount}
              placeholder={amountNum === null ? '' : formatNumber(Math.round(amountNum))}
            />
          </div>

          <p className="col-span-4 text-[12.5px] text-text-faint">
            실중량 = 총중량 − 공차중량 · 정산중량 = 거래처 감량 전 실중량(없으면 실중량 − 감량)
            <span className="tabular ml-1 font-bold text-text-strong">{formatNumber(settledNum)}</span> kg
            · 지출금액 = 정산중량 × 단가
            <span className="tabular ml-1 font-bold text-text-strong">
              {amountNum === null ? '-' : formatNumber(Math.round(amountNum))}
            </span>
            원
          </p>

          <div>
            <label className={labelCls}>구분</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              {category && !categories.includes(category) && <option value={category}>{category}</option>}
            </select>
          </div>

          <div>
            <label className={labelCls}>이체일</label>
            <DateField value={transferDate} onChange={(e) => setTransferDate(e.target.value)} className={inputCls} />
          </div>

          {/* 두 항목을 한 줄에 나란히 둔다 — 좁은 칸에서 글자가 접히지 않게 두 칸을 쓴다. */}
          <div className="col-span-2 flex items-end gap-5 pb-2">
            <label className="flex items-center gap-2 whitespace-nowrap text-[13px] font-semibold text-text-mid">
              <input
                type="checkbox"
                checked={olbaroReported}
                onChange={(e) => setOlbaroReported(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              올바로 신고(O)
            </label>
            <label className="flex items-center gap-2 whitespace-nowrap text-[13px] font-semibold text-text-mid">
              <input
                type="checkbox"
                checked={isSubsidiary}
                onChange={(e) => setIsSubsidiary(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              자회사 출고
            </label>
          </div>

          {/* 한 차에 여러 현장이 섞였을 때 — 행을 추가해 현장별로 나눠 등록한다(최대 5행).
              행을 채우면 위의 프로젝트·제품명·정산중량 대신 행별 값으로 그 수만큼 건이 만들어진다. */}
          <div className="col-span-4">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[13px] font-semibold text-text-mid">현장 분할 등록</span>
              <span className="text-[12px] text-text-faint">
                한 차에 여러 현장이 섞였을 때만 씁니다. 채운 행 수만큼 건이 만들어집니다.
              </span>
              <button
                type="button"
                onClick={() =>
                  setSplits((rows) =>
                    rows.length >= 5 ? rows : [...rows, { projectId: '', itemCode: '', weight: '', amount: '' }],
                  )
                }
                disabled={splits.length >= 5 || isEdit}
                className="ml-auto inline-flex h-8 items-center gap-1 rounded-[8px] border border-border px-2 text-[12px] font-semibold text-text-mid hover:bg-hover disabled:opacity-50"
              >
                <Plus size={13} /> 행 추가
              </button>
            </div>

            {splits.length > 0 && (
              <div className="space-y-2">
                {splits.map((row, i) => (
                  <div
                    key={i}
                    className="grid items-end gap-2 [grid-template-columns:minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
                  >
                    <SearchSelect
                      ariaLabel={`${i + 1}행 프로젝트`}
                      options={projects.map((pr) => ({ value: pr.id, label: pr.roundName }))}
                      value={row.projectId}
                      onChange={(v) => setSplits((rows) => rows.map((r, j) => (j === i ? { ...r, projectId: v } : r)))}
                      placeholder="프로젝트"
                    />
                    <SearchSelect
                      ariaLabel={`${i + 1}행 제품명`}
                      options={items.map((it) => ({ value: it.itemCode, label: it.itemName }))}
                      value={row.itemCode}
                      onChange={(v) => setSplits((rows) => rows.map((r, j) => (j === i ? { ...r, itemCode: v } : r)))}
                      placeholder="제품명"
                    />
                    <NumberInput
                      value={row.weight}
                      onChange={(v) => setSplits((rows) => rows.map((r, j) => (j === i ? { ...r, weight: v } : r)))}
                      decimals={3}
                      placeholder="정산중량"
                    />
                    <NumberInput
                      value={row.amount}
                      onChange={(v) => setSplits((rows) => rows.map((r, j) => (j === i ? { ...r, amount: v } : r)))}
                      placeholder="금액(선택)"
                    />
                    <button
                      type="button"
                      title="행 삭제"
                      onClick={() => setSplits((rows) => rows.filter((_, j) => j !== i))}
                      className="h-[38px] rounded-[8px] border border-border px-2 text-text-sub hover:bg-hover hover:text-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="col-span-2">
            <label className={labelCls}>올바로 메모(기준업체량 등)</label>
            <input value={olbaroMemo} onChange={(e) => setOlbaroMemo(e.target.value)} className={inputCls} />
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
          <FileUpload label="추가 첨부" fileType="참고서류" parentType="waste_outbound" parentId={created.id} />
        </div>
      )}
    </div>
  );
}
