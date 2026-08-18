import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MasterManagementPage } from './MasterManagementPage';
import { UserApprovalPage } from './UserApprovalPage';
import { AuditLogPage } from './AuditLogPage';
import { pageTitleCls } from '../components/ui/classes';

type Tab = 'masters' | 'users' | 'audit';

function initialTab(param: string | null, isAdmin: boolean): Tab {
  if (param === 'users' && isAdmin) return 'users';
  if (param === 'audit' && isAdmin) return 'audit';
  return 'masters';
}

export function SystemAdminPage() {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === 'admin';
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(initialTab(searchParams.get('tab'), isAdmin));

  // 차량/장비 관리는 사이드바 메뉴로 옮겼다. 기존 링크는 그쪽으로 넘긴다.
  if (searchParams.get('tab') === 'vehicles') return <Navigate to="/vehicles" replace />;
  if (searchParams.get('tab') === 'employees') return <Navigate to="/employees" replace />;

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <Settings size={20} className="text-primary" />
        <h1 className={pageTitleCls}>시스템 관리</h1>
      </div>

      <div className="mb-5 flex gap-1 border-b border-border">
        <TabButton active={tab === 'masters'} onClick={() => setTab('masters')}>
          마스터 관리
        </TabButton>
        {isAdmin && (
          <TabButton active={tab === 'users'} onClick={() => setTab('users')}>
            사용자 승인 관리
          </TabButton>
        )}
        {isAdmin && (
          <TabButton active={tab === 'audit'} onClick={() => setTab('audit')}>
            접속·변경 이력
          </TabButton>
        )}
      </div>

      {tab === 'users' && isAdmin ? (
        <UserApprovalPage embedded />
      ) : tab === 'audit' && isAdmin ? (
        <AuditLogPage embedded />
      ) : (
        <MasterManagementPage embedded />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        '-mb-px border-b-2 px-4 py-2 text-[14px] font-bold transition-colors',
        active ? 'border-primary text-text-strong' : 'border-transparent text-text-sub hover:text-text-strong',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
