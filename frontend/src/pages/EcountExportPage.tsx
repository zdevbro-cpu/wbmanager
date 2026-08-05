import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { api, API_BASE_URL } from '../api/client';
import { useProjects } from '../hooks/useMasters';
import { auth } from '../lib/firebase';
import { pageTitleCls, sectionTitleCls, primaryBtnCls, inputCls, cardPadCls } from '../components/ui/classes';

interface ExportSummary {
  inbound: { count: number; mismatchCount: number };
  outbound: { count: number; mismatchCount: number };
}

export function EcountExportPage() {
  const { projects } = useProjects();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [projectId, setProjectId] = useState('');
  const [summary, setSummary] = useState<ExportSummary | null>(null);
  const [downloading, setDownloading] = useState('');
  const [error, setError] = useState('');

  const query = new URLSearchParams({
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(projectId ? { projectId } : {}),
  }).toString();

  useEffect(() => {
    api
      .get<ExportSummary>(`/api/exports/ecount/summary?${query}`)
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [query]);

  // 인증 헤더가 필요해 링크가 아닌 fetch로 받아 blob으로 저장한다.
  const download = async (kind: 'inbounds' | 'outbounds', label: string) => {
    setError('');
    setDownloading(kind);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/exports/ecount/${kind}?${query}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`다운로드 실패 (${res.status})`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ecount_${label}_${from || '전체'}_${to || '전체'}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '다운로드 실패');
    } finally {
      setDownloading('');
    }
  };

  return (
    <div className="max-w-[720px]">
      <div className="mb-5 flex items-center gap-2">
        <FileSpreadsheet size={20} className="text-primary" />
        <h1 className={pageTitleCls}>ecount 업로드용 내보내기</h1>
      </div>

      <p className="mb-5 text-[13px] text-text-sub">
        ecount 구매입력·판매입력 화면의 컬럼 구성과 순서에 맞춘 엑셀 파일을 생성합니다. 내려받은 파일을 ecount에서 그대로
        업로드하세요.
      </p>

      <div className={`${cardPadCls} mb-6 flex flex-wrap items-end gap-2`}>
        <div className="min-w-[150px]">
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">시작일</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
        </div>
        <div className="min-w-[150px]">
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">종료일</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
        </div>
        <div className="min-w-[180px] flex-1">
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">프로젝트(차수)</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputCls}>
            <option value="">전체</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.roundName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="mb-4 text-[13px] text-danger">{error}</p>}

      <div className="flex flex-wrap gap-6">
        <ExportCard
          title="구매입력 (입고)"
          count={summary?.inbound.count}
          mismatchCount={summary?.inbound.mismatchCount}
          mismatchLabel="입고량"
          busy={downloading === 'inbounds'}
          onDownload={() => download('inbounds', '구매입력')}
        />
        <ExportCard
          title="판매입력 (출고)"
          count={summary?.outbound.count}
          mismatchCount={summary?.outbound.mismatchCount}
          mismatchLabel="정산중량"
          busy={downloading === 'outbounds'}
          onDownload={() => download('outbounds', '판매입력')}
        />
      </div>
    </div>
  );
}

function ExportCard({
  title,
  count,
  mismatchCount,
  mismatchLabel,
  busy,
  onDownload,
}: {
  title: string;
  count?: number;
  mismatchCount?: number;
  mismatchLabel: string;
  busy: boolean;
  onDownload: () => void;
}) {
  return (
    <div className={`${cardPadCls} min-w-[300px] flex-1`}>
      <h2 className={`${sectionTitleCls} mb-2`}>{title}</h2>
      <p className="mb-3 text-[13px] text-text-sub">
        대상 건수: <span className="tabular font-bold text-text-strong">{count ?? '-'}</span> 건
      </p>
      {!!mismatchCount && (
        <p className="mb-3 flex items-start gap-1 text-[12.5px] text-warning">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          재고반영중량이 {mismatchLabel}과 다른 건 {mismatchCount}건. ecount 업로드 시 거부될 수 있으니 확인하세요.
        </p>
      )}
      <button type="button" onClick={onDownload} disabled={busy || !count} className={primaryBtnCls}>
        <Download size={15} /> {busy ? '생성 중...' : '엑셀 다운로드'}
      </button>
    </div>
  );
}
