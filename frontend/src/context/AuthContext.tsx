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

  const logout = async () => {
    await signOut(auth);
    setAppUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ firebaseUser, appUser, loading, login, register, logout, resetPassword, refreshAppUser: loadAppUser }}
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
