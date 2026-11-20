import { useRef, useState } from 'react';
import { Upload, FileDown } from 'lucide-react';
import { API_BASE_URL } from '../api/client';
import { auth } from '../lib/firebase';
import { FormModal } from './FormModal';
import { formatNumber } from '../lib/number';
import { cardPadCls, primaryBtnCls, outlineBtnCls, tableWrapCls, thCls, thNumCls, tdCls, tdNumCls, trCls } from './ui/classes';

// 입고 엑셀 일괄 등록 (요청 2026-11-13)
//
// 한 건씩 적기 어려운 날이 있고, 나중에 계근프로그램이 뽑아 주는 내역도 이 길로 올린다.
// 올리기 전에 어느 줄이 들어가고 어느 줄이 왜 빠지는지 먼저 보여 준다.

interface Row {
  행: number;
  projectName: string | null;
  inboundDate: string;
  vehicleNo: string | null;
  itemName: string | null;
  netWeight: number;
  unitPrice: number | null;
}
interface Preview {
  넣을것: number;
  못넣는것: number;
  rows: Row[];
  오류: { 행: number; 사유: string }[];
}

async function send<T>(path: string, file: File): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? '처리하지 못했습니다.');
  return json as T;
}

export function InboundBulkUploadModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<{ 넣음: number; 못넣은것: { 행: number; 사유: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const choose = async (f: File) => {
    setFile(f);
    setPreview(null);
    setResult(null);
    setError('');
    setBusy(true);
    try {
      setPreview(await send<Preview>('/api/inbounds/bulk-preview', f));
    } catch (e) {
      setError(e instanceof Error ? e.message : '엑셀을 읽지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      setResult(await send('/api/inbounds/bulk-upload', file));
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : '올리지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const template = async () => {
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch(`${API_BASE_URL}/api/inbounds/template`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '입고등록양식.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <FormModal title="입고 엑셀 일괄 등록" icon={Upload} onClose={onClose}>
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
          양식을 받아 채워 올리시면 한 번에 들어갑니다. <b className="text-text-strong">현장 이름</b>과{' '}
          <b className="text-text-strong">상차일 · 총중량 · 공차중량</b>은 꼭 있어야 하고, 입고량은 저희가 계산합니다.
          재고와 운반비도 함께 쌓입니다. 같은 줄을 두 번 올리면 두 건이 되니 아래 미리보기로 확인해 주세요.
        </p>

        {preview && !result && (
          <>
            <p className="mb-2 text-[13px] font-bold text-text-strong">
              넣을 것 {preview.넣을것}건
              {preview.못넣는것 > 0 && <span className="ml-2 text-danger">· 못 넣는 것 {preview.못넣는것}건</span>}
            </p>
            <div className={`${tableWrapCls} max-h-[34vh] overflow-auto`}>
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-[1] bg-card">
                  <tr className="border-y border-border">
                    <th className={thCls}>행</th>
                    <th className={thCls}>현장</th>
                    <th className={thCls}>상차일</th>
                    <th className={thCls}>차량번호</th>
                    <th className={thCls}>제품명</th>
                    <th className={thNumCls}>입고량</th>
                    <th className={thNumCls}>단가</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr key={r.행} className={trCls}>
                      <td className={`${tdCls} tabular`}>{r.행}</td>
                      <td className={tdCls}>{r.projectName ?? '-'}</td>
                      <td className={`${tdCls} tabular whitespace-nowrap`}>{String(r.inboundDate).slice(0, 10)}</td>
                      <td className={tdCls}>{r.vehicleNo ?? '-'}</td>
                      <td className={tdCls}>{r.itemName ?? '미분류'}</td>
                      <td className={tdNumCls}>{formatNumber(r.netWeight)}</td>
                      <td className={tdNumCls}>{r.unitPrice ? formatNumber(r.unitPrice) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.오류.length > 0 && (
              <ul className="mt-2 max-h-[16vh] space-y-0.5 overflow-auto text-[12.5px] text-danger">
                {preview.오류.map((e, i) => (
                  <li key={i}>
                    {e.행}행 — {e.사유}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {result && (
          <div className="rounded-[10px] border border-border px-3 py-2.5">
            <p className="mb-1 text-[13px] font-bold text-text-strong">{result.넣음}건을 넣었습니다.</p>
            {result.못넣은것.length > 0 && (
              <ul className="space-y-0.5 text-[12.5px] text-danger">
                {result.못넣은것.slice(0, 15).map((e, i) => (
                  <li key={i}>
                    {e.행}행 — {e.사유}
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
            <button type="button" onClick={upload} disabled={busy || !preview || preview.넣을것 === 0} className={primaryBtnCls}>
              {busy ? '올리는 중...' : `${preview?.넣을것 ?? 0}건 올리기`}
            </button>
          )}
        </div>
      </div>
    </FormModal>
  );
}
