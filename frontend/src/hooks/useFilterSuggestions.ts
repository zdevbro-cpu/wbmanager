import { useCallback, useRef, useState } from 'react';
import type { FilterKey } from '../components/TransactionListLayout';

// 후보를 뽑을 항목 — 마스터에 없는 값이 그대로 들어가는 칸들이다.
const KEYS = ['vehicleNo', 'driverName', 'vehicleType', 'dischargerName', 'transporterName', 'processorName'] as const;

type Key = (typeof KEYS)[number];
type Row = Partial<Record<Key, string | null>>;

// 목록에 실제로 들어 있던 값을 검색 후보로 모은다.
// 조건을 좁히면 결과가 줄어드는데, 그때마다 후보까지 사라지면 다시 고를 수가 없다.
// 그래서 한 번 본 값은 계속 들고 간다.
export function useFilterSuggestions() {
  const pool = useRef<Record<Key, Set<string>>>({
    vehicleNo: new Set(),
    driverName: new Set(),
    vehicleType: new Set(),
    dischargerName: new Set(),
    transporterName: new Set(),
    processorName: new Set(),
  });
  const [suggestions, setSuggestions] = useState<Partial<Record<FilterKey, string[]>>>({});

  const collect = useCallback((rows: Row[]) => {
    let added = false;
    for (const row of rows) {
      for (const key of KEYS) {
        const v = row[key];
        if (v && !pool.current[key].has(v)) {
          pool.current[key].add(v);
          added = true;
        }
      }
    }
    if (!added) return;
    const next: Partial<Record<FilterKey, string[]>> = {};
    for (const key of KEYS) next[key] = [...pool.current[key]].sort();
    setSuggestions(next);
  }, []);

  return { suggestions, collect };
}
