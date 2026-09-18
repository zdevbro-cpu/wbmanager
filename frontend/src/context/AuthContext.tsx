import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { api } from '../api/client';
import { applyTheme, type ThemeMode } from '../lib/theme';

export interface AppUser {
  id: string;
  firebaseUid: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  role: 'admin' | 'worker';
  status: 'pending' | 'approved' | 'rejected';
  lastLoginAt?: string | null;
  lastLoginIp?: string | null;
  loginCount?: number;
  /** 모바일 출퇴근에서 이 계정이 누구로 찍히는지 */
  employeeId?: string | null;
  /** 화면 모드 — 계정에 저장된 것. 어느 기기에서 들어와도 이 모드로 연다. */
  themeMode?: ThemeMode;
}

interface AuthContextValue {
  firebaseUser: User | null;
  appUser: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, phone: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshAppUser: () => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAppUser = async () => {
    try {
      const me = await api.get<AppUser>('/api/auth/me');
      setAppUser(me);
      if (me.themeMode) applyTheme(me.themeMode);
    } catch {
      setAppUser(null);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await loadAppUser();
      } else {
        setAppUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    await loadAppUser();
  };

  const register = async (email: string, password: string, name: string, phone: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
    await api.post('/api/auth/register', { name, phone });
    await loadAppUser();
  };

  // 비밀번호 재설정 — 메일 발송과 재설정 화면은 Firebase가 처리한다.
  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  // 화면 모드 — 누르는 즉시 바꾸고 계정에 저장한다. 저장이 실패해도 이 기기에서는 바뀐 채로 둔다.
  const setThemeMode = async (mode: ThemeMode) => {
    applyTheme(mode);
    setAppUser((u) => (u ? { ...u, themeMode: mode } : u));
    try {
      await api.patch('/api/auth/me/theme', { themeMode: mode });
    } catch {
      alert('화면 모드를 계정에 저장하지 못했습니다. 이 기기에서만 바뀐 채로 둡니다.');
    }
  };

  const logout = async () => {
    await signOut(auth);
    setAppUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        appUser,
        loading,
        login,
        register,
        logout,
        resetPassword,
        refreshAppUser: loadAppUser,
        setThemeMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
