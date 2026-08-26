import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AREAS, areaOfPath, findArea } from '../lib/areas';


export function Layout() {
  const location = useLocation();
  const { appUser, logout } = useAuth();
  const isAdmin = appUser?.role === 'admin';
  // 시작 화면에서 고른 영역의 메뉴만 띄운다.
  // 보고서 보관함처럼 여러 영역이 공유하는 화면은 경로만으로 영역을 알 수 없어,
  // 마지막에 머문 영역을 기억해 두고 경로는 보조 수단으로 쓴다.
  const byPath = areaOfPath(location.pathname);
  const [areaId, setAreaId] = useState(() => byPath?.id ?? localStorage.getItem('wb.area') ?? AREAS[0].id);

  useEffect(() => {
    if (byPath && byPath.id !== areaId) {
      setAreaId(byPath.id);
      localStorage.setItem('wb.area', byPath.id);
    }
  }, [byPath, areaId]);

  const area = findArea(areaId) ?? AREAS[0];
  const navGroups = area.groups;
  const allItems = [
    ...AREAS.flatMap((a) => a.groups).flatMap((g) => g.items),
    ...AREAS.flatMap((a) => a.pinned ?? []),
  ];
  const current = allItems.find((i) => i.to === location.pathname);

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="sticky top-0 flex h-screen w-[236px] shrink-0 flex-col bg-sidebar">
        {/* 이름을 누르면 시작 화면으로 돌아가 다른 업무 영역을 고른다. */}
        <NavLink
          to="/"
          title="업무 영역 변경"
          className="flex h-[60px] shrink-0 items-center gap-2 px-7 no-underline"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-primary text-sm font-extrabold text-white">
            W
          </div>
          <div>
            <div className="text-[15px] font-extrabold text-text-strong">WB manager</div>
            <div className="text-[11px] text-[#5f7ba6]">{area.title}</div>
          </div>
        </NavLink>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-4">
              <div className="mb-1.5 px-2 text-[10.5px] font-bold uppercase tracking-[1px] text-[#3f5983]">
                {group.label}
              </div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      'mb-0.5 flex items-center gap-2.5 rounded-[9px] border-l-[3px] px-2.5 py-2 text-[13.5px] font-semibold no-underline',
                      isActive
                        ? 'border-accent bg-nav-active text-text-strong'
                        : 'border-transparent text-[#9fb3d1] hover:bg-nav-hover',
                    ].join(' ')
                  }
                >
                  <item.icon size={16} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* 영역을 오가지 않고 닿아야 하는 메뉴 — 계정 줄 바로 위에 고정한다. */}
        {area.pinned?.length ? (
          <div className="border-t border-border-top px-3 py-2">
            {area.pinned.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-2.5 rounded-[9px] border-l-[3px] px-2.5 py-2 text-[13.5px] font-semibold no-underline',
                    isActive
                      ? 'border-accent bg-nav-active text-text-strong'
                      : 'border-transparent text-[#9fb3d1] hover:bg-nav-hover',
                  ].join(' ')
                }
              >
                <item.icon size={16} />
                {item.label}
              </NavLink>
            ))}
          </div>
        ) : null}

        {/* 어느 계정으로 들어와 있는지 화면을 옮겨도 계속 보이도록 사이드바 하단에 둔다. */}
        <div className="flex items-center gap-2 border-t border-border-top px-4 py-3">
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[#9fb3d1]" title={appUser?.email ?? ''}>
            {appUser?.email ?? '-'}
          </span>
          <button
            type="button"
            onClick={() => logout()}
            title="로그아웃"
            aria-label="로그아웃"
            className="shrink-0 text-[#9fb3d1] hover:text-text-strong"
          >
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-[60px] items-center justify-between border-b border-border-top bg-sidebar px-7">
          <div className="text-[14px] font-semibold text-text-sub">
            WB manager <span className="mx-1 text-text-faint">/</span>{' '}
            <span className="text-text-strong">{current?.label ?? ''}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-[12.5px] text-text-faint">
              {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div className="h-4 w-px bg-border-top" />
            <div className="text-[12.5px] text-text-sub">
              {appUser?.name ?? appUser?.email} {isAdmin && <span className="text-primary">(관리자)</span>}
            </div>
            <button
              type="button"
              onClick={() => logout()}
              className="flex items-center gap-1 text-[12.5px] font-semibold text-text-sub hover:text-text-strong"
            >
              <LogOut size={14} /> 로그아웃
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-7 pt-6 pb-12">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
