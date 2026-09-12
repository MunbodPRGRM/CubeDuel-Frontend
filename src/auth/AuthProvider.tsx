import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch, refreshSession, setAccessToken, setSessionListener } from '@/lib/api';
import type {
  AuthSession,
  LoginInput,
  RegisterInput,
  SelfUser,
  UpdateProfileInput,
} from '@/types/auth';
import { AuthContext, type AuthContextValue } from './auth-context';

/**
 * เก็บสถานะ "ตอนนี้ใครล็อกอินอยู่" ไว้ที่เดียวของทั้งแอป
 *
 * ADR-010: access token อยู่ในหน่วยความจำเท่านั้น (ไม่ลง localStorage) → รีเฟรชหน้าแล้วหาย
 * เพราะงั้นตอนเปิดแอปทุกครั้งต้องลองขอ token ใหม่จาก refresh token ที่อยู่ใน httpOnly cookie ก่อน
 * ถ้าได้ = ผู้ใช้ยังล็อกอินอยู่ (ไม่ต้องให้กรอกรหัสผ่านใหม่ทุกครั้งที่รีเฟรช)
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [user, setUser] = useState<SelfUser | null>(null);

  const applySession = useCallback((session: AuthSession | null) => {
    setAccessToken(session?.accessToken ?? null);
    setUser(session?.user ?? null);
  }, []);

  // ต่ออายุ token อัตโนมัติที่เกิดใน lib/api.ts ต้องสะท้อนกลับมาที่ state ด้วย
  // (เช่น โดนแอดมินระงับกลางคัน → refresh ไม่ผ่าน → เด้งออกจากระบบเอง)
  useEffect(() => {
    setSessionListener((session) => applySession(session));
    return () => setSessionListener(null);
  }, [applySession]);

  useEffect(() => {
    let cancelled = false;
    void refreshSession().finally(() => {
      if (!cancelled) setStatus('ready');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (input: LoginInput) => {
      // retryOnExpired: false — 401 ที่นี่แปลว่า "รหัสผ่านผิด" ไม่ใช่ "token หมดอายุ" ห้ามไปต่ออายุ
      const session = await apiFetch<AuthSession>('/auth/login', {
        method: 'POST',
        body: input,
        retryOnExpired: false,
      });
      applySession(session);
    },
    [applySession],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const session = await apiFetch<AuthSession>('/auth/register', {
        method: 'POST',
        body: input,
        retryOnExpired: false,
      });
      applySession(session);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST', body: {} });
    } finally {
      // ต่อให้ยิงไม่ผ่าน ก็ต้องล้างฝั่งนี้ให้เรียบร้อยอยู่ดี
      applySession(null);
    }
  }, [applySession]);

  const logoutAll = useCallback(async () => {
    try {
      await apiFetch('/auth/logout-all', { method: 'POST' });
    } finally {
      applySession(null);
    }
  }, [applySession]);

  /**
   * ผลลัพธ์ของ PATCH คือโปรไฟล์ชุดเต็ม → ทับของเดิมทั้งก้อน ไม่ต้องเดาว่าช่องไหนเปลี่ยน
   * · คืนค่าออกไปด้วย เพราะ server normalize `bio` แล้วค่าอาจไม่ตรงกับที่พิมพ์ ฟอร์มต้องเอาไปทับ state ของตัวเอง (ADR-066 ข้อ 4)
   */
  const updateProfile = useCallback(async (input: UpdateProfileInput) => {
    const updated = await apiFetch<SelfUser>('/users/me', { method: 'PATCH', body: input });
    setUser(updated);
    return updated;
  }, []);

  const deleteAccount = useCallback(
    async (password?: string) => {
      // server เพิกถอน refresh token ทั้งหมดให้แล้วในทรานแซกชันเดียวกับการลบ — ฝั่งนี้แค่ล้าง state
      await apiFetch('/auth/account', { method: 'DELETE', body: { password } });
      applySession(null);
    },
    [applySession],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, register, logout, logoutAll, updateProfile, deleteAccount }),
    [status, user, login, register, logout, logoutAll, updateProfile, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
