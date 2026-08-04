import type { LucideIcon } from 'lucide-react';

export function SummaryCard({
  icon: Icon,
  color,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  color: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[12px] border border-border bg-card p-4">
      <div
        className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px]"
        style={{ background: `${color}22`, color }}
      >
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-text-faint">{label}</div>
        <div className="tabular truncate text-[20px] font-extrabold text-text-strong">{value}</div>
        {sub && <div className="text-[12.5px] text-text-sub">{sub}</div>}
      </div>
    </div>
  );
}
