import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, FileText, FileSpreadsheet, Trash2, BarChart3 } from 'lucide-react';
import { api } from '../api/client';
import { downloadFile } from '../lib/download';
import { kstToday, kstThisMonth } from '../lib/datetime';
import { useProjects } from '../hooks/useMasters';
import { FormModal } from '../components/FormModal';
import { FilterField } from '../components/FilterField';
import { Badge } from '../components/ui/Badge';
import { ReportArchivePage } from './ReportArchivePage';
import {
  pageTitleCls,
  sectionTitleCls,
  cardCls,
  cardPadCls,
  primaryBtnCls,
  outlineBtnCls,
  inputCls,
} from '../components/ui/classes';
import type { DiaryDay, DiaryResponse } from '../types';
import { DateField } from '../components/ui/DateField';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const kg = (v: number) => `${Math.round(v).toLocaleString()}kg`;
const won = (v: number) => `${Math.round(v).toLocaleString()}원`;
const thisMonth = () => kstThisMonth();
const today = () => kstToday();

// 보고서 보관함 — 발행된 일일보고·손익보고를 달력과 목록 두 가지로 본다.
// 발행은 사이드바의 '출고보고서'(/daily-report)로 들어와 모달에서 한다.
export function DailyReportPage() {
  const { projects } = useProjects();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  // '일일 출고보고' 메뉴로 들어오면 발행 모달부터 띄운다.
  const publishEntry = location.pathname === '/daily-report';
  const [view, setView] = useState<'calendar' | 'list'>(searchParams.get('view') === 'list' ? 'list' : 'calendar');
  const [month, setMonth] = useState(thisMonth());
  const [projectId, setProjectId] = useState('');
  const [days, setDays] = useState<DiaryDay[]>([]);
  const [publishRange, setPublishRange] = useState<{ from: string; to: string } | null>(null);
  // 시작일만 있으면 하루, 종료일까지 있으면 구간이다.
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ month });
    if (projectId) params.set('projectId', projectId);
    api.get<DiaryResponse>(`/api/reports/daily-diary?${params.toString()}`).then((res) => setDays(res.days ?? []));
  }, [month, projectId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (publishEntry) setPublishRange({ from: today(), to: today() });
  }, [publishEntry]);

  const removeReport = async (id: string, title: string) => {
    if (!window.confirm(`'${title}' 보고서를 삭제할까요?`)) return;
    await api.del(`/api/reports/published/${id}`);
    load();
  };

  const activeDays = days.filter((d) => d.count > 0);
  const monthWeight = days.reduce((sum, d) => sum + d.totalWeight, 0);
  const monthAmount = days.reduce((sum, d) => sum + d.totalAmount, 0);
  const monthCount = days.reduce((sum, d) => sum + d.count, 0);
  const publishedCount = days.reduce((sum, d) => sum + d.reports.length, 0);

  // 고른 날이 없으면 오늘, 오늘이 이 달에 없으면 출고가 있던 마지막 날을 편다.
  const fallback = days.find((d) => d.date === today()) ?? [...activeDays].pop() ?? days[0] ?? null;
  const from = rangeStart ?? fallback?.date ?? null;
  const to = rangeEnd ?? from;
  const picked = from && to ? days.filter((d) => d.date >= from && d.date <= to) : [];

  // 발행 모달을 닫으면 보관함으로 돌아온다(발행 메뉴로 들어온 경우).
  const closePublish = () => {
    setPublishRange(null);
    if (publishEntry) navigate('/reports', { replace: true });
  };

  // '출고보고서' 메뉴로 들어와 발행 모달이 떠 있는 동안에는 뒤의 보관함 화면을 그리지 않는다.
  // 입력하는 칸 뒤로 달력과 목록이 비쳐 보이면 어디를 보고 있는지 헷갈린다.
  const publishOnly = publishEntry && !!publishRange;

  // 달력에서 시작일 → 종료일 순으로 고른다. 시작일을 다시 누르면 하루로 돌아간다.
  const pickDate = (date: string) => {
    if (!rangeStart || rangeEnd) {
      setRangeStart(date);
      setRangeEnd(null);
      return;
    }
    if (date < rangeStart) {
      setRangeStart(date);
      return;
    }
    setRangeEnd(date === rangeStart ? null : date);
  };

  return (
    <div>
      {!publishOnly && (
        <>
          <div className="mb-5 flex items-center gap-2">
            <CalendarDays size={20} className="text-primary" />
            <h1 className={pageTitleCls}>보고서 보관함</h1>
            <span className="ml-1 text-[13px] text-text-sub">
              {month} · 출고 {activeDays.length}일 / 보고서 {publishedCount}건
            </span>

            <div className="ml-auto flex items-center gap-2">
              <div className="flex overflow-hidden rounded-[10px] border border-border">
                {(['calendar', 'list'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={`px-3 py-2 text-[12.5px] font-bold ${
                      view === v ? 'bg-primary text-white' : 'text-text-sub hover:bg-hover'
                    }`}
                  >
                    {v === 'calendar' ? '달력' : '목록'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {view === 'list' ? (
            <ReportArchivePage embedded />
          ) : (
            <>
              <div
                className={`${cardCls} mb-4 grid items-end gap-3 p-3 [grid-template-columns:180px_minmax(0,1fr)_minmax(0,1.4fr)]`}
              >
                <FilterField label="기준 월">
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className={`${inputCls} px-2`}
                  />
                </FilterField>
                <FilterField label="프로젝트">
                  <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={`${inputCls} px-2`}>
                    <option value="">전체</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.roundName}
                      </option>
                    ))}
                  </select>
                </FilterField>
                <p className="pb-2 text-[12.5px] text-text-faint">
                  이 달 출고 {monthCount}건 · {kg(monthWeight)} · {won(monthAmount)} · 시작일을 누른 뒤 종료일을 누르면 구간이
                  잡힙니다.
                </p>
              </div>

              {days.length === 0 ? (
                <p className="py-16 text-center text-[13px] text-text-faint">불러오는 중이거나 해당 월 데이터가 없습니다.</p>
              ) : (
                <div className="grid grid-cols-[minmax(0,1fr)_380px] gap-4">
                  <MonthCalendar days={days} from={from} to={to} onSelect={pickDate} />
                  <RangePanel days={picked} onDelete={removeReport} />
                </div>
              )}
            </>
          )}
        </>
      )}

      {publishRange && (
        <FormModal title="출고보고서 발행" icon={FileText} onClose={closePublish}>
          <PublishDialog
            from={publishRange.from}
            to={publishRange.to}
            onDone={() => {
              closePublish();
              load();
            }}
            onCancel={closePublish}
          />
        </FormModal>
      )}
    </div>
  );
}

// 한 달을 7×5 격자로 펼친다. 칸에는 건수·중량과 발행 상태만 두고 자세한 건 옆 패널에서 본다.
function MonthCalendar({
  days,
  from,
  to,
  onSelect,
}: {
  days: DiaryDay[];
  from: string | null;
  to: string | null;
  onSelect: (date: string) => void;
}) {
  const lead = days[0]?.weekday ?? 0;
  const cells: (DiaryDay | null)[] = [...Array.from({ length: lead }, () => null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className={`${cardCls} p-3`}>
      <div className="mb-1 grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`py-1 text-center text-[12px] font-bold ${
              i === 0 ? 'text-danger' : i === 6 ? 'text-primary' : 'text-text-sub'
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((d, i) =>
          d === null ? (
            <div key={`pad-${i}`} className="min-h-[92px] rounded-[10px] border border-transparent" />
          ) : (
            <CalendarCell
              key={d.date}
              day={d}
              inRange={!!from && !!to && d.date >= from && d.date <= to}
              edge={d.date === from || d.date === to}
              onSelect={onSelect}
            />
          ),
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-text-faint">
        <span className="flex items-center gap-1">
          <Dot color="#60a5fa" /> 일일 출고보고
        </span>
        <span className="flex items-center gap-1">
          <Dot color="#a78bfa" /> 손익보고
        </span>
        <span className="flex items-center gap-1">
          <Dot color="#f59e0b" /> 출고는 있으나 미발행
        </span>
      </div>
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} />;
}

function CalendarCell({
  day: d,
  inRange,
  edge,
  onSelect,
}: {
  day: DiaryDay;
  inRange: boolean;
  edge: boolean;
  onSelect: (date: string) => void;
}) {
  const isToday = d.date === today();
  const daily = d.reports.filter((r) => r.reportType === 'daily');
  const pnl = d.reports.filter((r) => r.reportType !== 'daily');
  const missing = d.count > 0 && daily.length === 0;

  return (
    <button
      type="button"
      onClick={() => onSelect(d.date)}
      className={[
        'min-h-[92px] rounded-[10px] border p-2 text-left transition-colors',
        edge ? 'border-primary bg-nav-active' : inRange ? 'border-primary bg-nav-hover' : 'border-border hover:bg-hover',
        d.count === 0 && d.reports.length === 0 ? 'opacity-55' : '',
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        <span
          className={`tabular text-[14px] font-extrabold ${
            d.weekday === 0 ? 'text-danger' : d.weekday === 6 ? 'text-primary' : 'text-text-strong'
          }`}
        >
          {Number(d.date.slice(8, 10))}
        </span>
        {isToday && <span className="text-[10.5px] font-bold text-primary">오늘</span>}
      </div>

      {d.count === 0 ? (
        <div className="mt-2 text-[11.5px] text-text-faint">-</div>
      ) : (
        <div className="mt-1.5">
          <div className="tabular text-[12.5px] font-bold text-text-strong">{d.count}건</div>
          <div className="tabular text-[11.5px] text-text-sub">{kg(d.totalWeight)}</div>
        </div>
      )}

      <div className="mt-1.5 flex items-center gap-1">
        {daily.length > 0 && <Dot color="#60a5fa" />}
        {pnl.length > 0 && <Dot color="#a78bfa" />}
        {missing && <Dot color="#f59e0b" />}
        {d.reports.length > 0 && <span className="text-[11px] text-text-sub">{d.reports.length}</span>}
        {missing && <span className="text-[11px] text-warning">미발행</span>}
      </div>
    </button>
  );
}

// 고른 하루 또는 구간의 요약·발행·발행물. 구간이면 날짜별로 한 줄씩 편다.
function RangePanel({ days, onDelete }: { days: DiaryDay[]; onDelete: (id: string, title: string) => void }) {
  if (days.length === 0) return <div className={`${cardPadCls} text-[13px] text-text-faint`}>날짜를 고르세요.</div>;

  const single = days.length === 1;
  const first = days[0];
  const last = days[days.length - 1];
  const count = days.reduce((s, d) => s + d.count, 0);
  const weight = days.reduce((s, d) => s + d.totalWeight, 0);
  const amount = days.reduce((s, d) => s + d.totalAmount, 0);
  const activeCount = days.filter((d) => d.count > 0).length;
  const missingCount = days.filter((d) => d.count > 0 && !d.reports.some((r) => r.reportType === 'daily')).length;
  const reports = days.flatMap((d) => d.reports);

  return (
    <div className={`${cardPadCls} space-y-4`}>
      <div>
        <div className="text-[16px] font-extrabold text-text-strong">
          {single ? `${first.date} (${WEEKDAYS[first.weekday]})` : `${first.date} ~ ${last.date}`}
        </div>
        {count === 0 ? (
          <p className="mt-1 text-[13px] text-text-faint">출고 없음</p>
        ) : (
          <div className="mt-1.5 space-y-1">
            <div className="text-[15px] font-bold text-text-strong">
              {!single && `출고 ${activeCount}일 · `}
              {count}건 · {kg(weight)}
            </div>
            <div className="tabular text-[13px] text-text-sub">{won(amount)}</div>
            {single && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-text-sub">
                <span className="flex items-center gap-1.5">
                  <Badge tone="green">매각 {first.saleCount}</Badge>
                  {kg(first.saleWeight)}
                </span>
                {first.wasteCount > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Badge tone="amber">폐기물 {first.wasteCount}</Badge>
                    {kg(first.wasteWeight)}
                  </span>
                )}
              </div>
            )}
            {missingCount > 0 && <div className="text-[12.5px] text-warning">미발행 {missingCount}일</div>}
          </div>
        )}
      </div>

      {single && first.byProject.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-[12.5px] font-semibold text-text-mid">프로젝트별</h3>
          <div className="space-y-1">
            {first.byProject.map((p) => (
              <div
                key={p.projectName}
                className="flex items-center justify-between gap-2 border-b border-border pb-1 text-[12.5px]"
              >
                <span className="min-w-0 truncate text-text-sub">{p.projectName}</span>
                <span className="tabular shrink-0 font-semibold text-text-strong">
                  {kg(p.weight)} <span className="font-normal text-text-faint">{p.count}건</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!single && (
        <div>
          <h3 className="mb-1.5 text-[12.5px] font-semibold text-text-mid">날짜별</h3>
          <div className="max-h-[220px] space-y-1 overflow-y-auto pr-1">
            {days.map((d) => {
              const hasDaily = d.reports.some((r) => r.reportType === 'daily');
              return (
                <div key={d.date} className="flex items-center gap-2 border-b border-border pb-1 text-[12.5px]">
                  <span className="tabular w-[54px] shrink-0 text-text-sub">{d.date.slice(5)}</span>
                  <span className="tabular min-w-0 flex-1 truncate text-text-strong">
                    {d.count === 0 ? '-' : `${d.count}건 · ${kg(d.totalWeight)}`}
                  </span>
                  {d.count > 0 && (
                    <>
                      <span className={`shrink-0 text-[11.5px] ${hasDaily ? 'text-text-faint' : 'text-warning'}`}>
                        {hasDaily ? '발행' : '미발행'}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-1.5 text-[12.5px] font-semibold text-text-mid">발행 보고서</h3>
        {reports.length === 0 ? (
          <p className="text-[12.5px] text-text-faint">이 기간에 발행된 보고서가 없습니다.</p>
        ) : (
          <div className="space-y-1.5">
            {reports.map((rep) => (
              <div key={rep.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => downloadFile(`/api/reports/published/${rep.id}/xlsx`, `${rep.title}.xlsx`)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[12.5px] font-semibold text-primary hover:underline"
                  title="엑셀로 내려받기"
                >
                  {rep.reportType === 'daily' ? (
                    <FileSpreadsheet size={14} className="shrink-0" />
                  ) : (
                    <BarChart3 size={14} className="shrink-0" />
                  )}
                  <span className="min-w-0 truncate">{rep.title}</span>
                </button>
                <button
                  type="button"
                  title="보고서 삭제"
                  onClick={() => onDelete(rep.id, rep.title)}
                  className="shrink-0 rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-danger"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PublishDialog({
  from: initialFrom,
  to: initialTo,
  onDone,
  onCancel,
}: {
  from: string;
  to: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const publish = async () => {
    if (from > to) {
      setError('시작일이 종료일보다 늦습니다.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await api.post('/api/reports/publish', { reportType: 'daily', from, to });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : '발행 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className={`${sectionTitleCls} text-[15px]`}>
        {from === to ? `${from} 일일 출고보고` : `${from} ~ ${to} 출고보고`}
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">시작일</label>
          <DateField value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">종료일</label>
          <DateField value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
        </div>
      </div>

      <p className="text-[12.5px] text-text-faint">
        구간으로 내면 계근공유방·스크랩반출List·폐기물반출List 세 탭 모두 날짜별 블록으로 나뉘어 작성됩니다. 출고가 없던
        프로젝트는 &quot;출고 없음&quot;으로 표기됩니다.
      </p>

      {error && <p className="text-[13px] text-danger">{error}</p>}

      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <button type="button" onClick={onCancel} className={outlineBtnCls}>
          취소
        </button>
        <button type="button" onClick={publish} disabled={submitting} className={primaryBtnCls}>
          {submitting ? '발행 중...' : '발행'}
        </button>
      </div>
    </div>
  );
}
