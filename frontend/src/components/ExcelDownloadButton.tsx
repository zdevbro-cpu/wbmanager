import { useState } from 'react';
import { Download } from 'lucide-react';
import { downloadFile } from '../lib/download';
import { outlineBtnCls } from './ui/classes';

type Cell = string | number | null | undefined;

export interface ExcelColumn<T> {
  header: string;
  value: (row: T) => Cell;
  width?: number;
}

export interface ExcelSheet {
  name: string;
  columns: { header: string; width?: number }[];
  rows: () => Cell[][];
}

// 표 하나를 시트 하나로 — 값은 누를 때 계산해 화면을 그릴 때마다 만들지 않는다.
export function excelSheet<T>(name: string, rows: T[], columns: ExcelColumn<T>[]): ExcelSheet {
  return {
    name,
    columns: columns.map(({ header, width }) => ({ header, width })),
    rows: () => rows.map((r) => columns.map((c) => c.value(r))),
  };
}

// 금액·중량 문자열(Decimal)을 엑셀에서 계산되는 숫자로 바꾼다. 비어 있으면 빈 칸.
export const excelNum = (v: string | number | null | undefined): Cell => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : String(v);
};

// 목록 엑셀 다운로드 — 화면에 지금 보이는(필터가 걸린) 줄을 그대로 파일로 만든다.
// PDF가 필요하면 브라우저 인쇄(Ctrl+P)의 「PDF로 저장」을 쓴다.
export function ExcelDownloadButton({
  fileName,
  sheets,
  conditions,
  className = '',
}: {
  fileName: string;
  sheets: ExcelSheet[];
  /** 파일 첫 줄에 남길 조회 조건 — 예: "상태: 진행 · 검색어: 세화" */
  conditions?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const form = new FormData();
      form.append(
        'payload',
        JSON.stringify({
          fileName,
          conditions,
          sheets: sheets.map((s) => ({ name: s.name, columns: s.columns, rows: s.rows() })),
        }),
      );
      await downloadFile('/api/list-exports/rows', `${fileName}.xlsx`, { method: 'POST', body: form });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '엑셀 내려받기에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" onClick={run} disabled={busy} className={`${outlineBtnCls} whitespace-nowrap ${className}`}>
      <Download size={15} /> {busy ? '만드는 중…' : '엑셀 다운로드'}
    </button>
  );
}

// 조회 조건 문구 — 값이 있는 것만 "이름: 값"으로 잇는다.
export function conditionText(pairs: [string, string | null | undefined | false][]) {
  const parts = pairs.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
  return parts.length ? parts.join(' · ') : '조건: 전체';
}
