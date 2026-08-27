import { useEffect, useState } from 'react';
import { ShieldCheck, KeyRound } from 'lucide-react';
import { api } from '../api/client';
import { Badge, type BadgeTone } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';
import { useEmployees } from '../hooks/useMasters';
import { pageTitleCls, tableWrapCls, thCls, tdCls, trCls, outlineBtnCls } from '../components/ui/classes';
import { kstStamp } from '../lib/datetime';
import type { AppUser } from '../context/AuthContext';

const STATUS_LABEL: Record<string, string> = { pending: '대기중', approved: '승인됨', rejected: '거절됨' };
const STATUS_TONE: Record<string, BadgeTone> = { pending: 'amber', approved: 'green', rejected: 'red' };

export function UserApprovalPage({ embedded = false }: { embedded?: boolean }) {
  const { resetPassword } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const { employees } = useEmployees();

  const load = () => {
    api.get<AppUser[]>('/api/auth/users').then(setUsers);
  };

  useEffect(() => {
    load();
  }, []);

  const setStatus = async (id: string, status: string) => {
    await api.patch(`/api/auth/users/${id}/status`, { status });
    load();
  };

  // 현장에서 로그인이 막혔을 때 관리자가 바로 재설정 메일을 보낸다.
  const sendReset = async (email?: string | null) => {
    if (!email) return;
    if (!window.confirm(`${email} 주소로 비밀번호 재설정 메일을 보낼까요?`)) return;
    try {
      await resetPassword(email);
      window.alert('재설정 메일을 보냈습니다.');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '메일을 보내지 못했습니다.');
    }
  };

  // 모바일 출퇴근은 이 연결을 보고 "누가 찍었는지"를 정한다. 연결이 없으면 찍을 수 없다.
  const setEmployee = async (id: string, employeeId: string) => {
    await api.patch(`/api/auth/users/${id}/employee`, { employeeId: employeeId || null });
    load();
  };

  const setRole = async (id: string, role: string) => {
    await api.patch(`/api/auth/users/${id}/role`, { role });
    load();
  };

  return (
    <div>
      {!embedded && (
        <div className="mb-5 flex items-center gap-2">
          <ShieldCheck size={20} className="text-primary" />
          <h1 className={pageTitleCls}>사용자 승인 관리</h1>
        </div>
      )}

      <div className={tableWrapCls}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-border">
              <th className={thCls}>이름</th>
              <th className={thCls}>연락처</th>
              <th className={thCls}>이메일</th>
              <th className={thCls}>임직원 연결</th>
              <th className={thCls}>역할</th>
              <th className={thCls}>상태</th>
              <th className={thCls}>최종 접속</th>
              <th className={thCls}>접속 IP</th>
              <th className={thCls}>작업</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={trCls}>
                <td className={tdCls}>{u.name ?? '-'}</td>
                <td className={`${tdCls} tabular whitespace-nowrap`}>{u.phone ?? '-'}</td>
                <td className={tdCls}>{u.email}</td>
                <td className={tdCls}>
                  <select
                    value={u.employeeId ?? ''}
                    onChange={(e) => setEmployee(u.id, e.target.value)}
                    title="모바일 출퇴근에서 이 계정이 누구로 찍히는지"
                    className="rounded-[6px] border border-border bg-input px-2 py-1 text-[12.5px] text-input-text"
                  >
                    <option value="">연결 없음</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                        {e.department ? ` (${e.department})` : ''}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={tdCls}>
                  <select
                    value={u.role}
                    onChange={(e) => setRole(u.id, e.target.value)}
                    className="rounded-[6px] border border-border bg-input px-2 py-1 text-[12.5px] text-input-text"
                  >
                    <option value="worker">업무 담당자</option>
                    <option value="admin">관리자</option>
                  </select>
                </td>
                <td className={tdCls}>
                  <Badge tone={STATUS_TONE[u.status]}>{STATUS_LABEL[u.status]}</Badge>
                </td>
                <td className={`${tdCls} tabular whitespace-nowrap`}>
                  {u.lastLoginAt ? `${kstStamp(u.lastLoginAt)} (${u.loginCount ?? 0}회)` : '접속 기록 없음'}
                </td>
                <td className={`${tdCls} tabular whitespace-nowrap`}>{u.lastLoginIp ?? '-'}</td>
                <td className={tdCls}>
                  <div className="flex gap-1.5">
                    {u.status !== 'approved' && (
                      <button type="button" onClick={() => setStatus(u.id, 'approved')} className={outlineBtnCls}>
                        승인
                      </button>
                    )}
                    {u.status !== 'rejected' && (
                      <button type="button" onClick={() => setStatus(u.id, 'rejected')} className={outlineBtnCls}>
                        거절
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => sendReset(u.email)}
                      title="비밀번호 재설정 메일 발송"
                      className={outlineBtnCls}
                    >
                      <KeyRound size={14} /> 비밀번호 재설정
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={9} className="py-10 text-center text-[13px] text-text-faint">
                  가입 신청자가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
