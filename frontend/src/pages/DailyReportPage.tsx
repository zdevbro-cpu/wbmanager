import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, FileText, FileSpreadsheet, Download, Plus, ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
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

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// 일일 출고보고 — 하루를 한 장씩 넘겨 보는 업무일지 형태.
// 그날 출고 요약과 발행한 보고서를 한 자리에서 확인한다.
export function DailyReportPage() {
  const { projects } = useProjects();
  const [month, setMonth] = useState(thisMonth());
  const [projectId, setProjectId] = useState('');
  const [days, setDays] = useState<DiaryDay[]>([]);
  const [publishDate, setPublishDate] = useState<string | null>(null);
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
        className={`${cardCls} mb-4 grid items-end gap-3 p-3 [grid-template-columns:auto_180px_minmax(0,1fr)_minmax(0,1.4fr)]`}
      >
        <div className="flex items-center gap-1 pb-0.5">
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, -1))}
            aria-label="이전 달"
            className={`${outlineBtnCls} h-[38px] px-2`}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, 1))}
            aria-label="다음 달"
            className={`${outlineBtnCls} h-[38px] px-2`}
          >
            <ChevronRight size={16} />
          </button>
        </div>
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
        <div className="space-y-3">
          {days.map((d) => (
            <DiaryEntry key={d.date} day={d} onPublish={() => setPublishDate(d.date)} onOpenReport={openReport} />
          ))}
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
                onClick={() => navigator.clipboard?.writeText(viewing.content)}
                className={outlineBtnCls}
              >
                <MessageCircle size={15} /> 카톡 공유용 복사
              </button>
              <button
                type="button"
                onClick={() => downloadFile(`/api/reports/published/${viewing.id}/export`, `${viewing.title}.txt`)}
                className={outlineBtnCls}
              >
                <Download size={15} /> 텍스트
              </button>
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

// 하루치 일지 — 왼쪽에 날짜, 가운데 요약, 오른쪽에 그날 보고서.
function DiaryEntry({
  day,
  onPublish,
  onOpenReport,
}: {
  day: DiaryDay;
  onPublish: () => void;
  onOpenReport: (id: string) => void;
}) {
  const isToday = day.date === today();
  const weekend = day.weekday === 0 || day.weekday === 6;
  const quiet = day.count === 0;

  return (
    <div className={`${cardPadCls} flex gap-4 ${quiet ? 'opacity-60' : ''}`}>
      <div className="w-[96px] shrink-0 border-r border-border pr-4">
        <div
          className={`tabular text-[24px] leading-none font-extrabold ${
            day.weekday === 0 ? 'text-danger' : weekend ? 'text-primary' : 'text-text-strong'
          }`}
        >
          {Number(day.date.slice(8, 10))}
        </div>
        <div className="mt-1 text-[12px] text-text-sub">
          {WEEKDAYS[day.weekday]}요일{isToday && <span className="ml-1 font-bold text-primary">오늘</span>}
        </div>
        <div className="tabular mt-0.5 text-[11px] text-text-faint">{day.date.slice(0, 7)}</div>
      </div>

      <div className="min-w-0 flex-1">
        {quiet ? (
          <p className="py-2 text-[13px] text-text-faint">출고 없음</p>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="text-[15px] font-bold text-text-strong">
                {day.count}건 · {kg(day.totalWeight)}
              </span>
              <span className="tabular text-[13px] text-text-sub">{won(day.totalAmount)}</span>
              <span className="flex items-center gap-1.5 text-[12.5px] text-text-sub">
                <Badge tone="green">매각 {day.saleCount}</Badge>
                {kg(day.saleWeight)}
              </span>
              {day.wasteCount > 0 && (
                <span className="flex items-center gap-1.5 text-[12.5px] text-text-sub">
                  <Badge tone="amber">폐기물 {day.wasteCount}</Badge>
                  {kg(day.wasteWeight)}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {day.byProject.map((p) => (
                <span key={p.projectName} className="rounded-[6px] border border-border px-2 py-1 text-[12px] text-text-sub">
                  {p.projectName} <span className="tabular font-semibold text-text-strong">{kg(p.weight)}</span>
                  <span className="ml-1 text-text-faint">{p.count}건</span>
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="w-[240px] shrink-0 border-l border-border pl-4">
        {day.reports.length === 0 ? (
          <div className="flex h-full flex-col items-start justify-center gap-1.5">
            <span className="text-[12px] text-text-faint">발행된 보고서 없음</span>
            <button type="button" onClick={onPublish} className={`${outlineBtnCls} h-8 px-3 text-[12.5px]`}>
              <Plus size={14} /> 보고서 발행
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
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
            <button
              type="button"
              onClick={onPublish}
              className="text-[12px] font-semibold text-text-faint hover:text-primary"
            >
              + 다시 발행
            </button>
          </div>
        )}
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
