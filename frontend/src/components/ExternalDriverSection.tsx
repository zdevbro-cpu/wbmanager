import { useCallback, useEffect, useState } from 'react';
import { UserRound, Check, X, Pencil, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { formatPhone } from '../lib/phone';
import { sectionTitleCls, inputCls, tableWrapCls, thCls, tdCls, trCls } from './ui/classes';

interface ExternalDriver {
  id: string;
  name: string;
  phone?: string | null;
  memo?: string | null;
  createdAt?: string;
}

// 외부 운전자 — 계근 등록에서 이름을 직접 적으면 이 목록에 쌓인다.
// 지금까지는 드롭다운에만 나오고 고치거나 지울 자리가 없었다. 오타로 들어간 이름과
// 바뀐 연락처를 여기서 정리한다.
export function ExternalDriverSection() {
  const [rows, setRows] = useState<ExternalDriver[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [memo, setMemo] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get<ExternalDriver[]>('/api/external-drivers').then(setRows);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = (d: ExternalDriver) => {
    setEditing(d.id);
    setName(d.name);
    setPhone(d.phone ?? '');
    setMemo(d.memo ?? '');
    setError('');
  };

  const save = async (id: string) => {
    if (!name.trim()) {
      setError('이름을 입력하세요.');
      return;
    }
    try {
      await api.patch(`/api/external-drivers/${id}`, { name: name.trim(), phone, memo });
      setEditing(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '수정에 실패했습니다.');
    }
  };

  const remove = async (d: ExternalDriver) => {
    if (!window.confirm(`'${d.name}' 기사를 목록에서 지울까요?\n이미 등록된 계근 기록은 그대로 남습니다.`)) return;
    try {
      await api.del(`/api/external-drivers/${d.id}`);
      load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <UserRound size={16} className="text-primary" />
        <h2 className={`${sectionTitleCls} text-[15px]`}>운전자</h2>
        <span className="text-[13px] text-text-sub">{rows.length}명</span>
      </div>
      <p className="mb-4 text-[13px] text-text-sub">
        계근 등록에서 운전자 이름을 직접 적으면 이곳에 쌓입니다. 임직원과 같은 이름은 담지 않습니다. 이름이나 연락처가
        잘못 들어갔으면 여기서 고치거나 지웁니다.
      </p>

      {error && <p className="mb-2 text-[12.5px] text-danger">{error}</p>}

      <div className={tableWrapCls}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-border">
              <th className={`${thCls} w-[52px]`}>번호</th>
              <th className={thCls}>이름</th>
              <th className={thCls}>연락처</th>
              <th className={thCls}>비고</th>
              <th className={thCls}>등록일</th>
              <th className={thCls}>관리</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d, i) => (
              <tr key={d.id} className={trCls}>
                <td className={`${tdCls} tabular text-text-faint`}>{i + 1}</td>
                <td className={`${tdCls} whitespace-nowrap`}>
                  {editing === d.id ? (
                    <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} h-8 w-[130px] px-2`} />
                  ) : (
                    d.name
                  )}
                </td>
                <td className={`${tdCls} tabular whitespace-nowrap`}>
                  {editing === d.id ? (
                    <input
                      value={phone}
                      onChange={(e) => setPhone(formatPhone(e.target.value))}
                      placeholder="010-0000-0000"
                      className={`${inputCls} h-8 w-[150px] px-2`}
                    />
                  ) : (
                    (d.phone ?? '-')
                  )}
                </td>
                <td className={tdCls}>
                  {editing === d.id ? (
                    <input value={memo} onChange={(e) => setMemo(e.target.value)} className={`${inputCls} h-8 px-2`} />
                  ) : (
                    (d.memo ?? '-')
                  )}
                </td>
                <td className={`${tdCls} tabular whitespace-nowrap`}>{d.createdAt?.slice(0, 10) ?? '-'}</td>
                <td className={tdCls}>
                  <div className="flex items-center gap-1.5">
                    {editing === d.id ? (
                      <>
                        <button
                          type="button"
                          title="저장"
                          onClick={() => save(d.id)}
                          className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-primary"
                        >
                          <Check size={15} />
                        </button>
                        <button
                          type="button"
                          title="취소"
                          onClick={() => setEditing(null)}
                          className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-danger"
                        >
                          <X size={15} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          title="이름·연락처 수정"
                          onClick={() => startEdit(d)}
                          className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-text-strong"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          title="삭제"
                          onClick={() => remove(d)}
                          className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-danger"
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-[13px] text-text-faint">
                  계근 등록에서 직접 입력된 운전자가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
