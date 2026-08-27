import { useEffect, useState } from 'react';
import { ShieldCheck, KeyRound } from 'lucide-react';
import { api } from '../api/client';
import { Badge, type BadgeTone } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';
import { useEmployees } from '../hooks/useMasters';
import { FormModal } from '../components/FormModal';
import { NumberInput } from '../components/ui/NumberInput';
import { EMPLOYMENT_TYPES } from './EmployeeManagementPage';
import type { Employee } from '../types';
import { pageTitleCls, tableWrapCls, thCls, tdCls, trCls, outlineBtnCls, primaryBtnCls, inputCls } from '../components/ui/classes';
import { kstStamp } from '../lib/datetime';
import type { AppUser } from '../context/AuthContext';

const STATUS_LABEL: Record<string, string> = { pending: '대기중', approved: '승인됨', rejected: '거절됨' };
const STATUS_TONE: Record<string, BadgeTone> = { pending: 'amber', approved: 'green', rejected: 'red' };

export function UserApprovalPage({ embedded = false }: { embedded?: boolean }) {
  const { resetPassword } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const { employees, reload: reloadEmployees } = useEmployees();

  const load = () => {
    api.get<AppUser[]>('/api/auth/users').then(setUsers);
  };

  useEffect(() => {
    load();
  }, []);

  // 승인은 그 자리에서 "이 사람이 누구이고 어떤 구분인지"를 정하고 넘어간다.
  const [approving, setApproving] = useState<AppUser | null>(null);

  const setStatus = async (id: string, status: string, extra?: { employeeId?: string; employmentType?: string; unitCost?: string; mealCost?: string; etcCost?: string }) => {
    await api.patch(`/api/auth/users/${id}/status`, { status, ...extra });
    // 승인은 임직원을 새로 만들 수 있다. 목록을 다시 읽어야 연결이 화면에 보인다.
    reloadEmployees();
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

  // 임직원 기록이 아직 없는 사람 — 계정 정보로 한 명 만들어 잇는다.
  const makeEmployee = async (u: AppUser) => {
    if (!window.confirm(`${u.name ?? u.email} 님을 임직원으로 등록하고 이 계정에 연결할까요?
고용 구분은 임직원 관리에서 확인해 주세요.`)) return;
    try {
      await api.post(`/api/auth/users/${u.id}/employee`);
      reloadEmployees();
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '연결하지 못했습니다.');
    }
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
                  {!u.employeeId && (
                    <button
                      type="button"
                      onClick={() => makeEmployee(u)}
                      title="계정 정보로 임직원을 만들어 연결합니다"
                      className="ml-1.5 text-[12px] font-bold text-primary underline"
                    >
                      임직원 등록
                    </button>
                  )}
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
                      <button type="button" onClick={() => setApproving(u)} className={outlineBtnCls}>
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

      {approving && (
        <ApproveModal
          user={approving}
          employees={employees}
          onClose={() => setApproving(null)}
          onDone={async (extra) => {
            await setStatus(approving.id, 'approved', extra);
            setApproving(null);
          }}
        />
      )}
    </div>
  );
}

// 승인은 들여보내는 결정이자 "이 사람이 누구인지" 정하는 자리다.
// 여기서 정하지 않으면 고용 구분이 기본값으로 굳고, 공수표가 그 값으로 갈린다.
function ApproveModal({
  user,
  employees,
  onClose,
  onDone,
}: {
  user: AppUser;
  employees: Employee[];
  onClose: () => void;
  onDone: (extra: { employeeId?: string; employmentType?: string; unitCost?: string; mealCost?: string; etcCost?: string }) => Promise<void>;
}) {
  const sameName = employees.find((e) => e.name === (user.name ?? '').trim());
  const [employeeId, setEmployeeId] = useState(sameName?.id ?? '');
  const [employmentType, setEmploymentType] = useState(sameName?.employmentType ?? '정규직');
  // 정규직 외 인원은 품값을 여기서 한 번에 정한다 — 공수표에서 매번 단가를 다시 적지 않게 한다.
  const [unitCost, setUnitCost] = useState(sameName?.unitCost ?? '');
  const [mealCost, setMealCost] = useState(sameName?.mealCost ?? '');
  const [etcCost, setEtcCost] = useState(sameName?.etcCost ?? '');
  const [busy, setBusy] = useState(false);
  const paid = employmentType !== '정규직';

  const picked = employees.find((e) => e.id === employeeId);

  return (
    <FormModal title="가입 승인" icon={ShieldCheck} onClose={onClose}>
      <div className="rounded-[10px] border border-border bg-input p-4">
        <p className="mb-3 text-[13px] text-text-sub">
          <b className="text-text-strong">{user.name ?? '-'}</b> · {user.email}
          {user.phone ? ` · ${user.phone}` : ''}
        </p>

        <label className={approveLabelCls}>임직원</label>
        <select
          value={employeeId}
          onChange={(e) => {
            setEmployeeId(e.target.value);
            const emp = employees.find((x) => x.id === e.target.value);
            if (emp?.employmentType) setEmploymentType(emp.employmentType);
            if (emp) {
              setUnitCost(emp.unitCost ?? '');
              setMealCost(emp.mealCost ?? '');
              setEtcCost(emp.etcCost ?? '');
            }
          }}
          className={`${inputCls} mb-1`}
        >
          <option value="">새로 등록 (이름·연락처로 만듭니다)</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
              {e.department ? ` (${e.department})` : ''}
            </option>
          ))}
        </select>
        <p className="mb-3 text-[12px] text-text-faint">
          {picked ? `${picked.name} 님으로 연결합니다.` : '같은 사람이 이미 있으면 위에서 고르세요. 없으면 새로 만듭니다.'}
        </p>

        <label className={approveLabelCls}>고용 구분</label>
        <div className="flex flex-wrap gap-1.5">
          {EMPLOYMENT_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setEmploymentType(t)}
              className={`rounded-[8px] border px-3 py-1.5 text-[13px] font-semibold ${
                employmentType === t ? 'border-primary bg-primary/15 text-primary' : 'border-border text-text-sub hover:bg-hover'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-text-faint">
          공수표가 이 값으로 갈립니다 — 정규직은 근태(출근·연차 등), 그 밖은 공수로 셉니다.
        </p>

        {paid && (
          <div className="mt-4 border-t border-border pt-3">
            <label className={approveLabelCls}>품값 기준</label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="mb-1 block text-[12px] text-text-faint">1공수 단가(원)</span>
                <NumberInput value={unitCost} onChange={setUnitCost} />
              </div>
              <div>
                <span className="mb-1 block text-[12px] text-text-faint">하루 식대(원)</span>
                <NumberInput value={mealCost} onChange={setMealCost} />
              </div>
              <div>
                <span className="mb-1 block text-[12px] text-text-faint">하루 기타비용(원)</span>
                <NumberInput value={etcCost} onChange={setEtcCost} />
              </div>
            </div>
            <p className="mt-2 text-[12px] text-text-faint">
              여기서 한 번 적어 두면 공수표는 날짜와 공수만 고르면 됩니다. 그날 사정이 다르면 공수표에서 고칠 수 있습니다.
            </p>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
          <button type="button" onClick={onClose} className={outlineBtnCls}>
            취소
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onDone({
                  employeeId: employeeId || undefined,
                  employmentType,
                  ...(paid ? { unitCost, mealCost, etcCost } : {}),
                });
              } finally {
                setBusy(false);
              }
            }}
            className={primaryBtnCls}
          >
            {busy ? '승인 중...' : '승인'}
          </button>
        </div>
      </div>
    </FormModal>
  );
}

const approveLabelCls = 'mb-1.5 block text-[13px] font-semibold text-text-mid';
