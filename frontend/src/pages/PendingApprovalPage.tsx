import { Clock3, LogOut, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { outlineBtnCls } from '../components/ui/classes';

export function PendingApprovalPage() {
  const { appUser, logout, refreshAppUser } = useAuth();
  const rejected = appUser?.status === 'rejected';

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <div className="w-[380px] rounded-[14px] border border-border bg-card p-8 text-center">
        {rejected ? <XCircle size={36} className="mx-auto mb-4 text-danger" /> : <Clock3 size={36} className="mx-auto mb-4 text-warning" />}
        <h1 className="mb-2 text-[17px] font-extrabold text-text-strong">
          {rejected ? '가입이 거절되었습니다' : '관리자 승인 대기 중'}
        </h1>
        <p className="mb-6 text-[13px] text-text-sub">
          {rejected
            ? '관리자에게 문의해주세요.'
            : `${appUser?.email ?? ''} 계정으로 가입 신청이 접수되었습니다. 관리자 승인 후 이용하실 수 있습니다.`}
        </p>
        <div className="flex justify-center gap-2">
          <button type="button" onClick={() => refreshAppUser()} className={outlineBtnCls}>
            승인 상태 새로고침
          </button>
          <button type="button" onClick={() => logout()} className={outlineBtnCls}>
            <LogOut size={15} /> 로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}
