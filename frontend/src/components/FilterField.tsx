import type { ReactNode } from 'react';
import { inputCls } from './ui/classes';

// 검색 필터 항목 — 무엇을 고르는 칸인지 라벨을 달아 준다.
export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="mb-1 block text-[11.5px] font-semibold text-text-sub">{label}</span>
      {children}
    </div>
  );
}

// 기간 필터 — 시작~종료를 한 칸으로 묶는다.
export function DateRangeField({
  label,
  from,
  to,
  setFrom,
  setTo,
}: {
  label: string;
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
}) {
  return (
    <FilterField label={label}>
      <div className="flex items-center gap-1">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label={`${label} 시작`} className={`${inputCls} px-2`} />
        <span className="shrink-0 text-text-faint">~</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label={`${label} 종료`} className={`${inputCls} px-2`} />
      </div>
    </FilterField>
  );
}
