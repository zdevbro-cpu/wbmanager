import { useEffect, useMemo, useState } from 'react';
import { FileArchive } from 'lucide-react';
import { api, API_BASE_URL } from '../api/client';
import { auth } from '../lib/firebase';
import { FormModal } from './FormModal';
import { DateField } from './ui/DateField';
import { cardPadCls, primaryBtnCls, outlineBtnCls, inputCls } from './ui/classes';

// 묶어 받기 (리뷰회의 4-1 · 5-8, 대상확인서 회신 2026-10-23)
//
// 회신 주신 방식 그대로다 — 넣을 파일이 모두 체크된 채로 뜨고, 뺄 것만 체크를 푼다.

export interface ZipFile {
  key: string;
  group: string;
  kind: string;
  fileName?: string | null;
  date?: string | null;
  note?: string | null;
}

interface Preview {
  title: string;
  groups: string[];
  files: ZipFile[];
}

const labelCls = 'mb-1.5 block text-[13px] font-semibold text-text-mid';

export function ZipDownloadModal({
  scope,
  id,
  onClose,
}: {
  /** project = 현장별, asset = 차량·장비별 */
  scope: 'project' | 'asset';
  id: string;
  onClose: () => void;
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // 기간은 현장에서만 고른다(H2). 자산 서류는 몇 장 되지 않아 통째로 본다.
  const ranged = scope === 'project';

  useEffect(() => {
    const params = new URLSearchParams();
    if (ranged && from) params.set('from', from);
    if (ranged && to) params.set('to', to);
    setError('');
    api
      .get<Preview>(`/api/zip/${scope}/${id}/preview?${params.toString()}`)
      .then((p) => {
        setPreview(p);
        // 모두 체크된 채로 뜬다 — 뺀 것만 기억한다.
        setOff(new Set());
      })
      .catch((e) => setError(e instanceof Error ? e.message : '목록을 읽지 못했습니다.'));
  }, [scope, id, from, to, ranged]);

  const byGroup = useMemo(() => {
    const map = new Map<string, ZipFile[]>();
    for (const f of preview?.files ?? []) {
      const list = map.get(f.group) ?? [];
      list.push(f);
      map.set(f.group, list);
    }
    return [...map.entries()];
  }, [preview]);

  const picked = (preview?.files ?? []).filter((f) => !off.has(f.key));

  const toggle = (key: string) =>
    setOff((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleGroup = (files: ZipFile[]) => {
    const allOn = files.every((f) => !off.has(f.key));
    setOff((prev) => {
      const next = new Set(prev);
      for (const f of files) {
        if (allOn) next.add(f.key);
        else next.delete(f.key);
      }
      return next;
    });
  };

  const download = async () => {
    if (picked.length === 0) {
      setError('받을 파일을 하나는 두세요.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/zip/${scope}/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ keys: picked.map((f) => f.key), ...(ranged ? { from, to } : {}) }),
      });
      if (!res.ok) {
        const msg = await res.json().catch(() => null);
        throw new Error(msg?.error ?? '묶지 못했습니다.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // 서버가 붙여 준 이름을 그대로 쓴다.
      const cd = res.headers.get('Content-Disposition') ?? '';
      const m = /filename\*=UTF-8''([^;]+)/.exec(cd);
      a.download = m ? decodeURIComponent(m[1]) : `${preview?.title ?? '묶음'}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '묶지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormModal title={`묶어 받기 — ${preview?.title ?? ''}`} icon={FileArchive} onClose={onClose}>
      <div className={cardPadCls}>
        {ranged && (
          <div className="mb-3 flex items-end gap-2">
            <div>
              <label className={labelCls}>기간</label>
              <div className="flex items-center gap-1">
                <DateField value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} px-2`} />
                <span className="text-text-faint">~</span>
                <DateField value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} px-2`} />
              </div>
            </div>
            {(from || to) && (
              <button
                type="button"
                onClick={() => {
                  setFrom('');
                  setTo('');
                }}
                className={`${outlineBtnCls} h-[38px]`}
              >
                전체 기간
              </button>
            )}
          </div>
        )}

        <p className="mb-3 text-[12.5px] text-text-sub">
          넣을 파일이 모두 체크된 채로 떠 있습니다. <b className="text-text-strong">뺄 것만 체크를 푸세요.</b> 묶음 안은
          종류별 폴더로 나뉘고, 파일 이름은 「날짜_종류_원래이름」으로 붙습니다. 무엇이 들어 있는지 적은 목록표도 함께
          들어갑니다.
        </p>

        <div className="max-h-[46vh] overflow-y-auto rounded-[10px] border border-border">
          {byGroup.map(([group, files]) => {
            const onCount = files.filter((f) => !off.has(f.key)).length;
            return (
              <div key={group} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggleGroup(files)}
                  className="flex w-full items-center gap-2 bg-input px-3 py-2 text-left"
                >
                  <input type="checkbox" checked={onCount === files.length} readOnly className="pointer-events-none" />
                  <span className="text-[13px] font-bold text-text-strong">{group}</span>
                  <span className="ml-auto text-[12px] text-text-sub">
                    {onCount} / {files.length}건
                  </span>
                </button>
                {files.map((f) => (
                  <label key={f.key} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-hover">
                    <input type="checkbox" checked={!off.has(f.key)} onChange={() => toggle(f.key)} />
                    <span className="tabular shrink-0 text-[12px] text-text-faint">{f.date ?? '-'}</span>
                    <span className="shrink-0 text-[12px] text-text-sub">{f.kind}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-text">{f.fileName ?? '(이름 없음)'}</span>
                    {f.note && <span className="shrink-0 text-[12px] text-text-faint">{f.note}</span>}
                  </label>
                ))}
              </div>
            );
          })}
          {preview && preview.files.length === 0 && (
            <p className="py-10 text-center text-[13px] text-text-faint">묶을 파일이 없습니다.</p>
          )}
          {!preview && !error && <p className="py-10 text-center text-[13px] text-text-faint">목록을 읽는 중…</p>}
        </div>

        {error && <p className="mt-3 text-[13px] font-semibold text-danger">{error}</p>}

        <div className="mt-4 flex items-center justify-end gap-2">
          <span className="mr-auto text-[12.5px] text-text-sub">{picked.length}건을 묶습니다</span>
          <button type="button" onClick={onClose} className={outlineBtnCls}>
            닫기
          </button>
          <button type="button" onClick={download} disabled={busy || picked.length === 0} className={primaryBtnCls}>
            {busy ? '묶는 중...' : '묶어 받기'}
          </button>
        </div>
      </div>
    </FormModal>
  );
}
