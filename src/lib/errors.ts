/**
 * คลังข้อความ error ของทั้งแอป — **ที่เดียวที่ตัดสินว่า error แต่ละรหัสพูดว่าอะไรกับผู้ใช้**
 *
 * ที่มาของรายชื่อรหัส: `docs/api-contract.md` ข้อ 1 (ฝั่ง REST) + `docs/socket-events.md` ข้อ 1
 * (ฝั่ง Socket.IO) · สองฝั่งใช้รหัสคนละชุดแต่ทับกันบางตัว → รหัสที่ทับกัน **ต้องพูดเหมือนกันเป๊ะ**
 * ไม่งั้นผู้ใช้เจอ "เรียกถี่เกินไป" คนละสำนวนตามว่าเผลอไปโดนช่องทางไหน (ADR-054 ข้อ 2)
 *
 * ⚠️ เพิ่ม/แก้รหัสที่นี่ ต้องแก้เอกสารใน `docs/` ก่อนเสมอ แล้วรัน `npm run verify:errors`
 * ซึ่งไล่เทียบสามทาง: เอกสาร ↔ ไฟล์นี้ ↔ ชนิดข้อมูลฝั่ง backend
 */
import type { ApiErrorCode } from '@/types/auth';
import type { SocketErrorCode } from '@/socket/types';

/**
 * รหัสที่เกิดฝั่ง client ล้วน — server ไม่เคยส่งมา จึงไม่มีในเอกสารทั้งสองไฟล์
 * (`verify:errors` ยกเว้นสามตัวนี้ให้)
 */
export type ClientErrorCode = 'E_NETWORK' | 'E_TIMEOUT' | 'E_CLIENT';

export type AppErrorCode = ApiErrorCode | SocketErrorCode | ClientErrorCode;

/**
 * ข้อความตั้งต้นของแต่ละรหัส — ใช้เมื่อ server ไม่ได้ส่งข้อความมา หรือ error ไม่ได้มาจาก server
 *
 * เป็น `Record` เต็มรูป (ไม่ใช่ `Partial`) ตั้งใจให้ TypeScript ฟ้องทันทีที่มีรหัสใหม่
 * โผล่มาใน union แล้วลืมเขียนข้อความให้
 */
export const ERROR_MESSAGES: Record<AppErrorCode, string> = {
  // ---- ใช้ร่วมกันทั้ง REST และ socket (ต้องตรงกับข้อความตั้งต้นฝั่ง backend เป๊ะ)
  E_VALIDATION: 'ข้อมูลที่กรอกไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง',
  E_UNAUTHENTICATED: 'กรุณาเข้าสู่ระบบก่อนใช้งาน',
  E_ACCOUNT_SUSPENDED: 'บัญชีนี้ถูกระงับการใช้งาน',
  E_RATE_LIMITED: 'ใช้งานถี่เกินไป กรุณารอสักครู่แล้วลองใหม่',
  E_INTERNAL: 'เกิดข้อผิดพลาดฝั่งระบบ กรุณาลองใหม่อีกครั้ง',

  // ---- เฉพาะ REST
  E_FORBIDDEN: 'ไม่มีสิทธิ์เข้าถึงส่วนนี้',
  E_NOT_FOUND: 'ไม่พบข้อมูลที่ต้องการ',
  E_CONFLICT: 'ข้อมูลนี้ถูกใช้ไปแล้ว',

  // ---- เฉพาะ socket
  E_ROOM_NOT_FOUND: 'ไม่พบห้องนี้ อาจถูกยุบไปแล้วหรือรหัสห้องผิด',
  E_ROOM_FULL: 'ห้องนี้เต็มแล้ว',
  E_NOT_HOST: 'เฉพาะหัวห้องเท่านั้นที่สั่งได้',
  E_INVALID_STATE: 'สั่งไม่ได้ในจังหวะนี้',
  E_MOVE_DURING_INSPECTION: 'หมุนคิวบ์ระหว่างช่วงตรวจสอบไม่ได้',
  E_INVALID_MOVE: 'ท่าหมุนนี้ใช้กับรูบิคประเภทนี้ไม่ได้',
  E_SEQ_MISMATCH: 'ลำดับท่าหมุนไม่ต่อเนื่อง กรุณาลองใหม่',
  E_NOT_SOLVED: 'คิวบ์ยังไม่อยู่ในสถานะแก้เสร็จ',
  E_ALREADY_IN_QUEUE: 'อยู่ในคิวจับคู่อยู่แล้ว',

  // ---- เกิดฝั่ง client เท่านั้น
  E_NETWORK: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง',
  E_TIMEOUT: 'เซิร์ฟเวอร์ไม่ตอบกลับ ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่',
  E_CLIENT: 'หน้าเว็บทำงานผิดพลาด กรุณาลองใหม่อีกครั้ง',
};

/**
 * ข้อความตอนสั่งงานทั้งที่ socket ยังไม่ต่อ — ไม่ใช่ error จาก server จึงไม่มีรหัส
 * แต่ต้องพูดเหมือนกันทุกที่ที่เจอ (คิวจับคู่ · หน้าห้อง · ตอนแข่ง)
 */
export const NOT_CONNECTED_MESSAGE = 'ยังไม่ได้เชื่อมต่อเซิร์ฟเวอร์ กรุณารอสักครู่แล้วลองใหม่';

/**
 * อ่านรหัสออกจาก error ไม่ว่ามาจาก REST หรือ socket — ไม่ใช่ error ของเราคืน `null`
 *
 * ดูที่ฟิลด์ `code` ตรง ๆ ไม่ใช้ `instanceof` **ตั้งใจ** — ไฟล์นี้จะได้ไม่ import อะไรตอน runtime เลย
 * (`api.ts` กับ `socket-client.ts` เป็นฝ่าย import ไฟล์นี้ ถ้าอ้างกลับจะเป็นวงกลม)
 * · ผลพลอยได้คือ error ที่มาทาง event `error` ของ socket ซึ่งเป็น object ธรรมดาไม่ใช่คลาส ก็อ่านได้ด้วย
 */
export function errorCode(error: unknown): AppErrorCode | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && code in ERROR_MESSAGES ? (code as AppErrorCode) : null;
}

/**
 * ข้อความที่เอาไปโชว์ได้เลย ไม่ว่า error จะมาจากทางไหน — **ทุกหน้าจอต้องผ่านฟังก์ชันนี้**
 *
 * ลำดับความสำคัญ:
 *   1. ข้อความที่ server ส่งมาเอง — มันรู้บริบทมากกว่าเรา ("อีเมลนี้ถูกใช้ไปแล้ว" ดีกว่า "ข้อมูลนี้ถูกใช้ไปแล้ว")
 *   2. ข้อความตั้งต้นของรหัสนั้นในคลังข้างบน
 *   3. `fallback` ที่หน้าจอนั้นเขียนบอกว่ากำลังทำอะไรอยู่ ("บันทึกข่าวไม่สำเร็จ")
 */
export function errorMessage(error: unknown, fallback?: string): string {
  const code = errorCode(error);
  const message = (error as { message?: unknown } | null)?.message;
  const text = typeof message === 'string' ? message.trim() : '';

  if (code) return text || ERROR_MESSAGES[code];
  return fallback ?? ERROR_MESSAGES.E_INTERNAL;
}
