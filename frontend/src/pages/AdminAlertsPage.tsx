import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, Truck, Award, GraduationCap, Boxes, AlertTriangle, Clock, CalendarClock } from 'lucide-react';
import { api } from '../api/client';
import { Badge, type BadgeTone } from '../components/ui/Badge';
import {
  pageTitleCls,
  cardCls,
  cardPadCls,
  outlineBtnCls,
  inputCls,
  tableWrapCls,
  thCls,
  tdCls,
  trCls,
} from '../components/ui/classes';
import type { ExpiringAlerts, ExpiringItem } from '../types';

const TYPE_META: Record<string, { label: string; icon: typeof Truck; to: string }> = {
  vehicle_inspection: { label: '차량검사', icon: Truck, to: '/assets' },
  asset_schedule: { label: '자산일정', icon: Boxes, to: '/assets' },
  certification: { label: '자격증', icon: Award, to: '/employees' },
  training: { label: '교육', icon: GraduationCap, to: '/employees' },
};

// 임박 기준은 이 값들로 대부분 해결된다. 그 외 값은 직접 입력한다.
const PRESETS = [7, 14, 30, 60, 90];

const day = (v: string) => v.slice(0, 10);

function DDayBadge({ daysLeft }: { daysLeft: number }) {
  if (daysLeft < 0) return <Badge tone="red">D+{-daysLeft} 경과</Badge>;
  if (daysLeft === 0) return <Badge tone="red">D-DAY</Badge>;
  if (daysLeft <= 7) return <Badge tone="red">D-{daysLeft}</Badge>;
  if (daysLeft <= 30) return <Badge tone="amber">D-{daysLeft}</Badge>;
  return <Badge tone="slate">D-{daysLeft}</Badge>;
}

export function AdminAlertsPage() {
  const [threshold, setThreshold] = useState(30);
  const [typeFilter, setTypeFilter] = useState('');
  const [alerts, setAlerts] = useState<ExpiringAlerts | null>(null);

  useEffect(() => {
    api.get<ExpiringAlerts>(`/api/alerts/expiring?days=${threshold}`).then(setAlerts);
  }, [threshold]);

  // 초과 건이 먼저 보이도록 한 표에 합쳐 남은 일수 순으로 세운다.
  const rows = useMemo(() => {
    const all = [...(alerts?.overdue ?? []), ...(alerts?.imminent ?? [])];
    return all.filter((i) => !typeFilter || i.type === typeFilter).sort((a, b) => a.daysLeft - b.daysLeft);
  }, [alerts, typeFilter]);

  const overdueCount = rows.filter((i) => i.daysLeft < 0).length;
  const weekCount = rows.filter((i) => i.daysLeft >= 0 && i.daysLeft <= 7).length;
  const nearest = rows.find((i) => i.daysLeft >= 0);

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <BellRing size={20} className="text-primary" />
        <h1 className={pageTitleCls}>알림 현황</h1>
        <span className="ml-1 text-[13px] text-text-sub">
          D-{threshold} 이내 {rows.length}건
        </span>
      </div>

      <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        <SummaryCard
          icon={AlertTriangle}
          tone="danger"
          label="기한 초과"
          value={`${overdueCount}건`}
          hint="만료·예정일이 이미 지난 건"
        />
        <SummaryCard icon={Clock} tone="warning" label="7일 이내" value={`${weekCount}건`} hint="이번 주 안에 처리할 건" />
        <SummaryCard
          icon={CalendarClock}
          tone="normal"
          label={`D-${threshold} 이내`}
          value={`${rows.length}건`}
          hint="현재 임박 기준에 걸린 전체 건"
        />
        <SummaryCard
          icon={BellRing}
          tone="normal"
          label="가장 급한 건"
          value={nearest ? `D-${nearest.daysLeft}` : '-'}
          hint={nearest ? nearest.targetName : '임박 건 없음'}
        />
      </div>

      <div className={`${cardCls} mb-4 flex flex-wrap items-center gap-x-5 gap-y-3 p-3.5`}>
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-text-mid">임박 기준</span>
          <div className="flex gap-1">
            {PRESETS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setThreshold(d)}
                className={[
                  'h-8 rounded-[8px] border px-3 text-[12.5px] font-bold transition-colors',
                  threshold === d
                    ? 'border-primary bg-primary text-white'
                    : 'border-border text-text-sub hover:bg-hover hover:text-text-strong',
                ].join(' ')}
              >
                D-{d}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="1"
              max="365"
              value={threshold}
              onChange={(e) => setThreshold(Math.max(1, Number(e.target.value) || 1))}
              aria-label="임박 기준 일수"
              className={`${inputCls} h-8 w-[76px] px-2 text-center`}
            />
            <span className="text-[12.5px] text-text-faint">일</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-text-mid">구분</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className={`${inputCls} h-8 w-[140px] px-2`}
          >
            <option value="">전체</option>
            {Object.entries(TYPE_META).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => {
            setThreshold(30);
            setTypeFilter('');
          }}
          className={`${outlineBtnCls} ml-auto h-8 px-3 text-[12.5px]`}
        >
          초기화
        </button>
      </div>

      <div className={tableWrapCls}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-border">
              <th className={thCls}>구분</th>
              <th className={thCls}>대상</th>
              <th className={thCls}>기준일</th>
              <th className={thCls}>남은 기간</th>
              <th className={thCls}>상태</th>
              <th className={thCls}>바로가기</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <AlertRow key={`${i.type}-${i.targetId}`} item={i} />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-[13px] text-text-faint">
                  D-{threshold} 이내에 처리할 건이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[12.5px] text-text-faint">
        차량검사·보험·리스 등 자산 일정은{' '}
        <Link to="/assets" className="font-semibold text-primary hover:underline">
          관리 &gt; 자산 관리
        </Link>
        , 자격증·교육 이력은{' '}
        <Link to="/employees" className="font-semibold text-primary hover:underline">
          관리 &gt; 임직원 관리
        </Link>
        에서 등록·갱신합니다.
      </p>
    </div>
  );
}

function AlertRow({ item }: { item: ExpiringItem }) {
  const meta = TYPE_META[item.type] ?? { label: item.type, icon: BellRing, to: '/assets' };
  const Icon = meta.icon;
  const overdue = item.daysLeft < 0;

  return (
    <tr className={trCls}>
      <td className={`${tdCls} whitespace-nowrap`}>
        <span className="inline-flex items-center gap-1.5 text-text-sub">
          <Icon size={13} /> {meta.label}
        </span>
      </td>
      <td className={`${tdCls} font-semibold text-text-strong`}>{item.targetName}</td>
      <td className={`${tdCls} tabular whitespace-nowrap`}>{day(item.expiryDate)}</td>
      <td className={tdCls}>
        <DDayBadge daysLeft={item.daysLeft} />
      </td>
      <td className={tdCls}>
        <Badge tone={overdue ? 'red' : 'amber'}>{overdue ? '기한 초과' : '임박'}</Badge>
      </td>
      <td className={tdCls}>
        <Link to={meta.to} className="text-[12.5px] font-semibold text-primary hover:underline">
          이동
        </Link>
      </td>
    </tr>
  );
}

function SummaryCard({
  icon: Icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: typeof Truck;
  tone: 'danger' | 'warning' | 'normal';
  label: string;
  value: string;
  hint: string;
}) {
  const toneCls: Record<string, string> = {
    danger: 'text-danger',
    warning: 'text-warning',
    normal: 'text-primary',
  };
  const badgeTone: Record<string, BadgeTone> = { danger: 'red', warning: 'amber', normal: 'blue' };

  return (
    <div className={`${cardPadCls} flex items-start gap-3`}>
      <span className={`mt-0.5 ${toneCls[tone]}`}>
        <Icon size={20} />
      </span>
      <div className="min-w-0">
        <div className="mb-0.5 flex items-center gap-1.5">
          <span className="text-[12.5px] font-semibold text-text-sub">{label}</span>
          {tone !== 'normal' && <Badge tone={badgeTone[tone]}>주의</Badge>}
        </div>
        <div className="tabular text-[20px] font-extrabold text-text-strong">{value}</div>
        <div className="truncate text-[12px] text-text-faint">{hint}</div>
      </div>
    </div>
  );
}
