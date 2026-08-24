import {
  Truck,
  Recycle,
  PackageMinus,
  Trash2,
  ListTree,
  BarChart3,
  FileText,
  FileArchive,
  Boxes,
  Layers,
  TrendingUp,
  ShieldAlert,
  BellRing,
  Users,
  Settings,
  FolderOpen,
  Scale,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface Area {
  /** 그룹과 별개로 사이드바 맨 아래에 고정하는 메뉴 — 영역을 오가지 않고 닿아야 하는 것들 */
  pinned?: NavItem[];
  id: string;
  acronym: string;
  title: string;
  summary: string;
  icon: LucideIcon;
  accent: string;
  adminOnly?: boolean;
  ready?: boolean;
  groups: NavGroup[];
}

// 시작 화면의 카드와 사이드바 메뉴는 같은 정의를 쓴다.
// 영역을 늘리려면 여기에 한 덩이만 추가하면 카드와 메뉴가 함께 따라온다.
export const AREAS: Area[] = [
  {
    id: 'scrap',
    acronym: 'SWMS',
    title: '스크랩 · 폐기물 관리',
    summary: '계근 등록부터 재고·손익, 올바로 신고까지',
    icon: Scale,
    accent: '#3884ff',
    ready: true,
    groups: [
      {
        label: '입출고',
        items: [
          { to: '/inbound', label: '입고 현황', icon: Truck },
          { to: '/waste-inbound', label: '폐기물 수집·운반 현황', icon: Recycle },
          { to: '/outbound', label: '출고 현황', icon: PackageMinus },
          { to: '/waste-outbound', label: '폐기물 반출 현황', icon: Trash2 },
        ],
      },
      {
        label: '보고 / 평가 / 집계',
        items: [
          { to: '/ledger', label: '통합 원장 조회', icon: ListTree },
          { to: '/aggregation', label: '자동집계 현황', icon: BarChart3 },
          { to: '/inventory', label: '재고 / 재고평가', icon: Boxes },
          { to: '/transports', label: '운반비 관리', icon: Truck },
          { to: '/labors', label: '공수표 관리', icon: Users },
          { to: '/pnl', label: '손익보고서', icon: TrendingUp },
          { to: '/daily-report', label: '출고보고서', icon: FileText },
        ],
      },
    ],
    pinned: [{ to: '/reports', label: '보고서 보관함', icon: FileArchive }],
  },
  {
    id: 'dms',
    acronym: 'DMS',
    title: '문서 관리',
    summary: '계약·증빙 문서를 분류 트리로 모아 관리',
    icon: FolderOpen,
    accent: '#a78bfa',
    ready: true,
    groups: [
      {
        label: '문서',
        items: [{ to: '/dms', label: '문서 관리', icon: FolderOpen }],
      },
    ],
    pinned: [{ to: '/reports', label: '보고서 보관함', icon: FileArchive }],
  },
  {
    id: 'assets',
    acronym: 'AMS',
    title: '관리항목',
    summary: '프로젝트·폐기물·알림, 차량·장비 자산',
    icon: ClipboardList,
    accent: '#22c55e',
    ready: true,
    groups: [
      {
        label: '현장 관리',
        items: [
          { to: '/projects', label: '프로젝트 관리', icon: Layers },
          { to: '/waste', label: '폐기물 / 올바로 관리', icon: ShieldAlert },
          { to: '/admin-alerts', label: '알림 현황', icon: BellRing },
        ],
      },
      {
        label: '자산',
        items: [{ to: '/assets', label: '자산 관리 (차량·장비)', icon: Boxes }],
      },
    ],
  },
  {
    id: 'hr',
    acronym: 'HRM',
    title: '임직원 관리',
    summary: '임직원 정보와 자격·교육 이력',
    icon: Users,
    accent: '#8b5cf6',
    ready: true,
    groups: [
      {
        label: '임직원',
        items: [{ to: '/employees', label: '임직원 관리', icon: Users }],
      },
    ],
  },
  {
    id: 'system',
    acronym: 'SYS',
    title: '시스템 관리',
    summary: '기준정보·마스터·사용자 승인·접속 이력',
    icon: Settings,
    accent: '#f59e0b',
    adminOnly: true,
    ready: true,
    groups: [
      {
        label: '시스템',
        items: [{ to: '/system', label: '시스템 관리', icon: Settings }],
      },
    ],
  },
];

// 지금 보고 있는 화면이 어느 영역에 속하는지 경로로 되짚는다.
export function areaOfPath(pathname: string): Area | undefined {
  return AREAS.find((a) => a.groups.some((g) => g.items.some((i) => i.to === pathname)));
}

export const findArea = (id: string | null) => AREAS.find((a) => a.id === id);
