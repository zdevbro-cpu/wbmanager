import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LogOut, Grid2x2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AREAS, areaOfPath } from '../lib/areas';


export function Layout() {
  const location = useLocation();
  const { appUser, logout } = useAuth();
  const isAdmin = appUser?.role === 'admin';
  // 시작 화면에서 고른 영역의 메뉴만 띄운다. 경로로 되짚어 새로고침해도 유지된다.
  const area = areaOfPath(location.pathname) ?? AREAS[0];
  const navGroups = area.groups;
  const allItems = AREAS.flatMap((a) => a.groups).flatMap((g) => g.items);
  const current = allItems.find((i) => i.to === location.pathname);

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="sticky top-0 flex h-screen w-[236px] shrink-0 flex-col bg-sidebar">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-primary text-sm font-extrabold text-white">
            W
          </div>
          <div>
            <div className="text-[15px] font-extrabold text-text-strong">wbmanager</div>
            <div className="text-[11px] text-[#5f7ba6]">{area.title}</div>
          </div>
        </div>

        {/* 다른 영역으로 옮길 때는 시작 화면으로 돌아간다. */}
        <NavLink
          to="/"
          className="mx-3 mb-3 flex items-center gap-2 rounded-[9px] border border-border-top px-2.5 py-2 text-[12.5px] font-semibold text-[#9fb3d1] no-underline hover:bg-nav-hover hover:text-text-strong"
        >
          <Grid2x2 size={15} /> 업무 영역 변경
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
            wbmanager <span className="mx-1 text-text-faint">/</span>{' '}
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
