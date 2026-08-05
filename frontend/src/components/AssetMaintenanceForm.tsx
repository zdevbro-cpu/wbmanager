import { useState } from 'react';
import { api } from '../api/client';
import { useCommonCodes, useVendors } from '../hooks/useMasters';
import { primaryBtnCls, outlineBtnCls, inputCls } from './ui/classes';

const DEFAULT_TYPES = ['정기점검', '수리', '소모품교체', '사고수리', '법정검사', '교정'];
const STATUSES = ['요청', '진행중', '완료'];

const labelCls = 'mb-1.5 block text-[13px] font-semibold text-text-mid';

// 자산 정비 등록 — 자산 상세와 정비 현황 화면에서 같은 폼을 쓴다.
// 다음 예정일을 넣으면 서버가 자산 일정을 함께 만들어 만료 알림에 잡히게 한다.
export function AssetMaintenanceForm({
  assetId,
  onDone,
  onCancel,
}: {
  assetId: string;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const { vendors } = useVendors();
  const { labels: codeTypes } = useCommonCodes('정비 구분');
  const types = codeTypes.length > 0 ? codeTypes : DEFAULT_TYPES;

  const [maintType, setMaintType] = useState(types[0] ?? '정기점검');
  const [status, setStatus] = useState('완료');
  const [vendorId, setVendorId] = useState('');
  const [requestedAt, setRequestedAt] = useState('');
  const [completedAt, setCompletedAt] = useState('');
  const [mileageAt, setMileageAt] = useState('');
  const [cost, setCost] = useState('');
  const [symptom, setSymptom] = useState('');
  const [action, setAction] = useState('');
  const [parts, setParts] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post(`/api/assets/${assetId}/maintenances`, {
        maintType,
        status,
        vendorId: vendorId || undefined,
        requestedAt: requestedAt || undefined,
        completedAt: completedAt || undefined,
        mileageAt: mileageAt || undefined,
        cost: cost || undefined,
        symptom: symptom || undefined,
        action: action || undefined,
        parts: parts || undefined,
        nextDueDate: nextDueDate || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-[10px] border border-primary/40 bg-input p-3.5">
      <div className="grid grid-cols-3 gap-x-3 gap-y-3">
        <div>
          <label className={labelCls}>정비 구분</label>
          <select value={maintType} onChange={(e) => setMaintType(e.target.value)} className={inputCls}>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>상태</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>정비업체</label>
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={inputCls}>
            <option value="">선택</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>요청일</label>
          <input type="date" value={requestedAt} onChange={(e) => setRequestedAt(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>완료일</label>
          <input type="date" value={completedAt} onChange={(e) => setCompletedAt(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>계기판(km)</label>
          <input type="number" value={mileageAt} onChange={(e) => setMileageAt(e.target.value)} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>증상</label>
          <input value={symptom} onChange={(e) => setSymptom(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>조치 내용</label>
          <input value={action} onChange={(e) => setAction(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>교체 부품</label>
          <input value={parts} onChange={(e) => setParts(e.target.value)} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>비용(원)</label>
          <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>
            다음 예정일 <span className="font-normal text-text-faint">— 입력하면 자산 일정으로 등록되어 알림에 표시됩니다</span>
          </label>
          <input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} className={inputCls} />
        </div>
      </div>

      {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}

      <div className="mt-3 flex justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className={outlineBtnCls}>
            취소
          </button>
        )}
        <button type="submit" disabled={submitting} className={primaryBtnCls}>
          {submitting ? '등록 중...' : '정비 등록'}
        </button>
      </div>
    </form>
  );
}
