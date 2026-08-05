import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MasterManagementPage } from './MasterManagementPage';
import { CommonCodePage } from './CommonCodePage';
import { EmployeeManagementPage } from './EmployeeManagementPage';
import { VehicleManagementPage } from './VehicleManagementPage';
import { UserApprovalPage } from './UserApprovalPage';
import { pageTitleCls } from '../components/ui/classes';

type Tab = 'codes' | 'masters' | 'employees' | 'vehicles' | 'users';

function initialTab(param: string | null, isAdmin: boolean): Tab {
  if (param === 'codes') return 'codes';
  if (param === 'employees') return 'employees';
  if (param === 'vehicles') return 'vehicles';
  if (param === 'users' && isAdmin) return 'users';
  return 'masters';
}

export function SystemAdminPage() {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === 'admin';
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(initialTab(searchParams.get('tab'), isAdmin));

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <Settings size={20} className="text-primary" />
        <h1 className={pageTitleCls}>시스템 관리</h1>
      </div>

      <div className="mb-5 flex gap-1 border-b border-border">
        <TabButton active={tab === 'codes'} onClick={() => setTab('codes')}>
          공통코드 관리
        </TabButton>
        <TabButton active={tab === 'masters'} onClick={() => setTab('masters')}>
          마스터 관리
        </TabButton>
        <TabButton active={tab === 'employees'} onClick={() => setTab('employees')}>
          임직원 관리
        </TabButton>
        <TabButton active={tab === 'vehicles'} onClick={() => setTab('vehicles')}>
          차량/장비 관리
        </TabButton>
        {isAdmin && (
          <TabButton active={tab === 'users'} onClick={() => setTab('users')}>
            사용자 승인 관리
          </TabButton>
        )}
      </div>

      {tab === 'codes' ? (
        <CommonCodePage embedded />
      ) : tab === 'employees' ? (
        <EmployeeManagementPage embedded />
      ) : tab === 'vehicles' ? (
        <VehicleManagementPage embedded />
      ) : tab === 'users' && isAdmin ? (
        <UserApprovalPage embedded />
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
