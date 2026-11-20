import { useCallback, useEffect, useState } from 'react';
import { Coins, Check } from 'lucide-react';
import { api } from '../api/client';
import { formatNumber } from '../lib/number';
import { inputCls } from './ui/classes';

// 묶음(품목 분류)별 평균단가 (요청 2026-11-13).
//
// 품목마다 단가를 하나하나 넣기 어렵다고 하셔서, 고철 · 비철 · 구리 · 폐기물처럼
// 묶음으로 값을 하나 정해 두면 그 안의 품목을 모두 그 단가로 평가한다.
// 품목에 제 단가가 있으면 그것이 먼저고, 여기 값은 비어 있는 품목에만 쓰인다.

interface GroupPrice {
  category: string;
  price: number;
  memo?: string | null;
}

export function GroupPriceBar({ onSaved }: { onSaved?: () => void }) {
  const [rows, setRows] = useState<GroupPrice[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState('');

  const load = useCallback(() => {
    api.get<GroupPrice[]>('/api/inventory/group-prices').then((r) => {
      setRows(r);
      setDraft(Object.fromEntries(r.map((g) => [g.category, g.price ? String(g.price) : ''])));
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (category: string) => {
    const raw = draft[category];
    const price = raw === '' ? 0 : Number(raw);
    if (!Number.isFinite(price) || price < 0) return;
    await api.put(`/api/inventory/group-prices/${encodeURIComponent(category)}`, { price });
    setSaved(category);
    window.setTimeout(() => setSaved(''), 1500);
    load();
    onSaved?.();
  };

  if (rows.length === 0) return null;

  return (
    <div className="mb-4 rounded-[12px] border border-border bg-card px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <Coins size={15} className="text-primary" />
        <span className="text-[12.5px] font-semibold text-text-faint">묶음 평균단가</span>
        <span className="text-[12px] text-text-faint">
          품목에 제 단가가 없을 때 이 값으로 평가합니다. 적고 ↵ 를 누르거나 칸 밖을 누르면 저장됩니다.
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {rows.map((g) => (
          <label key={g.category} className="flex items-center gap-2">
            <span className="w-[76px] shrink-0 text-[13px] text-text">{g.category}</span>
            <input
              value={draft[g.category] ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, [g.category]: e.target.value.replace(/[^\d.]/g, '') }))}
              onBlur={() => save(g.category)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
              placeholder="0"
              className={`${inputCls} tabular h-8 text-right text-[13px]`}
            />
            <span className="w-[42px] shrink-0 text-[12px] text-text-faint">
              {saved === g.category ? <Check size={14} className="text-success" /> : '원/kg'}
            </span>
          </label>
        ))}
      </div>

      <p className="mt-2 text-[12px] text-text-faint">
        지금 값 — {rows.map((g) => `${g.category} ${formatNumber(g.price)}`).join(' · ')}
      </p>
    </div>
  );
}
