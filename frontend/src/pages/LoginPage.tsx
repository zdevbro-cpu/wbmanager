import { useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { inputCls, primaryBtnCls } from '../components/ui/classes';

export function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <div className="w-[360px] rounded-[14px] border border-border bg-card p-7">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-primary text-sm font-extrabold text-white">
            W
          </div>
          <div>
            <div className="text-[16px] font-extrabold text-text-strong">wbmanager</div>
            <div className="text-[11px] text-text-faint">원방 스크랩 업무지원</div>
          </div>
        </div>

        <div className="mb-5 flex rounded-[9px] border border-border p-0.5">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 rounded-[7px] py-1.5 text-[13px] font-bold ${
              mode === 'login' ? 'bg-primary text-white' : 'text-text-sub'
            }`}
          >
            로그인
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`flex-1 rounded-[7px] py-1.5 text-[13px] font-bold ${
              mode === 'register' ? 'bg-primary text-white' : 'text-text-sub'
            }`}
          >
            가입 신청
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'register' && (
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">이름</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">이메일</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className={inputCls}
            />
          </div>

          {error && <p className="text-[12.5px] text-danger">{error}</p>}

          <button type="submit" disabled={submitting} className={`${primaryBtnCls} w-full justify-center`}>
            {mode === 'login' ? <LogIn size={15} /> : <UserPlus size={15} />}
            {mode === 'login' ? '로그인' : '가입 신청'}
          </button>
        </form>

        {mode === 'register' && (
          <p className="mt-4 text-[12px] text-text-faint">
            가입 신청 후 관리자 승인이 완료되어야 시스템을 사용할 수 있습니다.
          </p>
        )}
      </div>
    </div>
  );
}
