import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, Truck, Award, GraduationCap, Boxes, AlertTriangle, Clock, CalendarClock, ArrowUpRight, History, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { kstStamp } from '../lib/datetime';
import { Badge, type BadgeTone } from '../components/ui/Badge';
import {
  pageTitleCls,
  sectionTitleCls,
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
          {/* 라벨이 좁아지면 글자가 세로로 쪼개지므로 줄바꿈과 축소를 막는다. */}
          <span className="shrink-0 whitespace-nowrap text-[13px] font-semibold text-text-mid">임박 기준</span>
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
            <span className="shrink-0 whitespace-nowrap text-[12.5px] text-text-faint">일</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="shrink-0 whitespace-nowrap text-[13px] font-semibold text-text-mid">구분</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className={`${inputCls} h-8 w-[140px] shrink-0 px-2`}
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

      <RecentFeed />

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
        <Link
          to={meta.to}
          title={`${meta.label} 화면으로 이동`}
          aria-label={`${meta.label} 화면으로 이동`}
          className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] border border-border text-primary hover:bg-hover"
        >
          <ArrowUpRight size={15} />
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

// 최근 변경 피드 — 어제 누가 무엇을 등록·수정했는지.
// 관리자 이력 화면에 들어가야만 알 수 있던 것을 같이 일하는 사람 모두가 보게 한다.
interface FeedItem {
  id: string;
  action: 'create' | 'update' | 'delete';
  target: string;
  summary: string | null;
  who: string;
  createdAt: string;
}

const ACTION_LABEL: Record<string, string> = { create: '등록', update: '수정', delete: '삭제' };
// 로그 줄 위 조건·쪽 이동 단추는 표보다 작게 두어 표가 주인공이 되게 한다.
const feedCtlCls =
  'rounded-[8px] border border-border bg-input px-2 py-1 text-[12.5px] text-input-text';

const ACTION_TONE: Record<string, string> = {
  create: 'bg-success/15 text-success',
  update: 'bg-primary/15 text-primary',
  delete: 'bg-danger/15 text-danger',
};

// 경로 조각을 사람이 쓰는 말로 바꾼다. 모르는 것은 그대로 둔다.
const TARGET_LABEL: Record<string, string> = {
  inbounds: '입고',
  'waste-inbounds': '폐기물 수집·운반',
  outbounds: '출고',
  'waste-outbounds': '폐기물 반출',
  projects: '프로젝트',
  assets: '자산',
  employees: '임직원',
  vendors: '거래처',
  'item-masters': '품목',
  'common-codes': '공통코드',
  attachments: '첨부',
  dms: '문서',
  reports: '보고서',
  transports: '운반비',
  labors: '공수표',
  'external-drivers': '운전자',
  'asset-maintenances': '정비',
};

function RecentFeed() {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === 'admin';

  const [items, setItems] = useState<FeedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [days, setDays] = useState(2);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [size, setSize] = useState(30);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);

  // 날짜 구간을 적으면 그 구간이 기준이 된다. 비우면 위의 기간 선택을 따른다.
  const ranged = Boolean(from || to);
  const query = `${ranged ? `from=${from}&to=${to}` : `days=${days}`}&size=${size}&offset=${page * size}`;

  const load = () => {
    api
      .get<{ items: FeedItem[]; total: number } | FeedItem[]>(`/api/audit-logs/recent?paged=1&${query}`)
      .then((r) => {
        // 서버가 아직 이전 판이면 배열만 온다. 그때는 받은 것을 한 쪽으로 보여 준다.
        const list = Array.isArray(r) ? r : r.items;
        setItems(list);
        setTotal(Array.isArray(r) ? list.length : r.total);
      });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, from, to, size, page]);

  // 조건이 바뀌면 첫 쪽으로 돌아간다. 3쪽을 보다 조건을 좁히면 빈 쪽이 나온다.
  useEffect(() => {
    setPage(0);
  }, [days, from, to, size]);

  const lastPage = Math.max(Math.ceil(total / size) - 1, 0);

  const remove = async () => {
    if (!from || !to) {
      alert('삭제할 기간의 시작일과 종료일을 모두 지정해 주세요.');
      return;
    }
    if (!confirm(`${from} ~ ${to} 구간의 변경 로그 ${total}건을 삭제합니다.\n삭제한 로그는 되돌릴 수 없습니다. 진행할까요?`)) return;

    setBusy(true);
    try {
      const r = await api.del<{ count: number }>(`/api/audit-logs/recent?from=${from}&to=${to}`);
      alert(`${r.count}건을 삭제했습니다.`);
      setPage(0);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <History size={16} className="text-primary" />
        <h2 className={`${sectionTitleCls} text-[15px]`}>최근 변경 로그</h2>
        <span className="text-[13px] text-text-sub">{total}건</span>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            disabled={ranged}
            className={`${feedCtlCls} disabled:opacity-40`}
          >
            <option value={1}>오늘</option>
            <option value={2}>어제부터</option>
            <option value={7}>최근 7일</option>
            <option value={30}>최근 30일</option>
          </select>

          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={feedCtlCls} />
          <span className="text-text-faint">~</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={feedCtlCls} />
          {ranged && (
            <button
              type="button"
              onClick={() => {
                setFrom('');
                setTo('');
              }}
              className={`${feedCtlCls} text-text-sub`}
            >
              구간 해제
            </button>
          )}

          <select value={size} onChange={(e) => setSize(Number(e.target.value))} className={feedCtlCls}>
            <option value={30}>30건씩</option>
            <option value={50}>50건씩</option>
            <option value={100}>100건씩</option>
          </select>

          {isAdmin && (
            <button
              type="button"
              onClick={remove}
              disabled={busy || !from || !to || total === 0}
              className={`${feedCtlCls} inline-flex items-center gap-1 text-danger disabled:opacity-40`}
            >
              <Trash2 size={13} /> 구간 삭제
            </button>
          )}
        </div>
      </div>

      <div className={tableWrapCls}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-border">
              <th className={thCls}>일시</th>
              <th className={thCls}>구분</th>
              <th className={thCls}>대상</th>
              <th className={thCls}>내용</th>
              <th className={thCls}>사용자</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className={trCls}>
                <td className={`${tdCls} tabular whitespace-nowrap`}>{kstStamp(i.createdAt)}</td>
                <td className={tdCls}>
                  <span className={`rounded-[5px] px-1.5 py-0.5 text-[11px] font-bold ${ACTION_TONE[i.action] ?? ''}`}>
                    {ACTION_LABEL[i.action] ?? i.action}
                  </span>
                </td>
                <td className={`${tdCls} whitespace-nowrap`}>{TARGET_LABEL[i.target] ?? i.target}</td>
                <td className={tdCls}>{i.summary ?? '-'}</td>
                <td className={`${tdCls} whitespace-nowrap`}>{i.who}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-[13px] text-text-faint">
                  이 기간에 등록·수정된 건이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > size && (
        <div className="mt-2 flex items-center justify-center gap-2 text-[12.5px] text-text-sub">
          <button
            type="button"
            onClick={() => setPage((n) => Math.max(n - 1, 0))}
            disabled={page === 0}
            className={`${feedCtlCls} inline-flex items-center gap-0.5 disabled:opacity-40`}
          >
            <ChevronLeft size={13} /> 이전
          </button>
          <span className="tabular">
            {page + 1} / {lastPage + 1} 쪽
          </span>
          <button
            type="button"
            onClick={() => setPage((n) => Math.min(n + 1, lastPage))}
            disabled={page >= lastPage}
            className={`${feedCtlCls} inline-flex items-center gap-0.5 disabled:opacity-40`}
          >
            다음 <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
