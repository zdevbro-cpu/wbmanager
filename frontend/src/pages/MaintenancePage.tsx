import { useCallback, useEffect, useState } from 'react';
import { Wrench, Plus, RotateCcw } from 'lucide-react';
import { api } from '../api/client';
import { useCommonCodes } from '../hooks/useMasters';
import { FormModal } from '../components/FormModal';
import { FilterField, DateRangeField } from '../components/FilterField';
import { AssetMaintenanceForm } from '../components/AssetMaintenanceForm';
import { formatNumber } from '../lib/number';
import { Badge } from '../components/ui/Badge';
import {
  pageTitleCls,
  cardCls,
  primaryBtnCls,
  outlineBtnCls,
  inputCls,
  tableWrapCls,
  thCls,
  thNumCls,
  tdCls,
  tdNumCls,
  trCls,
} from '../components/ui/classes';
import type { Asset, AssetMaintenance } from '../types';

const STATUSES = ['요청', '진행중', '완료'];
const show = (v?: string | number | null) => (v == null || v === '' ? '-' : String(v));
const date = (v?: string | null) => (v ? v.slice(0, 10) : '-');

// 정비 현황 — 자산 구분 없이 정비 이력을 한 화면에서 보고 등록한다(설계문서 4.관리자 5).
// 자산 관리 화면 안 탭으로도 쓰기 때문에 제목줄을 감출 수 있게 한다.
export function MaintenancePage({ embedded = false }: { embedded?: boolean } = {}) {
  const [rows, setRows] = useState<AssetMaintenance[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [status, setStatus] = useState('');
  const [assetType, setAssetType] = useState('');
  const [maintType, setMaintType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [openAssetId, setOpenAssetId] = useState('');
  const [open, setOpen] = useState(false);

  const { labels: maintTypes } = useCommonCodes('정비 구분');

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (assetType) params.set('assetType', assetType);
    if (maintType) params.set('maintType', maintType);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    api.get<AssetMaintenance[]>(`/api/asset-maintenances?${params.toString()}`).then(setRows);
  }, [status, assetType, maintType, from, to]);

  useEffect(() => {
    load();
    api.get<Asset[]>('/api/assets').then(setAssets);
  }, [load]);

  const totalCost = rows.reduce((sum, r) => sum + Number(r.cost ?? 0), 0);

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        {!embedded && (
          <>
            <Wrench size={20} className="text-primary" />
            <h1 className={pageTitleCls}>정비 현황</h1>
          </>
        )}
        <span className={embedded ? 'text-[13px] text-text-sub' : 'ml-1 text-[13px] text-text-sub'}>{rows.length}건</span>
        <button type="button" onClick={() => setOpen(true)} className={`${primaryBtnCls} ml-auto`}>
          <Plus size={15} /> 정비 등록
        </button>
      </div>

      <div
        className={`${cardCls} mb-4 grid items-end gap-3 p-3 [grid-template-columns:280px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]`}
      >
        <DateRangeField label="정비기간" from={from} to={to} setFrom={setFrom} setTo={setTo} />

        <FilterField label="자산유형">
          <select value={assetType} onChange={(e) => setAssetType(e.target.value)} className={`${inputCls} px-2`}>
            <option value="">전체</option>
            <option value="VEHICLE">차량</option>
            <option value="EQUIPMENT">장비</option>
          </select>
        </FilterField>

        <FilterField label="정비구분">
          <select value={maintType} onChange={(e) => setMaintType(e.target.value)} className={`${inputCls} px-2`}>
            <option value="">전체</option>
            {maintTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="상태">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} px-2`}>
            <option value="">전체</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FilterField>

        <button
          type="button"
          onClick={() => {
            setFrom('');
            setTo('');
            setAssetType('');
            setMaintType('');
            setStatus('');
          }}
          className={`${outlineBtnCls} whitespace-nowrap px-3`}
        >
          <RotateCcw size={15} /> 초기화
        </button>
      </div>

      <div className={`${tableWrapCls} overflow-x-auto`}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-border">
              <th className={thCls}>자산번호</th>
              <th className={thCls}>자산명</th>
              <th className={thCls}>차량번호</th>
              <th className={thCls}>정비구분</th>
              <th className={thCls}>요청일</th>
              <th className={thCls}>완료일</th>
              <th className={thCls}>업체</th>
              <th className={thCls}>증상/조치</th>
              <th className={thNumCls}>계기판</th>
              <th className={thNumCls}>비용</th>
              <th className={thCls}>다음 예정</th>
              <th className={thCls}>상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className={trCls}>
                <td className={`${tdCls} tabular whitespace-nowrap`}>{show(m.asset?.assetNo)}</td>
                <td className={tdCls}>{show(m.asset?.name)}</td>
                <td className={`${tdCls} whitespace-nowrap`}>{show(m.asset?.vehicle?.plateNo)}</td>
                <td className={tdCls}>{m.maintType}</td>
                <td className={`${tdCls} tabular`}>{date(m.requestedAt)}</td>
                <td className={`${tdCls} tabular`}>{date(m.completedAt)}</td>
                <td className={tdCls}>{show(m.vendor?.name)}</td>
                <td className={tdCls}>{show(m.action ?? m.symptom)}</td>
                <td className={tdNumCls}>{formatNumber(m.mileageAt)}</td>
                <td className={tdNumCls}>{formatNumber(m.cost)}</td>
                <td className={`${tdCls} tabular`}>{date(m.nextDueDate)}</td>
                <td className={tdCls}>
                  <Badge tone={m.status === '완료' ? 'green' : 'amber'}>{m.status}</Badge>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={12} className="py-10 text-center text-[13px] text-text-faint">
                  정비 이력이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border bg-hover">
                <td className={`${tdCls} font-bold text-text-strong`} colSpan={9}>
                  합계
                </td>
                <td className={`${tdNumCls} font-bold text-text-strong`}>{formatNumber(totalCost)}</td>
                <td className={tdCls} colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {open && (
        <FormModal title="정비 등록" icon={Wrench} onClose={() => setOpen(false)}>
          <div className="mb-3">
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">자산</label>
            <select value={openAssetId} onChange={(e) => setOpenAssetId(e.target.value)} className={inputCls}>
              <option value="">선택</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.assetNo} {a.name}
                  {a.vehicle?.plateNo ? ` (${a.vehicle.plateNo})` : ''}
                </option>
              ))}
            </select>
          </div>

          {openAssetId ? (
            <AssetMaintenanceForm
              assetId={openAssetId}
              onDone={() => {
                setOpen(false);
                setOpenAssetId('');
                load();
              }}
              onCancel={() => setOpen(false)}
            />
          ) : (
            <p className="text-[13px] text-text-faint">먼저 자산을 선택하세요.</p>
          )}
        </FormModal>
      )}
    </div>
  );
}
