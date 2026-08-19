import { useCallback, useEffect, useState } from 'react';
import {
  FolderOpen,
  Folder,
  FileText,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  Download,
  Upload,
  History,
  Eye,
  Printer,
  Paperclip,
  Check,
  X,
  Save,
  PackageCheck,
} from 'lucide-react';
import { api, API_BASE_URL } from '../api/client';
import { auth } from '../lib/firebase';
import { useProjects } from '../hooks/useMasters';
import { kstStamp } from '../lib/datetime';
import { FormModal } from '../components/FormModal';
import { FileDropField } from '../components/FileDropField';
import { StagedFileUpload } from '../components/StagedFileUpload';
import { pageTitleCls, cardCls, cardPadCls, primaryBtnCls, outlineBtnCls, inputCls } from '../components/ui/classes';

// 문서 분류 트리 — 대·중·소 3단. 설계 docs/dms-design.md 3.1·3.2를 따른다.
export interface DocType {
  id: string;
  parentId: string | null;
  level: number;
  code: string;
  name: string;
  docCount: number;
  origin: string;
  retentionMonths: number | null;
  children: DocType[];
}

interface DocVersion {
  id: string;
  versionNo: number;
  fileName: string | null;
  byteSize: number | null;
  changeNote: string | null;
  createdAt: string;
}

interface DocAttachment {
  id: string;
  fileName: string | null;
  byteSize: number | null;
}

interface Doc {
  id: string;
  docNo: string | null;
  /** UPLOAD 외부 유입 문서 / SYSTEM 시스템이 발행한 보고서 */
  origin?: string;
  reportType?: string;
  title: string;
  description?: string | null;
  typeId?: string | null;
  createdAt: string;
  retentionUntil?: string | null;
  meta?: {
    docDate?: string | null;
    physicalStatus?: string | null;
    physicalLocation?: string | null;
    physicalCheckedAt?: string | null;
  } | null;
  type?: { name: string; code: string } | null;
  versions: DocVersion[];
  attachments?: DocAttachment[];
  projects: { id: string; name: string | null }[];
}

interface DocAudit {
  id: string;
  action: string;
  summary: string | null;
  ip: string | null;
  createdAt: string;
  appUser?: { name: string | null; email: string | null } | null;
}

const ACTION_LABEL: Record<string, string> = {
  doc_create: '등록',
  doc_version: '새 버전',
  doc_update: '메타 수정',
  doc_download: '내려받기',
  doc_delete: '삭제',
};

// 실물(원본) 문서 상태 — 스캔본만 있는지, 원본을 받아 보관 중인지 구분한다(설계 3.3 원본 보관 의무).
const PHYSICAL_STATUS = ['미확인', '스캔본만', '원본 보관', '원본 반환'];

// 분류 추가 줄의 확인·취소 — 목록 관리 열 아이콘과 같은 톤으로 둔다.
const iconOkCls =
  'shrink-0 rounded-[6px] p-1.5 text-text-sub hover:bg-hover hover:text-primary disabled:opacity-40';
const iconCancelCls = 'shrink-0 rounded-[6px] p-1.5 text-text-sub hover:bg-hover hover:text-danger';

const LEVEL_LABEL: Record<number, string> = { 1: '대분류', 2: '중분류', 3: '소분류' };

// 단계를 색으로 구분한다 — 대분류 파랑, 중분류 초록, 소분류 주황.
const LEVEL_STYLE: Record<number, { icon: string; text: string; chip: string }> = {
  1: { icon: 'text-[#3884ff]', text: 'font-bold text-text-strong', chip: 'bg-[#3884ff]/15 text-[#6aa3ff]' },
  2: { icon: 'text-[#22c55e]', text: 'font-semibold text-text', chip: 'bg-[#22c55e]/15 text-[#4ade80]' },
  3: { icon: 'text-[#f59e0b]', text: 'text-text-sub', chip: 'bg-[#f59e0b]/15 text-[#fbbf24]' },
};

const size = (n: number | null) =>
  n == null ? '-' : n < 1024 * 1024 ? `${Math.round(n / 1024)}KB` : `${(n / 1024 / 1024).toFixed(1)}MB`;
const day = (v: string) => v.slice(0, 10);
const countAll = (nodes: DocType[]): number => nodes.reduce((sum, n) => sum + 1 + countAll(n.children), 0);

// 내려받기도 앱을 거친다 — 드라이브 링크를 화면에 노출하지 않는다(설계 1장 원칙 2).
// 첨부자료도 앱을 거쳐 받는다 — 본문과 같은 규칙이다.
async function downloadAttachment(doc: Doc, item: DocAttachment) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`${API_BASE_URL}/api/dms/documents/${doc.id}/attachments/${item.id}/content`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    window.alert('첨부자료를 내려받지 못했습니다.');
    return;
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = item.fileName ?? 'attachment';
  a.click();
  URL.revokeObjectURL(url);
}

const isReport = (doc: Doc) => doc.origin === 'SYSTEM';
// 보고서는 document가 아니라 report에 있다. 내려받기·인쇄만 같은 자리에서 되게 한다.
const contentUrl = (doc: Doc) =>
  isReport(doc)
    ? `${API_BASE_URL}/api/reports/published/${doc.id.replace('report:', '')}/xlsx`
    : `${API_BASE_URL}/api/dms/documents/${doc.id}/content`;

async function downloadDoc(doc: Doc) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(contentUrl(doc), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    window.alert('파일을 내려받지 못했습니다.');
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = doc.versions[0]?.fileName ?? `${doc.title}${isReport(doc) ? '.xlsx' : ''}`;
  a.click();
  URL.revokeObjectURL(url);
}

// 인쇄 첫 장에 붙일 문서 정보 표지. 무엇을 출력한 문서인지 종이만 보고 알 수 있게 한다.
function coverHtml(doc: Doc) {
  const v = doc.versions[0];
  const rows: [string, string][] = [
    ['문서번호', doc.docNo ?? '-'],
    ['제목', doc.title],
    ['분류', doc.type?.name ?? '-'],
    ['프로젝트', doc.projects.map((x) => x.name).filter(Boolean).join(', ') || '-'],
    ['문서일자', doc.meta?.docDate ?? '-'],
    ['등록일', day(doc.createdAt)],
    ['버전', `v${v?.versionNo ?? 1}`],
    ['파일', v?.fileName ?? '-'],
    ['크기', size(v?.byteSize ?? null)],
    ['실물 문서', doc.meta?.physicalStatus ?? '미확인'],
    ['보관 위치', doc.meta?.physicalLocation ?? '-'],
    ['보존 만료', doc.retentionUntil ? day(doc.retentionUntil) : '미지정'],
    ['비고', doc.description ?? '-'],
  ];
  const escape = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return (
    '<section class="cover">' +
    `<h1>${escape(doc.title)}</h1>` +
    `<p class="sub">${escape(doc.docNo ?? '')}</p>` +
    '<table>' +
    rows.map(([k, val]) => `<tr><th>${k}</th><td>${escape(String(val))}</td></tr>`).join('') +
    '</table>' +
    `<p class="foot">출력 ${new Date().toLocaleString('ko-KR')}</p>` +
    '</section>'
  );
}

// 인쇄 — 숨긴 iframe에 띄우고 브라우저 인쇄 대화상자를 연다.
// 거기서 프린터로 뽑거나 "PDF로 저장"을 고르면 된다.
function printBlob(blob: Blob, fileName: string, cover?: string) {
  const isPdf = blob.type === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
  const isImage = blob.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(fileName);

  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);

  // onload와 타이머가 둘 다 걸려 인쇄 창이 두 번 뜨던 문제 — 한 번만 열리게 잠근다.
  let opened = false;
  const openPrint = () => {
    if (opened) return;
    opened = true;
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 60_000);
  };

  // PDF는 브라우저가 원본을 그대로 인쇄한다. 표지를 앞에 끼우려면 PDF를 합쳐야 해서 여기서는 원본만 낸다.
  if (isPdf) {
    const url = URL.createObjectURL(blob);
    frame.src = url;
    frame.onload = openPrint;
    return;
  }

  // 이미지·텍스트는 인쇄용 문서로 감싼다. 여백과 배율을 잡아 주지 않으면 잘린다.
  const finish = (body: string) => {
    const doc = frame.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${fileName}</title>` +
        '<style>@page{margin:12mm}body{margin:0;font-family:"맑은 고딕",sans-serif;color:#000}' +
        'img{max-width:100%}pre{white-space:pre-wrap;word-break:break-all;font-size:12px;line-height:1.6}' +
        // 표지 다음에 원본이 새 장에서 시작하도록 끊는다.
        '.cover{page-break-after:always}.cover h1{font-size:20px;margin:0 0 4px}' +
        '.cover .sub{margin:0 0 16px;color:#555;font-size:12px}' +
        '.cover table{width:100%;border-collapse:collapse;font-size:12px}' +
        '.cover th{width:110px;text-align:left;padding:6px 8px;background:#f2f2f2;border:1px solid #ddd;font-weight:600}' +
        '.cover td{padding:6px 8px;border:1px solid #ddd}' +
        '.cover .foot{margin-top:14px;color:#777;font-size:11px}' +
        `</style></head><body>${cover ?? ''}${body}</body></html>`,
    );
    doc.close();
    // document.write로 채운 iframe은 onload가 안 오는 경우가 있어 타이머로 연다.
    window.setTimeout(openPrint, 300);
  };

  if (isImage) {
    const reader = new FileReader();
    reader.onload = () => finish(`<img src="${reader.result}" alt="${fileName}">`);
    reader.readAsDataURL(blob);
    return;
  }

  blob.text().then((text) => {
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    finish(`<pre>${escaped}</pre>`);
  });
}

// 문서를 받아 곧바로 인쇄 미리보기를 연다. 거기서 프린터로 뽑거나 PDF로 저장한다.
async function printDoc(doc: Doc) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(contentUrl(doc), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    window.alert('파일을 불러오지 못했습니다.');
    return;
  }
  printBlob(await res.blob(), doc.versions[0]?.fileName ?? doc.title, coverHtml(doc));
}

export function DmsPage() {
  const { projects } = useProjects();
  const [tree, setTree] = useState<DocType[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<DocType | null>(null);
  const [projectId, setProjectId] = useState('');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState<{ parent: DocType | null } | null>(null);
  const [newName, setNewName] = useState('');
  const [uploadFor, setUploadFor] = useState<DocType | null>(null);
  const [versionFor, setVersionFor] = useState<Doc | null>(null);
  const [detailFor, setDetailFor] = useState<Doc | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadTree = useCallback(() => {
    api.get<DocType[]>('/api/dms/types').then((rows) => {
      setTree(rows);
      setOpen((prev) => (Object.keys(prev).length ? prev : Object.fromEntries(rows.map((r) => [r.id, true]))));
    });
  }, []);

  const loadDocs = useCallback(() => {
    const params = new URLSearchParams();
    if (selected) params.set('typeId', selected.id);
    if (projectId) params.set('projectId', projectId);
    if (q) params.set('q', q);
    api.get<Doc[]>(`/api/dms/documents?${params.toString()}`).then(setDocs);
  }, [selected, projectId, q]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const refresh = () => {
    loadTree();
    loadDocs();
  };

  const submitAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setError('');
    setBusy(true);
    try {
      await api.post('/api/dms/types', { name, parentId: adding?.parent?.id ?? null });
      setNewName('');
      setAdding(null);
      loadTree();
    } catch (err) {
      setError(err instanceof Error ? err.message : '분류를 추가하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const removeType = async (node: DocType) => {
    const kids = countAll(node.children);
    const warning = kids > 0 ? `하위 분류 ${kids}개도 함께 삭제됩니다.\n\n` : '';
    if (!window.confirm(`${warning}'${node.name}' 분류를 삭제할까요?`)) return;
    setError('');
    try {
      await api.del(`/api/dms/types/${node.id}`);
      if (selected?.id === node.id) setSelected(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '분류를 삭제하지 못했습니다.');
    }
  };

  const removeDoc = async (doc: Doc) => {
    if (!window.confirm(`'${doc.title}' 문서를 삭제할까요?`)) return;
    await api.del(`/api/dms/documents/${doc.id}`);
    refresh();
  };

  // 분류 필터용 — 트리를 평탄화해 "대 > 중 > 소" 한 줄로 만든다.
  const flatTypes: { node: DocType; label: string }[] = [];
  const walkTypes = (nodes: DocType[], path: string[]) =>
    nodes.forEach((n) => {
      flatTypes.push({ node: n, label: [...path, n.name].join(' > ') });
      walkTypes(n.children, [...path, n.name]);
    });
  walkTypes(tree, []);

  const projectName = projects.find((p) => p.id === projectId)?.roundName ?? '전체 프로젝트';

  const renderNode = (node: DocType, depth: number) => {
    const expanded = open[node.id] ?? false;
    const hasKids = node.children.length > 0;
    const isSelected = selected?.id === node.id;
    const style = LEVEL_STYLE[node.level] ?? LEVEL_STYLE[3];

    return (
      <div key={node.id}>
        <div
          className={[
            'group flex items-center gap-1.5 rounded-[8px] py-1.5 pr-2 text-[13px]',
            isSelected ? 'bg-nav-active text-text-strong' : 'text-text hover:bg-hover',
          ].join(' ')}
          style={{ paddingLeft: 8 + depth * 16 }}
        >
          <button
            type="button"
            onClick={() => setOpen({ ...open, [node.id]: !expanded })}
            className={`shrink-0 text-text-faint ${hasKids ? 'hover:text-text-strong' : 'invisible'}`}
            aria-label={expanded ? '접기' : '펼치기'}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          <button
            type="button"
            onClick={() => setSelected(node)}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          >
            {node.level === 3 ? (
              <FileText size={14} className={`shrink-0 ${style.icon}`} />
            ) : expanded ? (
              <FolderOpen size={14} className={`shrink-0 ${style.icon}`} />
            ) : (
              <Folder size={14} className={`shrink-0 ${style.icon}`} />
            )}
            <span className={`truncate ${style.text}`}>{node.name}</span>
            {node.docCount > 0 && <span className="shrink-0 text-[11.5px] text-text-faint">{node.docCount}</span>}
          </button>

          <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
            {/* 소분류에서 바로 올린다 — 분류와 프로젝트가 채워진 상태로 창이 뜬다. */}
            {node.level === 3 && (
              <button
                type="button"
                title="문서 등록"
                onClick={() => setUploadFor(node)}
                className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-primary"
              >
                <Upload size={13} />
              </button>
            )}
            {node.level < 3 && (
              <button
                type="button"
                title="하위 분류 추가"
                onClick={() => {
                  setAdding({ parent: node });
                  setNewName('');
                  setOpen({ ...open, [node.id]: true });
                }}
                className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-text-strong"
              >
                <Plus size={13} />
              </button>
            )}
            <button
              type="button"
              title="분류 삭제"
              onClick={() => removeType(node)}
              className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-danger"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {adding?.parent?.id === node.id && (
          <div className="flex items-center gap-1.5 py-1" style={{ paddingLeft: 30 + depth * 16 }}>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitAdd();
                if (e.key === 'Escape') setAdding(null);
              }}
              placeholder={`${LEVEL_LABEL[node.level + 1]} 이름`}
              className={`${inputCls} h-8 w-[180px]`}
            />
            <button
              type="button"
              disabled={busy}
              onClick={submitAdd}
              title="추가"
              aria-label="추가"
              className={iconOkCls}
            >
              <Check size={15} />
            </button>
            <button
              type="button"
              onClick={() => setAdding(null)}
              title="취소"
              aria-label="취소"
              className={iconCancelCls}
            >
              <X size={15} />
            </button>
          </div>
        )}

        {expanded && node.children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <FolderOpen size={20} className="text-primary" />
        <h1 className={pageTitleCls}>문서 관리</h1>
        <span className="ml-1 text-[13px] text-text-sub">
          분류 {countAll(tree)}개 · 문서 {docs.length}건
        </span>
        <button
          type="button"
          onClick={() => {
            setAdding({ parent: null });
            setNewName('');
          }}
          className={`${outlineBtnCls} ml-auto`}
        >
          <Plus size={15} /> 대분류 추가
        </button>
        <button type="button" onClick={refresh} className={outlineBtnCls}>
          <RotateCcw size={15} /> 새로고침
        </button>
      </div>

      {/* 현장 동선 — 프로젝트를 먼저 고르고, 그 아래 분류로 좁힌다. 한 줄에 세워 화면을 덜 먹게 한다. */}
      <div className={`${cardCls} mb-4 flex items-center gap-2 overflow-x-auto px-4 py-2.5`}>
        <span className="shrink-0 text-[13px] font-extrabold text-text-strong">검색</span>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className={`${inputCls} w-[200px] shrink-0`}
        >
          <option value="">전체 프로젝트</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.roundName}
            </option>
          ))}
        </select>

        {/* 트리를 뒤지지 않고도 분류를 고를 수 있게 한다. 트리 선택과 같은 값을 쓴다. */}
        <select
          value={selected?.id ?? ''}
          onChange={(e) => setSelected(flatTypes.find((t) => t.node.id === e.target.value)?.node ?? null)}
          className={`${inputCls} w-[240px] shrink-0`}
        >
          <option value="">전체 분류</option>
          {flatTypes.map(({ node, label }) => (
            <option key={node.id} value={node.id}>
              {label}
            </option>
          ))}
        </select>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="문서명 · 문서번호 검색"
          className={`${inputCls} w-[220px] shrink-0`}
        />

        {(projectId || selected || q) && (
          <button
            type="button"
            onClick={() => {
              setProjectId('');
              setSelected(null);
              setQ('');
            }}
            className={`${outlineBtnCls} h-[38px] shrink-0 whitespace-nowrap px-3`}
          >
            <RotateCcw size={15} /> 초기화
          </button>
        )}
        <span className="shrink-0 text-[12px] text-text-faint">계근표 제외 · 보고서는 보관함에서</span>
      </div>

      {error && <p className="mb-3 text-[13px] text-danger">{error}</p>}

      <div className="grid grid-cols-[minmax(0,340px)_minmax(0,1fr)] gap-4">
        <div className={`${cardCls} overflow-y-auto p-3`} style={{ height: 'calc(100vh - 280px)', minHeight: 420 }}>
          <div className="mb-2 flex items-center gap-2 px-2">
            <span className="text-[10.5px] font-bold tracking-[1px] text-text-faint">문서 분류</span>
            <span className="ml-auto flex items-center gap-1.5">
              {[1, 2, 3].map((lv) => (
                <span key={lv} className={`rounded-[5px] px-1.5 py-0.5 text-[10.5px] font-bold ${LEVEL_STYLE[lv].chip}`}>
                  {LEVEL_LABEL[lv]}
                </span>
              ))}
            </span>
          </div>

          {adding && adding.parent === null && (
            <div className="mb-2 flex items-center gap-1.5 px-2">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitAdd();
                  if (e.key === 'Escape') setAdding(null);
                }}
                placeholder="대분류 이름"
                className={`${inputCls} h-8 w-[180px]`}
              />
              <button
                type="button"
                disabled={busy}
                onClick={submitAdd}
                title="추가"
                aria-label="추가"
                className={iconOkCls}
              >
                <Check size={15} />
              </button>
              <button
                type="button"
                onClick={() => setAdding(null)}
                title="취소"
                aria-label="취소"
                className={iconCancelCls}
              >
                <X size={15} />
              </button>
            </div>
          )}

          {tree.length === 0 ? (
            <p className="px-2 py-8 text-center text-[13px] text-text-faint">분류를 불러오는 중입니다.</p>
          ) : (
            tree.map((node) => renderNode(node, 0))
          )}
        </div>

        <div className={cardPadCls}>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-[15px] font-extrabold text-text-strong">
              {selected ? selected.name : '전체 문서'} <span className="text-text-faint">· {projectName}</span>
            </h2>
            {selected?.level === 3 && (
              <button type="button" onClick={() => setUploadFor(selected)} className={`${primaryBtnCls} ml-auto`}>
                <Upload size={15} /> 문서 등록
              </button>
            )}
          </div>

          {docs.length === 0 ? (
            <p className="py-16 text-center text-[13px] text-text-faint">
              {selected?.level === 3
                ? '이 분류에 등록된 문서가 없습니다. 위 문서 등록으로 올리세요.'
                : '조건에 맞는 문서가 없습니다. 좌측에서 소분류를 고르면 등록할 수 있습니다.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-y border-border">
                    {['문서번호', '제목', '분류', '프로젝트', '실물', '버전', '크기', '등록일', '관리'].map((h) => (
                      <th
                        key={h}
                        className={`px-3 py-1.5 text-[12.5px] font-semibold text-text-sub ${
                          h === '버전' || h === '크기' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {docs.map((d) => (
                    <tr key={d.id} className="border-b border-border last:border-0 hover:bg-hover">
                      <td className="tabular px-3 py-1.5 text-[12.5px] whitespace-nowrap text-text-sub">
                        {d.docNo ?? '-'}
                      </td>
                      <td className="px-3 py-1.5 text-[13px] font-semibold text-text-strong">
                        {isReport(d) && (
                          <span className="mr-1.5 rounded-[5px] bg-[#38bdf8]/15 px-1.5 py-0.5 text-[11px] font-bold text-[#7dd3fc]">
                            보고서
                          </span>
                        )}
                        {d.title}
                        {!!d.attachments?.length && (
                          <span className="ml-1.5 text-[11.5px] font-semibold text-text-faint">
                            +첨부 {d.attachments.length}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-[13px] text-text">{d.type?.name ?? '-'}</td>
                      <td className="px-3 py-1.5 text-[13px] text-text">
                        {d.projects.map((p) => p.name).filter(Boolean).join(', ') || '-'}
                      </td>
                      <td className="px-3 py-1.5 text-[12.5px]">
                        {d.meta?.physicalStatus ? (
                          <span
                            className={`rounded-[5px] px-1.5 py-0.5 font-bold ${
                              d.meta.physicalStatus === '원본 보관'
                                ? 'bg-[#22c55e]/15 text-[#4ade80]'
                                : d.meta.physicalStatus === '미확인'
                                  ? 'bg-[#f59e0b]/15 text-[#fbbf24]'
                                  : 'bg-border text-text-sub'
                            }`}
                          >
                            {d.meta.physicalStatus}
                          </span>
                        ) : (
                          <span className="text-text-faint">-</span>
                        )}
                      </td>
                      <td className="tabular px-3 py-1.5 text-right text-[13px]">
                        {isReport(d) ? '-' : `v${d.versions[0]?.versionNo ?? 1}`}
                      </td>
                      <td className="tabular px-3 py-1.5 text-right text-[13px]">{size(d.versions[0]?.byteSize ?? null)}</td>
                      <td className="tabular px-3 py-1.5 text-[12.5px] whitespace-nowrap">{day(d.createdAt)}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            title="인쇄 미리보기 · PDF 저장"
                            onClick={() => printDoc(d)}
                            className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-primary"
                          >
                            <Printer size={15} />
                          </button>
                          {!isReport(d) && (
                            <button
                              type="button"
                              title="상세 · 메타 수정"
                              onClick={() => setDetailFor(d)}
                              className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-text-strong"
                            >
                              <Eye size={15} />
                            </button>
                          )}
                          <button
                            type="button"
                            title="내려받기"
                            onClick={() => downloadDoc(d)}
                            className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-text-strong"
                          >
                            <Download size={15} />
                          </button>
                          {/* 보고서는 발행 시점이 고정이라 버전·삭제를 두지 않는다. 정리는 보고서 보관함에서 한다. */}
                          {!isReport(d) && (
                            <>
                              <button
                                type="button"
                                title="새 버전 올리기"
                                onClick={() => setVersionFor(d)}
                                className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-primary"
                              >
                                <History size={15} />
                              </button>
                              <button
                                type="button"
                                title="삭제"
                                onClick={() => removeDoc(d)}
                                className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-danger"
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {uploadFor && (
        <FormModal title={`문서 등록 — ${uploadFor.name}`} icon={Upload} onClose={() => setUploadFor(null)}>
          <UploadForm
            type={uploadFor}
            projects={projects}
            defaultProjectId={projectId}
            onDone={() => {
              setUploadFor(null);
              refresh();
            }}
            onCancel={() => setUploadFor(null)}
          />
        </FormModal>
      )}

      {detailFor && (
        <FormModal title={detailFor.title} icon={Eye} onClose={() => setDetailFor(null)}>
          <DetailForm
            doc={detailFor}
            tree={tree}
            projects={projects}
            onDone={() => {
              setDetailFor(null);
              refresh();
            }}
            onCancel={() => setDetailFor(null)}
          />
        </FormModal>
      )}

      {versionFor && (
        <FormModal title={`새 버전 — ${versionFor.title}`} icon={History} onClose={() => setVersionFor(null)}>
          <VersionForm
            doc={versionFor}
            onDone={() => {
              setVersionFor(null);
              refresh();
            }}
            onCancel={() => setVersionFor(null)}
          />
        </FormModal>
      )}
    </div>
  );
}

// 등록 — 분류는 트리에서 정해졌고, 프로젝트는 상단에서 고른 값을 그대로 받는다.
function UploadForm({
  type,
  projects,
  defaultProjectId,
  onDone,
  onCancel,
}: {
  type: DocType;
  projects: { id: string; roundName: string }[];
  defaultProjectId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [extras, setExtras] = useState<File[]>([]);
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [docDate, setDocDate] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('파일을 선택하세요.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      extras.forEach((f) => form.append('attachments', f));
      form.append('typeId', type.id);
      form.append('title', title.trim() || file.name);
      if (projectId) form.append('projectId', projectId);
      if (docDate) form.append('docDate', docDate);
      if (description) form.append('description', description);
      await api.post('/api/dms/documents', form);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <p className="text-[12.5px] text-text-sub">
        분류 <b className="text-text-strong">{type.name}</b> ({type.code})
      </p>

      {/* 본문과 첨부를 한 줄에 나란히 둔다. 첨부는 버전을 쌓지 않고 문서에 딸려 있다. */}
      <div className="grid grid-cols-2 gap-3">
        <FileDropField label="파일 (본문)" file={file} setFile={setFile} hint="계약서·필증·명세서 등" />
        <StagedFileUpload label="첨부자료 (선택)" files={extras} setFiles={setExtras} hint="여러 개 올릴 수 있습니다" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">프로젝트</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputCls}>
            <option value="">연결 안 함</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.roundName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">문서일자</label>
          <input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} className={inputCls} />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">제목</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="비우면 파일명을 씁니다"
          className={inputCls}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">비고</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
      </div>

      {error && <p className="text-[13px] text-danger">{error}</p>}

      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <button type="button" onClick={onCancel} className={outlineBtnCls}>
          취소
        </button>
        <button type="submit" disabled={busy} className={primaryBtnCls}>
          {busy ? '올리는 중...' : '등록'}
        </button>
      </div>
    </form>
  );
}

// 새 버전 — 덮어쓰지 않고 쌓는다. 같은 파일이면 서버가 막는다.
function VersionForm({ doc, onDone, onCancel }: { doc: Doc; onDone: () => void; onCancel: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [changeNote, setChangeNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('파일을 선택하세요.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      if (changeNote) form.append('changeNote', changeNote);
      await api.post(`/api/dms/documents/${doc.id}/versions`, form);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : '새 버전을 올리지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <FileDropField file={file} setFile={setFile} hint="같은 파일이면 새 버전을 만들지 않습니다" />
      <div>
        <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">변경 사유</label>
        <input
          value={changeNote}
          onChange={(e) => setChangeNote(e.target.value)}
          placeholder="예: 3조 단가 수정"
          className={inputCls}
        />
      </div>

      {!!doc.attachments?.length && (
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-text-mid">첨부자료 {doc.attachments.length}건</p>
          <div className="rounded-[8px] border border-border">
            {doc.attachments.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-[12.5px] last:border-0"
              >
                <Paperclip size={12} className="shrink-0 text-text-faint" />
                <span className="truncate text-text">{a.fileName}</span>
                <span className="shrink-0 text-text-faint">{size(a.byteSize)}</span>
                <button
                  type="button"
                  title="내려받기"
                  onClick={() => downloadAttachment(doc, a)}
                  className="ml-auto shrink-0 rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-text-strong"
                >
                  <Download size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-[13px] font-semibold text-text-mid">버전 이력</p>
        <div className="rounded-[8px] border border-border">
          {doc.versions.slice(0, 5).map((v) => (
            <div
              key={v.id}
              className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-[12.5px] last:border-0"
            >
              <span className="font-bold text-text-strong">v{v.versionNo}</span>
              <span className="truncate text-text-sub">{v.fileName}</span>
              <span className="ml-auto shrink-0 text-text-faint">{day(v.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-[13px] text-danger">{error}</p>}

      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <button type="button" onClick={onCancel} className={outlineBtnCls}>
          취소
        </button>
        <button type="submit" disabled={busy} className={primaryBtnCls}>
          {busy ? '올리는 중...' : '새 버전 등록'}
        </button>
      </div>
    </form>
  );
}


// 상세 — 메타 수정과 실물 문서 확인 상태를 함께 다룬다. 파일 교체는 새 버전으로만 한다.
function DetailForm({
  doc,
  tree,
  projects,
  onDone,
  onCancel,
}: {
  doc: Doc;
  tree: DocType[];
  projects: { id: string; roundName: string }[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(doc.title);
  const [description, setDescription] = useState(doc.description ?? '');
  const [typeId, setTypeId] = useState(doc.typeId ?? '');
  const [projectId, setProjectId] = useState(doc.projects[0]?.id ?? '');
  const [docDate, setDocDate] = useState(doc.meta?.docDate ?? '');
  const [physicalStatus, setPhysicalStatus] = useState(doc.meta?.physicalStatus ?? '미확인');
  const [physicalLocation, setPhysicalLocation] = useState(doc.meta?.physicalLocation ?? '');
  const [audit, setAudit] = useState<DocAudit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // 누가 언제 열고 바꿨는지 — 설계 2.6 감사 추적.
  useEffect(() => {
    api.get<DocAudit[]>(`/api/dms/documents/${doc.id}/audit`).then(setAudit).catch(() => setAudit([]));
  }, [doc.id]);

  // 분류 선택은 소분류만 고르게 한다 — 문서는 소분류에 매단다.
  const leaves: { id: string; label: string }[] = [];
  const walk = (nodes: DocType[], path: string[]) => {
    nodes.forEach((n) => {
      if (n.level === 3) leaves.push({ id: n.id, label: [...path, n.name].join(' > ') });
      else walk(n.children, [...path, n.name]);
    });
  };
  walk(tree, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.patch(`/api/dms/documents/${doc.id}`, {
        title,
        description,
        typeId,
        projectId,
        docDate,
        physicalStatus,
        physicalLocation,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <div className="grid grid-cols-3 gap-3 rounded-[10px] border border-border bg-input p-3">
        {[
          { label: '문서번호', value: doc.docNo ?? '-' },
          { label: '현재 버전', value: `v${doc.versions[0]?.versionNo ?? 1}` },
          { label: '등록일', value: day(doc.createdAt) },
          { label: '파일', value: doc.versions[0]?.fileName ?? '-' },
          { label: '크기', value: size(doc.versions[0]?.byteSize ?? null) },
          { label: '보존 만료', value: doc.retentionUntil ? day(doc.retentionUntil) : '미지정' },
        ].map((f) => (
          <div key={f.label}>
            <div className="text-[11.5px] text-text-sub">{f.label}</div>
            <div className="truncate text-[13px] font-semibold text-text-strong" title={String(f.value)}>
              {f.value}
            </div>
          </div>
        ))}
      </div>

      <div>
        <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">제목</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">분류</label>
          <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className={inputCls}>
            {leaves.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">프로젝트</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputCls}>
            <option value="">연결 안 함</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.roundName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">문서일자</label>
          <input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">비고</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* 실물 원본 관리 — 스캔본으로 갈음되는지, 원본을 어디에 두었는지 남긴다. */}
      <div className="rounded-[10px] border border-border p-3">
        <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-text-strong">
          <PackageCheck size={15} className="text-primary" /> 실물 문서 확인
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">상태</label>
            <select value={physicalStatus} onChange={(e) => setPhysicalStatus(e.target.value)} className={inputCls}>
              {PHYSICAL_STATUS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">보관 위치</label>
            <input
              value={physicalLocation}
              onChange={(e) => setPhysicalLocation(e.target.value)}
              placeholder="예: 본사 캐비닛 3단"
              className={inputCls}
            />
          </div>
        </div>
        {doc.meta?.physicalCheckedAt && (
          <p className="mt-2 text-[12px] text-text-faint">마지막 확인 {doc.meta.physicalCheckedAt}</p>
        )}
      </div>

      {!!doc.attachments?.length && (
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-text-mid">첨부자료 {doc.attachments.length}건</p>
          <div className="rounded-[8px] border border-border">
            {doc.attachments.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-[12.5px] last:border-0"
              >
                <Paperclip size={12} className="shrink-0 text-text-faint" />
                <span className="truncate text-text">{a.fileName}</span>
                <span className="shrink-0 text-text-faint">{size(a.byteSize)}</span>
                <button
                  type="button"
                  title="내려받기"
                  onClick={() => downloadAttachment(doc, a)}
                  className="ml-auto shrink-0 rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-text-strong"
                >
                  <Download size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-[13px] font-semibold text-text-mid">버전 이력</p>
        <div className="max-h-[160px] overflow-y-auto rounded-[8px] border border-border">
          {doc.versions.map((v) => (
            <div
              key={v.id}
              className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-[12.5px] last:border-0"
            >
              <span className="font-bold text-text-strong">v{v.versionNo}</span>
              <span className="truncate text-text-sub">{v.fileName}</span>
              {v.changeNote && <span className="truncate text-text-faint">— {v.changeNote}</span>}
              <span className="ml-auto shrink-0 text-text-faint">{day(v.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[13px] font-semibold text-text-mid">문서 이력</p>
        <div className="max-h-[160px] overflow-y-auto rounded-[8px] border border-border">
          {audit.length === 0 ? (
            <p className="px-3 py-3 text-[12.5px] text-text-faint">기록이 없습니다.</p>
          ) : (
            audit.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-[12.5px] last:border-0"
              >
                <span className="shrink-0 rounded-[5px] bg-border px-1.5 py-0.5 font-bold text-text-sub">
                  {ACTION_LABEL[a.action] ?? a.action}
                </span>
                <span className="truncate text-text">{a.appUser?.name ?? a.appUser?.email ?? '-'}</span>
                {a.summary && <span className="truncate text-text-faint">— {a.summary}</span>}
                <span className="ml-auto shrink-0 text-text-faint">{kstStamp(a.createdAt)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {error && <p className="text-[13px] text-danger">{error}</p>}

      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <button type="button" onClick={() => downloadDoc(doc)} className={outlineBtnCls}>
          <Download size={15} /> 내려받기
        </button>
        <button type="button" onClick={onCancel} className={outlineBtnCls}>
          취소
        </button>
        <button type="submit" disabled={busy} className={primaryBtnCls}>
          <Save size={15} /> {busy ? '저장 중...' : '저장'}
        </button>
      </div>
    </form>
  );
}
