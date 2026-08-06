import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Truck,
  Recycle,
  PackageMinus,
  Trash2,
  ListTree,
  BarChart3,
  FileText,
  FileArchive,
  FileSpreadsheet,
  Boxes,
  Layers,
  Wrench,
  TrendingUp,
  ShieldAlert,
  BellRing,
  Users,
  Settings,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: '입출고',
    items: [
      { to: '/inbound', label: '입고 현황', icon: Truck },
      { to: '/waste-inbound', label: '폐기물 입고 현황', icon: Recycle },
      { to: '/outbound', label: '출고 현황', icon: PackageMinus },
      { to: '/waste-outbound', label: '폐기물 반출 현황', icon: Trash2 },
    ],
  },
  {
    label: '보고 / 집계',
    items: [
      { to: '/ledger', label: '통합 원장 조회', icon: ListTree },
      { to: '/aggregation', label: '자동집계 현황', icon: BarChart3 },
      { to: '/daily-report', label: '일일 출고보고', icon: FileText },
      { to: '/reports', label: '보고서 보관함', icon: FileArchive },
      { to: '/ecount-export', label: 'ecount 내보내기', icon: FileSpreadsheet },
    ],
  },
  {
    label: '재고 / 손익',
    items: [
      { to: '/inventory', label: '재고 / 재고평가', icon: Boxes },
      { to: '/pnl', label: '프로젝트 손익요약', icon: TrendingUp },
    ],
  },
  {
    label: '관리',
    items: [
      { to: '/projects', label: '프로젝트 관리', icon: Layers },
      { to: '/waste', label: '폐기물 / 올바로 관리', icon: ShieldAlert },
      { to: '/assets', label: '자산 관리 (차량·장비)', icon: Boxes },
      { to: '/maintenances', label: '정비 현황', icon: Wrench },
      { to: '/employees', label: '임직원 관리', icon: Users },
      { to: '/admin-alerts', label: '알림 현황', icon: BellRing },
    ],
  },
  {
    label: '시스템',
    items: [{ to: '/system', label: '시스템 관리', icon: Settings }],
  },
];

export function Layout() {
  const location = useLocation();
  const { appUser, logout } = useAuth();
  const isAdmin = appUser?.role === 'admin';
  const navGroups = NAV_GROUPS;
  const allItems = navGroups.flatMap((g) => g.items);
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
            <div className="text-[11px] text-[#5f7ba6]">원방 스크랩 업무지원</div>
          </div>
        </div>

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
