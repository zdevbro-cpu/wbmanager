import { useEffect, useState } from 'react';
import { X, Download, Printer, FileWarning } from 'lucide-react';
import { API_BASE_URL } from '../api/client';
import { auth } from '../lib/firebase';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { outlineBtnCls, primaryBtnCls } from './ui/classes';

export interface PreviewDoc {
  id: string;
  docNo?: string | null;
  title: string;
  fileName?: string | null;
  byteSize?: number | null;
  /** 파일을 받아 오는 주소. 문서·보고서마다 다르므로 화면에서 넘긴다. */
  contentUrl: string;
  /** 요약 페이지에 함께 보여 줄 항목 */
  facts?: { label: string; value: string }[];
}

const size = (n?: number | null) =>
  n == null ? '-' : n < 1024 * 1024 ? `${Math.round(n / 1024)}KB` : `${(n / 1024 / 1024).toFixed(1)}MB`;

// 화면에서 열 수 있는 것만 연다. 엑셀·워드·한글은 브라우저가 읽지 못한다.
type Kind = 'pdf' | 'image' | 'text' | 'other';

function kindOf(fileName: string, mime: string): Kind {
  const name = fileName.toLowerCase();
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/.test(name)) return 'image';
  if (mime.startsWith('text/') || /\.(txt|csv|md|json|log)$/.test(name)) return 'text';
  return 'other';
}

// 큰 파일은 통째로 받아야 열 수 있어 오래 걸린다. 그 앞에서는 내려받기를 권한다.
const MAX_PREVIEW_BYTES = 20 * 1024 * 1024;

export function DocumentPreview({ doc, onClose }: { doc: PreviewDoc; onClose: () => void }) {
  useEscapeClose(onClose);
  const [state, setState] = useState<'loading' | 'ready' | 'toobig' | 'error'>('loading');
  const [kind, setKind] = useState<Kind>('other');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');

  const fileName = doc.fileName ?? doc.title;

  useEffect(() => {
    let objectUrl = '';
    let cancelled = false;

    const load = async () => {
      if ((doc.byteSize ?? 0) > MAX_PREVIEW_BYTES) {
        setState('toobig');
        return;
      }
      try {
        const token = await auth.currentUser?.getIdToken();
        // mode=view — 내려받기와 구분해 열람으로 이력에 남는다.
        const res = await fetch(`${doc.contentUrl}${doc.contentUrl.includes('?') ? '&' : '?'}mode=view`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('불러오지 못했습니다.');
        const blob = await res.blob();
        if (cancelled) return;

        const k = kindOf(fileName, blob.type || '');
        setKind(k);
        if (k === 'text') {
          setText(await blob.text());
        } else if (k !== 'other') {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
        setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    };

    load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc.contentUrl, doc.byteSize, fileName]);

  const download = async () => {
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch(doc.contentUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) {
      window.alert('파일을 내려받지 못했습니다.');
      return;
    }
    const blobUrl = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(blobUrl);
  };

  // 인쇄 첫 장에 붙일 문서 정보 표지. 종이만 보고 무엇을 출력한 것인지 알 수 있게 한다.
  const coverHtml = () => {
    const rows: [string, string][] = [
      ['문서번호', doc.docNo ?? '-'],
      ['제목', doc.title],
      ['파일', fileName],
      ['크기', size(doc.byteSize)],
      ...((doc.facts ?? []).map((f) => [f.label, f.value] as [string, string])),
    ];
    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return (
      '<section class="cover">' +
      `<h1>${esc(doc.title)}</h1>` +
      `<p class="sub">${esc(doc.docNo ?? '')}</p>` +
      '<table>' +
      rows.map(([k, v]) => `<tr><th>${k}</th><td>${esc(String(v))}</td></tr>`).join('') +
      '</table>' +
      `<p class="foot">출력 ${new Date().toLocaleString('ko-KR')}</p>` +
      '</section>'
    );
  };

  const print = () => {
    if (state !== 'ready') return;
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(frame);
    let opened = false;
    const open = () => {
      if (opened) return;
      opened = true;
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      window.setTimeout(() => frame.remove(), 60_000);
    };

    // PDF는 브라우저가 원본을 그대로 인쇄한다. 표지를 앞에 끼우려면 PDF를 합쳐야 해서 원본만 낸다.
    if (kind === 'pdf') {
      frame.src = url;
      frame.onload = open;
      return;
    }

    // 이미지·텍스트는 인쇄용 문서로 감싸고 표지를 앞에 붙인다.
    const body =
      kind === 'image'
        ? `<img src="${url}" alt="${fileName}">`
        : `<pre>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
    const d = frame.contentWindow?.document;
    if (!d) return;
    d.open();
    d.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${fileName}</title>` +
        '<style>@page{margin:12mm}body{margin:0;font-family:"맑은 고딕",sans-serif;color:#000}' +
        'img{max-width:100%}pre{white-space:pre-wrap;word-break:break-all;font-size:12px;line-height:1.6}' +
        '.cover{page-break-after:always}.cover h1{font-size:20px;margin:0 0 4px}' +
        '.cover .sub{margin:0 0 16px;color:#555;font-size:12px}' +
        '.cover table{width:100%;border-collapse:collapse;font-size:12px}' +
        '.cover th{width:110px;text-align:left;padding:6px 8px;background:#f2f2f2;border:1px solid #ddd;font-weight:600}' +
        '.cover td{padding:6px 8px;border:1px solid #ddd}' +
        '.cover .foot{margin-top:14px;color:#777;font-size:11px}' +
        `</style></head><body>${coverHtml()}${body}</body></html>`,
    );
    d.close();
    // document.write로 채운 iframe은 onload가 오지 않는 경우가 있어 타이머로 연다.
    window.setTimeout(open, 300);
  };

  // 화면에서 열 수 없는 형식 — 무엇인지 알 수 있게 요약을 보여 주고 내려받기로 안내한다.
  const summary = (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <FileWarning size={34} className="text-text-faint" />
      <div>
        <p className="text-[14px] font-bold text-text-strong">화면에서 열 수 없는 형식입니다</p>
        <p className="mt-1 text-[12.5px] text-text-sub">
          엑셀·워드·한글 문서는 브라우저가 읽지 못합니다. 내려받아 확인하세요.
        </p>
      </div>
      <dl className="w-full max-w-[420px] text-left">
        {[
          { label: '문서번호', value: doc.docNo ?? '-' },
          { label: '제목', value: doc.title },
          { label: '파일', value: fileName },
          { label: '크기', value: size(doc.byteSize) },
          ...(doc.facts ?? []),
        ].map((f) => (
          <div key={f.label} className="flex justify-between gap-3 border-b border-border py-1.5">
            <dt className="shrink-0 text-[12.5px] text-text-sub">{f.label}</dt>
            <dd className="truncate text-[13px] font-semibold text-text-strong">{f.value}</dd>
          </div>
        ))}
      </dl>
      <button type="button" onClick={download} className={primaryBtnCls}>
        <Download size={15} /> 내려받기
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/60 p-5">
      <div className="flex h-[88vh] w-full max-w-[1100px] flex-col rounded-[14px] border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-extrabold text-text-strong">{doc.title}</p>
            <p className="truncate text-[12px] text-text-faint">
              {doc.docNo ? `${doc.docNo} · ` : ''}
              {fileName} · {size(doc.byteSize)}
            </p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {state === 'ready' && kind !== 'other' && (
              <button type="button" title="인쇄 · PDF 저장" onClick={print} className={`${outlineBtnCls} h-8 px-2.5`}>
                <Printer size={15} />
              </button>
            )}
            <button type="button" title="내려받기" onClick={download} className={`${outlineBtnCls} h-8 px-2.5`}>
              <Download size={15} />
            </button>
            <button type="button" title="닫기" onClick={onClose} className={`${outlineBtnCls} h-8 px-2.5`}>
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-input">
          {state === 'loading' && (
            <p className="py-20 text-center text-[13px] text-text-faint">파일을 불러오는 중입니다…</p>
          )}
          {state === 'error' && (
            <p className="py-20 text-center text-[13px] text-danger">파일을 불러오지 못했습니다.</p>
          )}
          {state === 'toobig' && (
            <div className="py-20 text-center">
              <p className="text-[13px] text-text-sub">
                파일이 커서({size(doc.byteSize)}) 화면에서 열지 않습니다. 내려받아 확인하세요.
              </p>
              <button type="button" onClick={download} className={`${primaryBtnCls} mt-4`}>
                <Download size={15} /> 내려받기
              </button>
            </div>
          )}
          {state === 'ready' && kind === 'pdf' && <iframe src={url} title={fileName} className="h-full w-full border-0" />}
          {state === 'ready' && kind === 'image' && (
            <div className="flex h-full items-start justify-center p-4">
              <img src={url} alt={fileName} className="max-w-full" />
            </div>
          )}
          {state === 'ready' && kind === 'text' && (
            <pre className="whitespace-pre-wrap break-all p-5 text-[12.5px] leading-relaxed text-text">{text}</pre>
          )}
          {state === 'ready' && kind === 'other' && summary}
        </div>
      </div>
    </div>
  );
}

export const contentUrlOf = (path: string) => `${API_BASE_URL}${path}`;
