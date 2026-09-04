import { createContext } from 'react';
import type { LoginInput, RegisterInput, SelfUser } from '@/types/auth';

export interface AuthContextValue {
  /** `loading` = กำลังลองกู้เซสชันเดิมจาก refresh token ตอนเปิดแอป */
  status: 'loading' | 'ready';
  user: SelfUser | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
