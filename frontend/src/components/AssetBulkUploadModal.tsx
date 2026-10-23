import { useRef, useState } from 'react';
import { Upload, FileDown } from 'lucide-react';
import { API_BASE_URL } from '../api/client';
import { auth } from '../lib/firebase';
import { FormModal } from './FormModal';
import { cardPadCls, primaryBtnCls, outlineBtnCls } from './ui/classes';

// 자산 일괄 등록 (회의 2026-10-14 5-12)
//
// 관리대장은 시트가 여럿이고 그 안에 이력 시트와 과거분 시트가 섞여 있다.
// 그래서 파일을 고르면 먼저 시트를 훑어 보여 주고, 넣을 시트만 고르게 한다.

interface SheetInfo {
  name: string;
  rows: number;
  readable: boolean;
  history: boolean;
}

interface UploadResult {
  시트수: number;
  추가: number;
  수정: number;
  합친것: { 차량번호: string; 이미있던자산번호: string; 이번시트: string }[];
  번호없어건너뜀: number;
  오류: { 시트?: string; 행: number; 자산번호?: string; 사유: string }[];
  시트별: { 시트: string; 머리글행: number; 추가: number; 수정: number; 합침: number; 건너뜀: number }[];
}

async function post<T>(path: string, body: FormData): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? '처리하지 못했습니다.');
  return json as T;
}

export function AssetBulkUploadModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<SheetInfo[] | null>(null);
  const [pick, setPick] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<UploadResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const choose = async (f: File) => {
    setFile(f);
    setSheets(null);
    setResult(null);
    setError('');
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', f);
      const r = await post<{ sheets: SheetInfo[] }>('/api/assets/sheets', form);
      setSheets(r.sheets);
      // 읽을 수 있고 이력이 아닌 시트를 먼저 골라 둔다. 과거분은 눈으로 보고 빼시면 된다.
      setPick(new Set(r.sheets.filter((s) => s.readable && !s.history).map((s) => s.name)));
    } catch (e) {
      setError(e instanceof Error ? e.message : '시트를 읽지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const upload = async () => {
    if (!file || pick.size === 0) {
      setError('넣을 시트를 하나는 고르세요.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('sheets', [...pick].join(','));
      setResult(await post<UploadResult>('/api/assets/bulk-upload', form));
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : '올리지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const template = async () => {
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch(`${API_BASE_URL}/api/assets/template`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '자산등록양식.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <FormModal title="자산 일괄 등록" icon={Upload} onClose={onClose}>
      <div className={cardPadCls}>
        <div className="mb-3 flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) choose(f);
            }}
          />
          <button type="button" onClick={() => fileRef.current?.click()} className={primaryBtnCls}>
            <Upload size={15} /> 엑셀 고르기
          </button>
          <button type="button" onClick={template} className={outlineBtnCls}>
            <FileDown size={15} /> 양식 받기
          </button>
          {file && <span className="truncate text-[12.5px] text-text-sub">{file.name}</span>}
        </div>

        <p className="mb-3 text-[12.5px] leading-relaxed text-text-sub">
          자산번호는 쓰시는 <b className="text-text-strong">관리번호</b>를 그대로 씁니다. 관리번호가 없는 차량은 차량번호가
          자산번호가 됩니다. 같은 자산번호가 이미 있으면 고치므로 두 번 올려도 늘어나지 않습니다. 차량번호가 같으면 한
          건으로 합칩니다 — 관리대장처럼 같은 굴착기가 두 시트에 나와도 두 건이 되지 않습니다.
          <br />
          사진이 박힌 원본은 30MB를 넘을 수 있습니다. 그때는 사진을 지운 사본으로 올려 주세요.
        </p>

        {sheets && !result && (
          <div className="max-h-[40vh] overflow-y-auto rounded-[10px] border border-border">
            {sheets.map((s) => (
              <label
                key={s.name}
                className={`flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-hover ${
                  s.readable ? '' : 'opacity-50'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={!s.readable}
                  checked={pick.has(s.name)}
                  onChange={() =>
                    setPick((prev) => {
                      const next = new Set(prev);
                      if (next.has(s.name)) next.delete(s.name);
                      else next.add(s.name);
                      return next;
                    })
                  }
                />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text">{s.name}</span>
                {s.history && <span className="shrink-0 text-[12px] text-warning">이력 시트</span>}
                {!s.readable && <span className="shrink-0 text-[12px] text-text-faint">읽을 수 없음</span>}
                <span className="shrink-0 text-[12px] text-text-faint">{s.rows}줄</span>
              </label>
            ))}
          </div>
        )}

        {result && (
          <div className="rounded-[10px] border border-border px-3 py-2.5">
            <p className="mb-2 text-[13px] font-bold text-text-strong">
              추가 {result.추가}건 · 수정 {result.수정}건 · 합침 {result.합친것.length}건
              {result.번호없어건너뜀 > 0 && ` · 번호가 없어 건너뜀 ${result.번호없어건너뜀}건`}
            </p>
            <ul className="mb-2 space-y-0.5 text-[12.5px] text-text-sub">
              {result.시트별.map((s) => (
                <li key={s.시트}>
                  {s.시트} — 추가 {s.추가} · 수정 {s.수정} · 합침 {s.합침}
                  {s.건너뜀 > 0 && ` · 건너뜀 ${s.건너뜀}`}
                </li>
              ))}
            </ul>
            {result.합친것.length > 0 && (
              <p className="mb-1 text-[12px] text-text-faint">
                합친 것: {result.합친것.map((m) => `${m.차량번호}→${m.이미있던자산번호}`).join(', ')}
              </p>
            )}
            {result.오류.length > 0 && (
              <ul className="space-y-0.5 text-[12.5px] text-danger">
                {result.오류.slice(0, 10).map((e, i) => (
                  <li key={i}>
                    {e.시트 ?? ''} {e.행}행 {e.자산번호 ?? ''} — {e.사유}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-[13px] font-semibold text-danger">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={outlineBtnCls}>
            닫기
          </button>
          {!result && (
            <button type="button" onClick={upload} disabled={busy || !sheets || pick.size === 0} className={primaryBtnCls}>
              {busy ? '올리는 중...' : `${pick.size}개 시트 올리기`}
            </button>
          )}
        </div>
      </div>
    </FormModal>
  );
}
