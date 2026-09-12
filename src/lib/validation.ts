/**
 * กฎ validation ฝั่งหน้าจอ — สะท้อนกฎใน docs/api-contract.md ข้อ 2 ให้ผู้ใช้เห็นผลทันทีโดยไม่ต้องรอ server
 *
 * ⚠️ นี่คือความสะดวก **ไม่ใช่ความปลอดภัย** — server ตรวจซ้ำทุกข้ออยู่แล้วและถือเป็นคำตัดสินสุดท้าย
 * ถ้าแก้กฎที่นี่ ต้องแก้ `backend/src/schemas/auth.schema.ts` ให้ตรงกันด้วย
 */

const USERNAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESERVED_USERNAME_PREFIX = /^deleted_user_/i;

export const PASSWORD_MAX_BYTES = 72;

/**
 * `bio` — ต้องตรงกับ `backend/src/schemas/user.schema.ts` (ADR-066 ข้อ 1 และ 4)
 * ฝั่งนี้แค่บอกผู้ใช้ล่วงหน้า · server normalize แล้วตรวจซ้ำเสมอ และเป็นคำตัดสินสุดท้าย
 */
export const BIO_MAX_LENGTH = 300;
export const BIO_MAX_LINES = 6;

export function validateUsername(value: string): string | undefined {
  const v = value.trim();
  if (!v) return 'กรุณากรอกชื่อผู้ใช้';
  if (v.length < 3 || v.length > 50) return 'ชื่อผู้ใช้ต้องยาว 3–50 ตัวอักษร';
  if (!USERNAME_PATTERN.test(v)) return 'ใช้ได้เฉพาะ a-z A-Z 0-9 _ และห้ามขึ้นต้นด้วยตัวเลข';
  if (RESERVED_USERNAME_PREFIX.test(v)) return 'ชื่อผู้ใช้นี้ระบบสงวนไว้ กรุณาใช้ชื่ออื่น';
  return undefined;
}

export function validateEmail(value: string): string | undefined {
  const v = value.trim();
  if (!v) return 'กรุณากรอกอีเมล';
  if (!EMAIL_PATTERN.test(v)) return 'รูปแบบอีเมลไม่ถูกต้อง';
  if (v.length > 100) return 'อีเมลต้องยาวไม่เกิน 100 ตัวอักษร';
  return undefined;
}

export function validatePassword(value: string): string | undefined {
  if (!value) return 'กรุณากรอกรหัสผ่าน';
  if (value.length < 8) return 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร';
  // bcrypt ตัดส่วนที่เกิน 72 ไบต์ทิ้ง — ภาษาไทย 1 ตัวกิน 3 ไบต์ จึงต้องนับไบต์ ไม่ใช่จำนวนตัวอักษร
  if (new TextEncoder().encode(value).length > PASSWORD_MAX_BYTES) {
    return `รหัสผ่านยาวเกินไป (สูงสุด ${PASSWORD_MAX_BYTES} ไบต์)`;
  }
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return 'รหัสผ่านต้องมีทั้งตัวอักษรและตัวเลข';
  return undefined;
}

export function validateNickname(value: string): string | undefined {
  const v = value.trim();
  if (!v) return undefined; // ไม่บังคับ
  if (v.length > 50) return 'ชื่อเล่นต้องยาวไม่เกิน 50 ตัวอักษร';
  return undefined;
}
