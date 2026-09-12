/**
 * รูปร่างข้อมูลของ endpoint กลุ่ม auth — ต้องตรงกับ docs/api-contract.md ข้อ 2
 *
 * ⚠️ ไฟล์นี้ไม่ได้แชร์กับ backend (ADR-021) ถ้าฝั่งโน้นแก้ payload ไม่มีอะไรเตือนที่นี่
 * → แก้ payload เมื่อไหร่ ต้องแก้ `docs/api-contract.md` ก่อน แล้วไล่แก้ทั้งสองฝั่งในคราวเดียว
 */

export type UserRole = 'member' | 'admin';
export type UserStatus = 'active' | 'suspended';

/** ข้อมูลของเจ้าของบัญชีเอง (มี email) */
export interface SelfUser {
  userId: number;
  username: string;
  nickname: string | null;
  /** ข้อความแนะนำตัว — **ข้อความล้วน** ห้าม render เป็น HTML และไม่ทำ auto-link (ADR-066 ข้อ 3) */
  bio: string | null;
  role: UserRole;
  createdAt: string;
  email: string;
  cubeSkin: string;
  status: UserStatus;
  /** `false` = บัญชี Google ที่ยังไม่เคยตั้งรหัสผ่าน — หน้าตั้งค่าไม่ถามรหัสเดิม/รหัสยืนยัน (ADR-058 ข้อ 6) */
  hasPassword: boolean;
}

export interface AuthSession {
  user: SelfUser;
  accessToken: string;
  /** เว็บไม่ต้องเก็บเอง — อยู่ใน httpOnly cookie อยู่แล้ว (ค่านี้มีไว้ให้ Capacitor, ADR-023) */
  refreshToken: string;
}

/** รหัส error ทั้งหมดที่ server ตอบได้ (api-contract.md ข้อ 1) */
export type ApiErrorCode =
  | 'E_VALIDATION'
  | 'E_UNAUTHENTICATED'
  | 'E_FORBIDDEN'
  | 'E_ACCOUNT_SUSPENDED'
  | 'E_NOT_FOUND'
  | 'E_CONFLICT'
  | 'E_RATE_LIMITED'
  | 'E_INTERNAL';

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  nickname?: string | null;
}

/** `PATCH /users/me` — ส่งเฉพาะช่องที่จะแก้ · `nickname: null` / `bio: null` = ล้างทิ้ง */
export interface UpdateProfileInput {
  nickname?: string | null;
  bio?: string | null;
  cubeSkin?: string;
}

export interface LoginInput {
  identifier: string;
  password: string;
}

/** ชื่อที่แสดงในหน้าจอ — ไม่มีชื่อเล่นให้ใช้ username แทน (database-schema.md ตารางที่ 1) */
export function displayName(user: SelfUser): string {
  return user.nickname?.trim() || user.username;
}
