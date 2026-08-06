import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { api } from '../api/client';
import { Badge, type BadgeTone } from '../components/ui/Badge';
import { pageTitleCls, tableWrapCls, thCls, tdCls, trCls, outlineBtnCls } from '../components/ui/classes';
import { kstStamp } from '../lib/datetime';
import type { AppUser } from '../context/AuthContext';

const STATUS_LABEL: Record<string, string> = { pending: '대기중', approved: '승인됨', rejected: '거절됨' };
const STATUS_TONE: Record<string, BadgeTone> = { pending: 'amber', approved: 'green', rejected: 'red' };

export function UserApprovalPage({ embedded = false }: { embedded?: boolean }) {
  const [users, setUsers] = useState<AppUser[]>([]);

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
                <td className={`${tdCls} tabular whitespace-nowrap`}>
                  {u.lastLoginAt ? `${kstStamp(u.lastLoginAt)} (${u.loginCount ?? 0}회)` : '접속 기록 없음'}
                </td>
                <td className={`${tdCls} tabular whitespace-nowrap`}>{u.lastLoginIp ?? '-'}</td>
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
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-[13px] text-text-faint">
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
