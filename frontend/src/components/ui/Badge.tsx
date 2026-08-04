export type BadgeTone = 'green' | 'blue' | 'sky' | 'amber' | 'yellow' | 'red' | 'purple' | 'teal' | 'slate';

const TONE_FG: Record<BadgeTone, string> = {
  green: '#22c55e',
  blue: '#60a5fa',
  sky: '#38bdf8',
  amber: '#f59e0b',
  yellow: '#eab308',
  red: '#f87171',
  purple: '#a78bfa',
  teal: '#2dd4bf',
  slate: '#94a3b8',
};

export function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  const fg = TONE_FG[tone];
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11.5px] font-bold"
      style={{ color: fg, background: `${fg}26`, border: `1px solid ${fg}33` }}
    >
      {children}
    </span>
  );
}
