import { createContext } from 'react';
import type { LoginInput, RegisterInput, SelfUser, UpdateProfileInput } from '@/types/auth';

export interface AuthContextValue {
  /** `loading` = กำลังลองกู้เซสชันเดิมจาก refresh token ตอนเปิดแอป */
  status: 'loading' | 'ready';
  user: SelfUser | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  /** แก้ชื่อเล่น/สกินคิวบ์ของตัวเอง แล้วอัปเดตข้อมูลผู้ใช้ในแอปให้ทันที (หัวข้อบน + คิวบ์ 3 มิติ) */
  /** คืนโปรไฟล์ชุดเต็มหลังบันทึก — ฟอร์มต้องใช้ค่าที่ผ่าน normalize ของ server แล้ว (ADR-066 ข้อ 4) */
  updateProfile: (input: UpdateProfileInput) => Promise<SelfUser>;
  /** ลบบัญชีตัวเอง (soft delete ฝั่ง server — ADR-008) แล้วออกจากระบบ */
  deleteAccount: (password?: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
