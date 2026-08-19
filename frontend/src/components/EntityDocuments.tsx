import { useCallback, useEffect, useState } from 'react';
import { FileText, Upload, Download, Trash2, Printer } from 'lucide-react';
import { api, API_BASE_URL } from '../api/client';
import { auth } from '../lib/firebase';
import { inputCls, outlineBtnCls, primaryBtnCls } from './ui/classes';

// 업무 화면(프로젝트·자산·임직원)에 붙이는 문서함.
// 설계 docs/dms-design.md 2.4 — document_link 하나로 "이 업무의 문서 전부"를 뽑는다.
export interface EntityDoc {
  id: string;
  docNo: string | null;
  title: string;
  createdAt: string;
  meta?: { physicalStatus?: string | null } | null;
  type?: { name: string } | null;
  versions: { versionNo: number; fileName: string | null; byteSize: number | null }[];
}

interface DocTypeLeaf {
  id: string;
  level: number;
  name: string;
  children: DocTypeLeaf[];
}

const size = (n: number | null | undefined) =>
  n == null ? '-' : n < 1024 * 1024 ? `${Math.round(n / 1024)}KB` : `${(n / 1024 / 1024).toFixed(1)}MB`;

async function download(doc: EntityDoc) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`${API_BASE_URL}/api/dms/documents/${doc.id}/content`, {
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
  a.download = doc.versions[0]?.fileName ?? doc.title;
  a.click();
  URL.revokeObjectURL(url);
}

// 인쇄 미리보기 — 화면에서 확인하고 프린터로 뽑거나 PDF로 저장한다.
async function printDoc(doc: EntityDoc) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`${API_BASE_URL}/api/dms/documents/${doc.id}/content`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    window.alert('파일을 불러오지 못했습니다.');
    return;
  }
  const blob = await res.blob();
  const fileName = doc.versions[0]?.fileName ?? doc.title;
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  // 인쇄 창이 두 번 뜨지 않도록 한 번만 열리게 잠근다.
  let opened = false;
  const done = () => {
    if (opened) return;
    opened = true;
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 60_000);
  };

  if (blob.type === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
    frame.src = URL.createObjectURL(blob);
    frame.onload = done;
    return;
  }
  const isImage = blob.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(fileName);
  const write = (body: string) => {
    const d = frame.contentWindow?.document;
    if (!d) return;
    d.open();
    d.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${fileName}</title>` +
        '<style>@page{margin:12mm}body{margin:0;font-family:"맑은 고딕",sans-serif;color:#000}' +
        'img{max-width:100%}pre{white-space:pre-wrap;word-break:break-all;font-size:12px;line-height:1.6}</style>' +
        `</head><body>${body}</body></html>`,
    );
    d.close();
    window.setTimeout(done, 300);
  };
  if (isImage) {
    const reader = new FileReader();
    reader.onload = () => write(`<img src="${reader.result}" alt="${fileName}">`);
    reader.readAsDataURL(blob);
  } else {
    const text = await blob.text();
    write(`<pre>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`);
  }
}

export function EntityDocuments({
  entityType,
  entityId,
}: {
  entityType: 'project' | 'asset' | 'employee';
  entityId: string;
}) {
  const [docs, setDocs] = useState<EntityDoc[]>([]);
  const [leaves, setLeaves] = useState<{ id: string; label: string }[]>([]);
  const [adding, setAdding] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [typeId, setTypeId] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get<EntityDoc[]>(`/api/dms/entities/${entityType}/${entityId}/documents`).then(setDocs);
  }, [entityType, entityId]);

  useEffect(() => {
    load();
  }, [load]);

  // 등록 폼을 열 때만 분류 목록을 받아 온다. 문서는 소분류에만 매단다.
  useEffect(() => {
    if (!adding || leaves.length) return;
    api.get<DocTypeLeaf[]>('/api/dms/types').then((tree) => {
      const out: { id: string; label: string }[] = [];
      const walk = (nodes: DocTypeLeaf[], path: string[]) =>
        nodes.forEach((n) =>
          n.level === 3 ? out.push({ id: n.id, label: [...path, n.name].join(' > ') }) : walk(n.children, [...path, n.name]),
        );
      walk(tree, []);
      setLeaves(out);
      setTypeId((prev) => prev || out[0]?.id || '');
    });
  }, [adding, leaves.length]);

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
      form.append('typeId', typeId);
      form.append('title', title.trim() || file.name);
      if (entityType === 'project') form.append('projectId', entityId);
      const created = await api.post<{ id: string }>('/api/dms/documents', form);
      // 프로젝트가 아닌 업무는 등록 응답의 id로 바로 연결한다.
      if (entityType !== 'project' && created?.id) {
        await api.post(`/api/dms/documents/${created.id}/links`, { entityType, entityId });
      }
      setFile(null);
      setTitle('');
      setAdding(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (doc: EntityDoc) => {
    if (!window.confirm(`'${doc.title}' 문서를 삭제할까요?`)) return;
    await api.del(`/api/dms/documents/${doc.id}`);
    load();
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <FileText size={15} className="text-primary" />
        <span className="text-[13px] font-bold text-text-strong">문서 {docs.length}건</span>
        <button type="button" onClick={() => setAdding((v) => !v)} className={`${outlineBtnCls} ml-auto h-8 px-3`}>
          <Upload size={14} /> {adding ? '닫기' : '문서 등록'}
        </button>
      </div>

      {adding && (
        <form onSubmit={submit} className="mb-3 space-y-2.5 rounded-[10px] border border-border p-3">
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={inputCls} />
          <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className={inputCls}>
            {leaves.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목 — 비우면 파일명을 씁니다"
            className={inputCls}
          />
          {error && <p className="text-[12.5px] text-danger">{error}</p>}
          <div className="flex justify-end">
            <button type="submit" disabled={busy} className={`${primaryBtnCls} h-8 px-3`}>
              {busy ? '올리는 중...' : '등록'}
            </button>
          </div>
        </form>
      )}

      {docs.length === 0 ? (
        <p className="py-6 text-center text-[12.5px] text-text-faint">등록된 문서가 없습니다.</p>
      ) : (
        <div className="rounded-[10px] border border-border">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-2 border-b border-border px-3 py-2 text-[12.5px] last:border-0">
              <FileText size={14} className="shrink-0 text-text-faint" />
              <span className="truncate font-semibold text-text-strong">{d.title}</span>
              <span className="shrink-0 text-text-sub">{d.type?.name ?? '-'}</span>
              {d.meta?.physicalStatus === '원본 보관' && (
                <span className="shrink-0 rounded-[5px] bg-[#22c55e]/15 px-1.5 py-0.5 font-bold text-[#4ade80]">원본</span>
              )}
              <span className="ml-auto shrink-0 text-text-faint">v{d.versions[0]?.versionNo ?? 1}</span>
              <span className="shrink-0 text-text-faint">{size(d.versions[0]?.byteSize)}</span>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  title="인쇄 미리보기 · PDF 저장"
                  onClick={() => printDoc(d)}
                  className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-primary"
                >
                  <Printer size={14} />
                </button>
                <button
                  type="button"
                  title="내려받기"
                  onClick={() => download(d)}
                  className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-text-strong"
                >
                  <Download size={14} />
                </button>
                <button
                  type="button"
                  title="삭제"
                  onClick={() => remove(d)}
                  className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-danger"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
