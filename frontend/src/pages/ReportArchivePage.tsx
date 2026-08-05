import { useCallback, useEffect, useState } from 'react';
import { FileText, Eye, Download, Trash2, Plus, RotateCcw, Copy, FileType2 } from 'lucide-react';
import { api } from '../api/client';
import { downloadFile } from '../lib/download';
import { useProjects } from '../hooks/useMasters';
import { FormModal } from '../components/FormModal';
import { FilterField, DateRangeField } from '../components/FilterField';
import { Badge } from '../components/ui/Badge';
import {
  pageTitleCls,
  cardCls,
  primaryBtnCls,
  outlineBtnCls,
  inputCls,
  tableWrapCls,
  thCls,
  tdCls,
  trCls,
} from '../components/ui/classes';
import type { SavedReport } from '../types';

const TYPE_LABEL: Record<string, string> = { daily: '일일 출고보고', pnl: '손익 보고' };

const day = (v?: string | null) => (v ? v.slice(0, 10) : '-');
const num = (v: unknown) => (v == null ? '-' : Math.round(Number(v)).toLocaleString());

// 발행한 보고서 보관함 — 일일 출고보고·손익보고를 발행 시점 그대로 남겨 다시 열람·전달한다.
export function ReportArchivePage() {
  const { projects } = useProjects();
  const [rows, setRows] = useState<SavedReport[]>([]);
  const [reportType, setReportType] = useState('');
  const [projectId, setProjectId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [detail, setDetail] = useState<SavedReport | null>(null);
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (reportType) params.set('reportType', reportType);
    if (projectId) params.set('projectId', projectId);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    api.get<SavedReport[]>(`/api/reports/published?${params.toString()}`).then(setRows);
  }, [reportType, projectId, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (r: SavedReport) => {
    if (!window.confirm(`'${r.title}' 보고서를 삭제하시겠습니까?`)) return;
    await api.del(`/api/reports/published/${r.id}`);
    load();
  };

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <FileText size={20} className="text-primary" />
        <h1 className={pageTitleCls}>보고서 보관함</h1>
        <span className="ml-1 text-[13px] text-text-sub">{rows.length}건</span>
        <button type="button" onClick={() => setPublishing(true)} className={`${primaryBtnCls} ml-auto`}>
          <Plus size={15} /> 보고서 발행
        </button>
      </div>

      <div
        className={`${cardCls} mb-4 grid items-end gap-3 p-3 [grid-template-columns:280px_minmax(0,1fr)_minmax(0,1fr)_auto]`}
      >
        <DateRangeField label="보고일" from={from} to={to} setFrom={setFrom} setTo={setTo} />
        <FilterField label="보고서 유형">
          <select value={reportType} onChange={(e) => setReportType(e.target.value)} className={`${inputCls} px-2`}>
            <option value="">전체</option>
            <option value="daily">일일 출고보고</option>
            <option value="pnl">손익 보고</option>
          </select>
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
        <button
          type="button"
          onClick={() => {
            setReportType('');
            setProjectId('');
            setFrom('');
            setTo('');
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
              <th className={thCls}>보고일</th>
              <th className={thCls}>유형</th>
              <th className={thCls}>제목</th>
              <th className={thCls}>프로젝트</th>
              <th className={`${thCls} text-right`}>건수/중량</th>
              <th className={`${thCls} text-right`}>금액/손익</th>
              <th className={thCls}>발행일시</th>
              <th className={thCls}>관리</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={trCls}>
                <td className={`${tdCls} tabular whitespace-nowrap`}>{day(r.reportDate)}</td>
                <td className={tdCls}>
                  <Badge tone={r.reportType === 'pnl' ? 'purple' : 'blue'}>{TYPE_LABEL[r.reportType] ?? r.reportType}</Badge>
                </td>
                <td className={`${tdCls} font-semibold text-text-strong`}>{r.title}</td>
                <td className={tdCls}>{r.project?.roundName ?? '전체'}</td>
                <td className={`${tdCls} tabular text-right whitespace-nowrap`}>
                  {r.reportType === 'daily'
                    ? `${r.summary?.count ?? 0}건 / ${num(r.summary?.totalWeight)}kg`
                    : `${num(r.summary?.soldWeight)}kg / 회수 ${Number(r.summary?.recoveryRate ?? 0).toFixed(1)}%`}
                </td>
                <td className={`${tdCls} tabular text-right whitespace-nowrap`}>
                  {r.reportType === 'daily' ? num(r.summary?.totalAmount) : num(r.summary?.expectedFinalPnl)}
                </td>
                <td className={`${tdCls} tabular whitespace-nowrap`}>{r.createdAt.slice(0, 16).replace('T', ' ')}</td>
                <td className={`${tdCls} whitespace-nowrap`}>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      title="보기"
                      onClick={() => setDetail(r)}
                      className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-text-strong"
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      type="button"
                      title="워드(docx) 내려받기"
                      onClick={() => downloadFile(`/api/reports/published/${r.id}/docx`, `${r.title}.docx`)}
                      className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-text-strong"
                    >
                      <FileType2 size={15} />
                    </button>
                    <button
                      type="button"
                      title="텍스트 저장"
                      onClick={() => downloadFile(`/api/reports/published/${r.id}/export`, `${r.title}.txt`)}
                      className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-text-strong"
                    >
                      <Download size={15} />
                    </button>
                    <button
                      type="button"
                      title="삭제"
                      onClick={() => remove(r)}
                      className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-10 text-center text-[13px] text-text-faint">
                  발행된 보고서가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {publishing && (
        <FormModal title="보고서 발행" icon={FileText} onClose={() => setPublishing(false)}>
          <PublishForm
            projects={projects}
            onDone={() => {
              setPublishing(false);
              load();
            }}
            onCancel={() => setPublishing(false)}
          />
        </FormModal>
      )}

      {detail && (
        <FormModal title={detail.title} icon={FileText} onClose={() => setDetail(null)}>
          <div className="space-y-3">
            <pre className="max-h-[60vh] overflow-y-auto rounded-[10px] border border-border bg-input p-4 text-[12.5px] leading-relaxed whitespace-pre-wrap text-text">
              {detail.content}
            </pre>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(detail.content)}
                className={outlineBtnCls}
              >
                <Copy size={15} /> 본문 복사
              </button>
              <button
                type="button"
                onClick={() => downloadFile(`/api/reports/published/${detail.id}/export`, `${detail.title}.txt`)}
                className={outlineBtnCls}
              >
                <Download size={15} /> 텍스트 저장
              </button>
              <button
                type="button"
                onClick={() => downloadFile(`/api/reports/published/${detail.id}/docx`, `${detail.title}.docx`)}
                className={primaryBtnCls}
              >
                <FileType2 size={15} /> 워드(docx)
              </button>
            </div>
          </div>
        </FormModal>
      )}
    </div>
  );
}

function PublishForm({
  projects,
  onDone,
  onCancel,
}: {
  projects: { id: string; roundName: string }[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [reportType, setReportType] = useState<'daily' | 'pnl'>('daily');
  const [projectId, setProjectId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult('');
    setSubmitting(true);
    try {
      await api.post('/api/reports/publish', { reportType, projectId: projectId || undefined, date });
      setResult('보고서를 발행했습니다.');
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : '발행 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">보고서 유형</label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as 'daily' | 'pnl')}
            className={inputCls}
          >
            <option value="daily">일일 출고보고</option>
            <option value="pnl">손익 보고 (대표이사 보고용)</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">보고일</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputCls} />
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">프로젝트</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className={inputCls}
          >
            <option value="">{reportType === 'daily' ? '진행 중 전체' : '선택'}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.roundName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-[12.5px] text-text-faint">
        {reportType === 'daily'
          ? '앞단에 그날 전체 요약을 두고, 진행 중인 프로젝트를 하나씩 담아 한 장으로 만듭니다. 출고가 없던 프로젝트는 "출고 없음"으로 표기됩니다.'
          : '반입 대비 회수율, 손익 3단 요약, 품목별 매각 구성, 재고평가를 대표이사 보고 양식으로 만듭니다.'}
      </p>

      {error && <p className="text-[13px] text-danger">{error}</p>}
      {result && <p className="text-[13px] text-success">{result}</p>}

      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <button type="button" onClick={onCancel} className={outlineBtnCls}>
          취소
        </button>
        <button type="submit" disabled={submitting} className={primaryBtnCls}>
          {submitting ? '발행 중...' : '발행'}
        </button>
      </div>
    </form>
  );
}
