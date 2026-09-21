import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Save, RotateCcw } from 'lucide-react';
import { api } from '../api/client';
import {
  pageTitleCls,
  cardCls,
  primaryBtnCls,
  outlineBtnCls,
  inputCls,
  tableWrapCls,
  thCls,
  tdCls,
  trCls,
} from '../components/ui/classes';

// 메뉴별 권한 (리뷰회의 1-7 · 5-18)
//
// 「사용권한 체크목록」의 본표를 그대로 담아 두고 여기서 고친다.
// 한 줄이 화면 하나, 계층마다 C·R·U·D 네 칸이다.
// R을 끄면 그 계층에는 메뉴가 아예 보이지 않는다.

interface Role {
  key: string;
  label: string;
}
interface Screen {
  key: string;
  area: string;
  name: string;
  sortOrder: number;
  memo?: string | null;
}
interface PermRow {
  roleKey: string;
  screenKey: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}
type Cell = { c: boolean; r: boolean; u: boolean; d: boolean };

const FLAGS = [
  ['c', 'C'],
  ['r', 'R'],
  ['u', 'U'],
  ['d', 'D'],
] as const;

const key = (roleKey: string, screenKey: string) => `${roleKey}|${screenKey}`;

export function PermissionPage({ embedded = false }: { embedded?: boolean } = {}) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [area, setArea] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(() => {
    api.get<{ roles: Role[]; screens: Screen[]; permissions: PermRow[] }>('/api/permissions').then((d) => {
      setRoles(d.roles);
      setScreens(d.screens);
      const map: Record<string, Cell> = {};
      for (const s of d.screens) {
        for (const role of d.roles) map[key(role.key, s.key)] = { c: false, r: false, u: false, d: false };
      }
      for (const p of d.permissions) {
        map[key(p.roleKey, p.screenKey)] = { c: p.canCreate, r: p.canRead, u: p.canUpdate, d: p.canDelete };
      }
      setCells(map);
      setDirty(new Set());
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const areas = useMemo(() => [...new Set(screens.map((s) => s.area))], [screens]);

  const visible = useMemo(
    () =>
      screens.filter((s) => {
        if (area && s.area !== area) return false;
        const k = q.trim().toLowerCase();
        if (k && !`${s.area} ${s.name} ${s.memo ?? ''}`.toLowerCase().includes(k)) return false;
        return true;
      }),
    [screens, area, q],
  );

  const toggle = (roleKey: string, screenKey: string, flag: 'c' | 'r' | 'u' | 'd') => {
    const k = key(roleKey, screenKey);
    setCells((prev) => ({ ...prev, [k]: { ...prev[k], [flag]: !prev[k]?.[flag] } }));
    setDirty((prev) => new Set(prev).add(k));
    setNote('');
  };

  // 한 줄을 통째로 켜고 끈다 — 계층별로 화면을 통째로 여닫을 때가 많다.
  const toggleAll = (roleKey: string, screenKey: string) => {
    const k = key(roleKey, screenKey);
    const cur = cells[k] ?? { c: false, r: false, u: false, d: false };
    const on = !(cur.c && cur.r && cur.u && cur.d);
    setCells((prev) => ({ ...prev, [k]: { c: on, r: on, u: on, d: on } }));
    setDirty((prev) => new Set(prev).add(k));
    setNote('');
  };

  const save = async () => {
    if (!dirty.size) return;
    setBusy(true);
    try {
      const changes = [...dirty].map((k) => {
        const [roleKey, screenKey] = k.split('|');
        return { roleKey, screenKey, ...cells[k] };
      });
      const r = await api.put<{ count: number }>('/api/permissions', { changes });
      setNote(`${r.count}칸을 저장했습니다. 다음 접속부터 적용됩니다.`);
      setDirty(new Set());
    } catch (e) {
      setNote(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {!embedded && <ShieldCheck size={20} className="text-primary" />}
        <h1 className={pageTitleCls}>권한 관리</h1>
        <span className="text-[12.5px] text-text-sub">
          화면 {screens.length}개 · 계층 {roles.length}개
          {dirty.size > 0 && <span className="ml-2 font-bold text-warning">고친 칸 {dirty.size}</span>}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {dirty.size > 0 && (
            <button type="button" onClick={load} className={outlineBtnCls}>
              <RotateCcw size={15} /> 되돌리기
            </button>
          )}
          <button type="button" onClick={save} disabled={busy || !dirty.size} className={primaryBtnCls}>
            <Save size={15} /> {busy ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      <div className={`${cardCls} mb-3 flex flex-wrap items-center gap-2 px-3 py-2.5`}>
        <select value={area} onChange={(e) => setArea(e.target.value)} className={`${inputCls} w-[200px]`}>
          <option value="">영역 전체</option>
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="화면 이름 · 비고 검색"
          className={`${inputCls} w-[260px]`}
        />
        <span className="text-[12.5px] text-text-faint">
          C 등록 · R 조회 · U 수정 · D 삭제 — R을 끄면 그 계층에는 메뉴가 보이지 않습니다. 계층 이름을 누르면 한 줄이 통째로 켜지고 꺼집니다.
        </span>
      </div>

      {note && <p className="mb-3 text-[13px] font-semibold text-success">{note}</p>}

      <div className={`${tableWrapCls} overflow-x-auto`}>
        <table className="w-max min-w-full border-collapse">
          <thead>
            <tr className="border-y border-border">
              <th className={`${thCls} sticky left-0 z-10 bg-card`}>화면</th>
              <th className={thCls}>영역</th>
              {roles.map((role) => (
                <th key={role.key} className={`${thCls} whitespace-nowrap text-center`}>
                  {role.label}
                  <span className="block text-[10.5px] font-normal text-text-faint">C R U D</span>
                </th>
              ))}
              <th className={thCls}>비고</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              <tr key={s.key} className={trCls}>
                <td className={`${tdCls} sticky left-0 z-10 whitespace-nowrap bg-card font-semibold text-text-strong`}>
                  {s.name}
                </td>
                <td className={`${tdCls} whitespace-nowrap text-text-sub`}>{s.area}</td>
                {roles.map((role) => {
                  const cell = cells[key(role.key, s.key)] ?? { c: false, r: false, u: false, d: false };
                  return (
                    <td key={role.key} className="px-2 py-1 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {FLAGS.map(([f, label]) => (
                          <button
                            key={f}
                            type="button"
                            title={`${role.label} · ${label}`}
                            onClick={() => toggle(role.key, s.key, f)}
                            className={`h-[22px] w-[22px] rounded-[5px] border text-[11px] font-bold ${
                              cell[f]
                                ? 'border-primary bg-primary/15 text-primary'
                                : 'border-border text-text-faint hover:bg-hover'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                        <button
                          type="button"
                          title="한 줄 전체"
                          onClick={() => toggleAll(role.key, s.key)}
                          className="ml-0.5 text-[11px] text-text-faint hover:text-primary"
                        >
                          ↔
                        </button>
                      </div>
                    </td>
                  );
                })}
                <td className={`${tdCls} text-[12px] text-text-sub`}>{s.memo ?? ''}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={roles.length + 3} className="py-10 text-center text-[13px] text-text-faint">
                  조건에 맞는 화면이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[12px] leading-relaxed text-text-faint">
        값은 「WB manager 사용권한 체크목록」(2026-09-19)의 본표를 그대로 넣어 둔 것입니다. 여기서 고치면 배포 없이 바로 바뀝니다.
        계층이 정해지지 않은 계정은 지금까지처럼 모든 화면이 보입니다 — 사용자 승인 관리에서 계층을 지정해 주세요.
      </p>
    </div>
  );
}
