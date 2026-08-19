import { useState } from 'react';
import { LogIn, UserPlus, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatPhone } from '../lib/phone';
import { inputCls, primaryBtnCls } from '../components/ui/classes';

export function LoginPage() {
  const { login, register, resetPassword } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else if (mode === 'reset') {
        // 가입되지 않은 주소여도 같은 안내를 보여 준다 — 어떤 주소가 있는지 알려주지 않기 위해서다.
        await resetPassword(email);
        setNotice('비밀번호 재설정 메일을 보냈습니다. 메일함을 확인하세요.');
      } else {
        await register(email, password, name, phone);
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
            onClick={() => {
              setMode('login');
              setNotice('');
              setError('');
            }}
            className={`flex-1 rounded-[7px] py-1.5 text-[13px] font-bold ${
              mode === 'login' ? 'bg-primary text-white' : 'text-text-sub'
            }`}
          >
            로그인
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setNotice('');
              setError('');
            }}
            className={`flex-1 rounded-[7px] py-1.5 text-[13px] font-bold ${
              mode === 'register' ? 'bg-primary text-white' : 'text-text-sub'
            }`}
          >
            가입 신청
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'register' && (
            <>
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">이름</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">연락처</label>
                {/* 승인 담당자가 신청자 본인 확인·연락에 쓴다. 하이픈은 자동으로 붙는다. */}
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="010-0000-0000"
                  required
                  className={inputCls}
                />
              </div>
            </>
          )}
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">이메일</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} />
          </div>
          {mode !== 'reset' && (
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
          )}

          {mode === 'reset' && (
            <p className="text-[12.5px] text-text-sub">
              가입한 이메일로 재설정 링크를 보냅니다. 메일의 링크에서 새 비밀번호를 정하면 됩니다.
            </p>
          )}

          {error && <p className="text-[12.5px] text-danger">{error}</p>}
          {notice && <p className="text-[12.5px] text-success">{notice}</p>}

          <button type="submit" disabled={submitting} className={`${primaryBtnCls} w-full justify-center`}>
            {mode === 'login' ? <LogIn size={15} /> : mode === 'reset' ? <KeyRound size={15} /> : <UserPlus size={15} />}
            {mode === 'login' ? '로그인' : mode === 'reset' ? '재설정 메일 보내기' : '가입 신청'}
          </button>
        </form>

        {/* 비밀번호를 잊었을 때 — 메일로 재설정 링크를 받는다. */}
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'reset' ? 'login' : 'reset');
            setNotice('');
            setError('');
          }}
          className="mt-3 w-full text-center text-[12.5px] text-text-sub hover:text-text-strong"
        >
          {mode === 'reset' ? '로그인으로 돌아가기' : '비밀번호를 잊으셨나요?'}
        </button>

        {mode === 'register' && (
          <p className="mt-4 text-[12px] text-text-faint">
            가입 신청 후 관리자 승인이 완료되어야 시스템을 사용할 수 있습니다.
          </p>
        )}
      </div>
    </div>
  );
}
