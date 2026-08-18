import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, FileText, FileSpreadsheet, Plus } from 'lucide-react';
import { api } from '../api/client';
import { downloadFile } from '../lib/download';
import { kstToday, kstThisMonth } from '../lib/datetime';
import { useProjects } from '../hooks/useMasters';
import { FormModal } from '../components/FormModal';
import { FilterField } from '../components/FilterField';
import { Badge } from '../components/ui/Badge';
import {
  pageTitleCls,
  sectionTitleCls,
  cardCls,
  cardPadCls,
  primaryBtnCls,
  outlineBtnCls,
  inputCls,
} from '../components/ui/classes';
import type { DiaryDay, DiaryResponse, SavedReport } from '../types';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const kg = (v: number) => `${Math.round(v).toLocaleString()}kg`;
const won = (v: number) => `${Math.round(v).toLocaleString()}원`;
const thisMonth = () => kstThisMonth();
const today = () => kstToday();

// 일일 출고보고 — 하루를 한 장씩 넘겨 보는 업무일지 형태.
// 그날 출고 요약과 발행한 보고서를 한 자리에서 확인한다.
export function DailyReportPage() {
  const { projects } = useProjects();
  const [month, setMonth] = useState(thisMonth());
  const [projectId, setProjectId] = useState('');
  const [days, setDays] = useState<DiaryDay[]>([]);
  const [publishDate, setPublishDate] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [viewing, setViewing] = useState<SavedReport | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ month });
    if (projectId) params.set('projectId', projectId);
    api.get<DiaryResponse>(`/api/reports/daily-diary?${params.toString()}`).then((res) => setDays(res.days ?? []));
  }, [month, projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const activeDays = days.filter((d) => d.count > 0);
  const monthWeight = days.reduce((sum, d) => sum + d.totalWeight, 0);
  const monthAmount = days.reduce((sum, d) => sum + d.totalAmount, 0);
  const monthCount = days.reduce((sum, d) => sum + d.count, 0);
  const publishedCount = days.reduce((sum, d) => sum + d.reports.length, 0);
  // 고른 날이 없으면 오늘, 오늘이 이 달에 없으면 출고가 있던 마지막 날을 편다.
  const selectedDay =
    days.find((d) => d.date === selected) ??
    days.find((d) => d.date === today()) ??
    [...activeDays].pop() ??
    days[0] ??
    null;

  const openReport = async (id: string) => {
    const report = await api.get<SavedReport>(`/api/reports/published/${id}`);
    setViewing(report);
  };

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <CalendarDays size={20} className="text-primary" />
        <h1 className={pageTitleCls}>일일 출고보고</h1>
        <span className="ml-1 text-[13px] text-text-sub">
          {month} · 출고 {activeDays.length}일 / 보고서 {publishedCount}건
        </span>
        <button type="button" onClick={() => setPublishDate(today())} className={`${primaryBtnCls} ml-auto`}>
          <Plus size={15} /> 오늘 보고서 발행
        </button>
      </div>

      <div
        className={`${cardCls} mb-4 grid items-end gap-3 p-3 [grid-template-columns:180px_minmax(0,1fr)_minmax(0,1.4fr)]`}
      >
        <FilterField label="기준 월">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={`${inputCls} px-2`} />
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
          이 달 출고 {monthCount}건 · {kg(monthWeight)} · {won(monthAmount)}
        </p>
      </div>

      {days.length === 0 ? (
        <p className="py-16 text-center text-[13px] text-text-faint">불러오는 중이거나 해당 월 데이터가 없습니다.</p>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-4">
          <MonthCalendar days={days} selected={selectedDay?.date ?? null} onSelect={setSelected} />
          <DayPanel
            day={selectedDay}
            onPublish={() => selectedDay && setPublishDate(selectedDay.date)}
            onOpenReport={openReport}
          />
        </div>
      )}

      {publishDate && (
        <FormModal title={`${publishDate} 보고서 발행`} icon={FileText} onClose={() => setPublishDate(null)}>
          <PublishDialog
            date={publishDate}
            onDone={() => {
              setPublishDate(null);
              load();
            }}
            onCancel={() => setPublishDate(null)}
          />
        </FormModal>
      )}

      {viewing && (
        <FormModal title={viewing.title} icon={FileText} onClose={() => setViewing(null)}>
          <div className="space-y-3">
            <pre className="max-h-[60vh] overflow-y-auto rounded-[10px] border border-border bg-input p-4 text-[12.5px] leading-relaxed whitespace-pre-wrap text-text">
              {viewing.content}
            </pre>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => downloadFile(`/api/reports/published/${viewing.id}/xlsx`, `${viewing.title}.xlsx`)}
                className={primaryBtnCls}
              >
                <FileSpreadsheet size={15} /> 엑셀(xlsx)
              </button>
            </div>
          </div>
        </FormModal>
      )}
    </div>
  );
}

// 한 달을 7×5 격자로 펼친다. 칸에는 건수·중량과 보고서 발행 여부만 두고 자세한 건 옆 패널에서 본다.
function MonthCalendar({
  days,
  selected,
  onSelect,
}: {
  days: DiaryDay[];
  selected: string | null;
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
            <div key={`pad-${i}`} className="min-h-[88px] rounded-[10px] border border-transparent" />
          ) : (
            <CalendarCell key={d.date} day={d} selected={d.date === selected} onSelect={onSelect} />
          ),
        )}
      </div>
    </div>
  );
}

function CalendarCell({
  day: d,
  selected,
  onSelect,
}: {
  day: DiaryDay;
  selected: boolean;
  onSelect: (date: string) => void;
}) {
  const isToday = d.date === today();
  const published = d.reports.length > 0;

  return (
    <button
      type="button"
      onClick={() => onSelect(d.date)}
      className={[
        'min-h-[88px] rounded-[10px] border p-2 text-left transition-colors',
        selected ? 'border-primary bg-nav-active' : 'border-border hover:bg-hover',
        d.count === 0 ? 'opacity-55' : '',
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
          <div className="mt-1 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: published ? '#22c55e' : '#f59e0b' }} />
            <span className={`text-[11px] ${published ? 'text-text-sub' : 'text-warning'}`}>
              {published ? `보고서 ${d.reports.length}` : '미발행'}
            </span>
          </div>
        </div>
      )}
    </button>
  );
}

// 고른 날의 상세 — 예전 목록 카드에 있던 내용을 그대로 옮겼다.
function DayPanel({
  day,
  onPublish,
  onOpenReport,
}: {
  day: DiaryDay | null;
  onPublish: () => void;
  onOpenReport: (id: string) => void;
}) {
  if (!day) return <div className={`${cardPadCls} text-[13px] text-text-faint`}>날짜를 고르세요.</div>;

  return (
    <div className={`${cardPadCls} space-y-4`}>
      <div>
        <div className="text-[16px] font-extrabold text-text-strong">
          {day.date} ({WEEKDAYS[day.weekday]})
        </div>
        {day.count === 0 ? (
          <p className="mt-1 text-[13px] text-text-faint">출고 없음</p>
        ) : (
          <div className="mt-1.5 space-y-1">
            <div className="text-[15px] font-bold text-text-strong">
              {day.count}건 · {kg(day.totalWeight)}
            </div>
            <div className="tabular text-[13px] text-text-sub">{won(day.totalAmount)}</div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-text-sub">
              <span className="flex items-center gap-1.5">
                <Badge tone="green">매각 {day.saleCount}</Badge>
                {kg(day.saleWeight)}
              </span>
              {day.wasteCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <Badge tone="amber">폐기물 {day.wasteCount}</Badge>
                  {kg(day.wasteWeight)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {day.byProject.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-[12.5px] font-semibold text-text-mid">프로젝트별</h3>
          <div className="space-y-1">
            {day.byProject.map((p) => (
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

      <div>
        <h3 className="mb-1.5 text-[12.5px] font-semibold text-text-mid">발행 보고서</h3>
        {day.reports.length === 0 ? (
          <p className="mb-2 text-[12.5px] text-text-faint">발행된 보고서가 없습니다.</p>
        ) : (
          <div className="mb-2 space-y-1.5">
            {day.reports.map((rep) => (
              <div key={rep.id} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onOpenReport(rep.id)}
                  className="min-w-0 flex-1 truncate text-left text-[12.5px] font-semibold text-primary hover:underline"
                  title={rep.title}
                >
                  {rep.title}
                </button>
                <button
                  type="button"
                  title="엑셀 내려받기"
                  onClick={() => downloadFile(`/api/reports/published/${rep.id}/xlsx`, `${rep.title}.xlsx`)}
                  className="shrink-0 rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-text-strong"
                >
                  <FileSpreadsheet size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <button type="button" onClick={onPublish} className={`${outlineBtnCls} h-8 px-3 text-[12.5px]`}>
          <Plus size={14} /> {day.reports.length === 0 ? '보고서 발행' : '다시 발행'}
        </button>
      </div>
    </div>
  );
}

function PublishDialog({ date, onDone, onCancel }: { date: string; onDone: () => void; onCancel: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const publish = async () => {
    setError('');
    setSubmitting(true);
    try {
      await api.post('/api/reports/publish', { reportType: 'daily', date });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : '발행 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className={`${sectionTitleCls} text-[15px]`}>{date} 일일 출고보고</h3>
      <p className="text-[13px] text-text-sub">
        앞단에 그날 전체 요약을 두고, 진행 중인 프로젝트를 하나씩 담아 한 장으로 만듭니다. 출고가 없던 프로젝트는 &quot;출고
        없음&quot;으로 표기됩니다. 발행 후 엑셀(xlsx)로 내려받을 수 있습니다.
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
