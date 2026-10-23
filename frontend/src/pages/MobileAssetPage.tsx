import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Search, Wrench, Car, FileDown, MapPin } from 'lucide-react';
import { api, API_BASE_URL } from '../api/client';
import { auth } from '../lib/firebase';
import type { Asset, AssetMaintenance, Attachment } from '../types';
import { formatNumber } from '../lib/number';

// 현장에서 휴대폰으로 장비를 찾아보는 화면 (회의 2026-10-14 5-6 · 5-7).
//
// 기사님이 차 앞에서 번호를 치면 그 장비의 서류와 정비 이력이 바로 나와야 한다.
// 보기만 한다 — 여기서는 고치거나 지우지 않는다.

const field = 'w-full rounded-[10px] border border-border bg-input px-3 py-3 text-[16px] text-input-text';
const card = 'rounded-[12px] border border-border bg-card px-4 py-3';

const show = (v?: string | null) => (v == null || v === '' ? '-' : v);
const day = (v?: string | null) => (v ? v.slice(0, 10) : '-');

export function MobileAssetPage() {
  const [q, setQ] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [picked, setPicked] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('isCompany', 'true');
    if (q.trim()) params.set('q', q.trim());
    api
      .get<Asset[]>(`/api/assets?${params.toString()}`)
      .then(setAssets)
      .finally(() => setLoading(false));
  }, [q]);

  useEffect(() => {
    // 치는 동안 매번 부르지 않는다. 손을 멈추면 그때 찾는다.
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  if (picked) return <AssetDetail asset={picked} onBack={() => setPicked(null)} />;

  return (
    <div className="mx-auto min-h-screen max-w-[520px] bg-bg px-4 pb-10 pt-4">
      <div className="mb-4 flex items-center gap-2">
        <img src="/원방로고.png" alt="원방" className="h-8 w-8 shrink-0 rounded-[9px] bg-white object-contain p-0.5" />
        <h1 className="text-[17px] font-extrabold text-text-strong">장비 조회</h1>
        <Link to="/mobile" className="ml-auto text-[12.5px] text-text-sub underline">
          출퇴근
        </Link>
      </div>

      <div className="relative mb-3">
        <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="차량번호 · 장비명 · 관리번호"
          className={`${field} pl-9`}
          autoFocus
        />
      </div>

      <p className="mb-3 text-[12.5px] text-text-faint">
        {loading ? '찾는 중…' : `${assets.length}대`}
      </p>

      <div className="flex flex-col gap-2">
        {assets.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setPicked(a)}
            className={`${card} text-left active:bg-hover`}
          >
            <div className="flex items-center gap-2">
              {a.assetType === 'VEHICLE' ? (
                <Car size={15} className="shrink-0 text-primary" />
              ) : (
                <Wrench size={15} className="shrink-0 text-primary" />
              )}
              <span className="text-[15px] font-bold text-text-strong">{a.name}</span>
              <span className="ml-auto shrink-0 text-[12.5px] text-text-sub">{a.assetNo}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[13px] text-text-sub">
              {a.vehicle?.plateNo && <span className="font-semibold text-text">{a.vehicle.plateNo}</span>}
              {a.modelName && <span>{a.modelName}</span>}
              {a.location && (
                <span className="flex items-center gap-0.5">
                  <MapPin size={12} /> {a.location}
                </span>
              )}
            </div>
          </button>
        ))}
        {!loading && assets.length === 0 && (
          <p className="py-10 text-center text-[13px] text-text-faint">찾는 장비가 없습니다.</p>
        )}
      </div>
    </div>
  );
}

function AssetDetail({ asset, onBack }: { asset: Asset; onBack: () => void }) {
  const [full, setFull] = useState<Asset | null>(null);

  useEffect(() => {
    api.get<Asset>(`/api/assets/${asset.id}`).then(setFull);
  }, [asset.id]);

  const a = full ?? asset;
  const maints: AssetMaintenance[] = useMemo(() => a.maintenances ?? [], [a]);
  const docs: Attachment[] = useMemo(() => a.attachments ?? [], [a]);

  // 서류는 드라이브에 있다. 사무실 화면과 같은 주소로 받는다.
  const download = async (att: Attachment) => {
    const token = await auth.currentUser?.getIdToken();
    const url = `${API_BASE_URL}/api/attachments/${att.id}/content`;
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) {
      window.alert('파일을 받지 못했습니다.');
      return;
    }
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = att.fileName ?? '첨부';
    link.click();
    URL.revokeObjectURL(href);
  };

  return (
    <div className="mx-auto min-h-screen max-w-[520px] bg-bg px-4 pb-10 pt-4">
      <div className="mb-4 flex items-center gap-2">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-[13px] text-text-sub">
          <ChevronLeft size={16} /> 목록
        </button>
      </div>

      <div className={`${card} mb-3`}>
        <div className="flex items-center gap-2">
          {a.assetType === 'VEHICLE' ? <Car size={16} className="text-primary" /> : <Wrench size={16} className="text-primary" />}
          <h1 className="text-[17px] font-extrabold text-text-strong">{a.name}</h1>
          <span className="ml-auto text-[12.5px] text-text-sub">{a.assetNo}</span>
        </div>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13.5px]">
          {[
            ['차량번호', a.vehicle?.plateNo],
            ['모델', a.modelName],
            ['현재위치', a.location],
            ['상태', a.status],
            ['검사만료', a.vehicle?.inspectionNext ? day(a.vehicle.inspectionNext) : null],
            ['보험만기', a.vehicle?.insuranceEnd ? day(a.vehicle.insuranceEnd) : null],
          ]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={String(k)} className="contents">
                <dt className="text-text-faint">{k}</dt>
                <dd className="font-semibold text-text">{String(v)}</dd>
              </div>
            ))}
        </dl>
      </div>

      <h2 className="mb-2 text-[14px] font-extrabold text-text-strong">서류 {docs.length}건</h2>
      <div className="mb-4 flex flex-col gap-2">
        {docs.map((d) => (
          <button key={d.id} type="button" onClick={() => download(d)} className={`${card} flex items-center gap-2 text-left active:bg-hover`}>
            <FileDown size={15} className="shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-[13.5px] text-text">{show(d.fileName)}</span>
            {d.fileType && <span className="shrink-0 text-[12px] text-text-faint">{d.fileType}</span>}
          </button>
        ))}
        {docs.length === 0 && <p className={`${card} text-[13px] text-text-faint`}>올라온 서류가 없습니다.</p>}
      </div>

      <h2 className="mb-2 text-[14px] font-extrabold text-text-strong">정비 이력 {maints.length}건</h2>
      <div className="flex flex-col gap-2">
        {maints.map((m) => (
          <div key={m.id} className={card}>
            <div className="flex items-center gap-2">
              <span className="text-[13.5px] font-bold text-text-strong">{m.maintType}</span>
              <span className="ml-auto text-[12.5px] text-text-sub">{day(m.completedAt ?? m.requestedAt)}</span>
            </div>
            {m.symptom && <p className="mt-1 text-[13px] text-text">{m.symptom}</p>}
            {m.action && <p className="mt-0.5 text-[13px] text-text-sub">{m.action}</p>}
            <div className="mt-1 flex flex-wrap gap-x-3 text-[12.5px] text-text-faint">
              {m.hoursAt != null && <span>가동 {formatNumber(m.hoursAt)}h</span>}
              {m.mileageAt != null && <span>주행 {formatNumber(m.mileageAt)}km</span>}
              {m.cost != null && <span>{formatNumber(Number(m.cost))}원</span>}
              {m.nextDueDate && <span>다음 {day(m.nextDueDate)}</span>}
            </div>
          </div>
        ))}
        {maints.length === 0 && <p className={`${card} text-[13px] text-text-faint`}>정비 이력이 없습니다.</p>}
      </div>

      <p className="mt-4 text-[12px] leading-relaxed text-text-faint">
        여기서는 보기만 합니다. 고치거나 지우는 것은 사무실 화면에서 합니다.
      </p>
    </div>
  );
}
