/**
 * จำว่า "เคยดูโหมดฝึกสอนการใช้งานแล้วหรือยัง" — เก็บใน `localStorage` ของเครื่องเท่านั้น
 *
 * ⚙️ เลือก `localStorage` แทนคอลัมน์ใน `User` (ADR-053 ข้อ 1) — ข้อมูลนี้หายได้และ
 * **ไม่ sync ข้ามอุปกรณ์** เป็นไปตามที่ตกลงไว้ ไม่ใช่ข้อบกพร่อง (เหมือนสถิติห้องฝึกซ้อม)
 *
 * เก็บ **แยกตามบัญชี** ไม่ใช่ค่าเดียวทั้งเบราว์เซอร์ เพราะเครื่องหนึ่งเครื่องมีคนใช้หลายบัญชีได้
 * (บัญชีใหม่บนเครื่องเดิมต้องได้เห็น ส่วนบัญชีที่ดูไปแล้วต้องไม่โดนซ้ำ)
 */

const STORAGE_KEY = 'cubeduel.tutorial.v1';

/**
 * เลขรุ่นของ **เนื้อหา** ฝึกสอน — ขยับเลขนี้เมื่อไหร่ ทุกคนจะได้เห็นใหม่อีกรอบ
 * (ใช้ตอนเพิ่ม/รื้อขั้นตอนจนคู่มือเดิมใช้ไม่ได้แล้ว เช่น ตอนเพิ่มหน้าจอของเฟส 9)
 */
export const TUTORIAL_VERSION = 1;

interface StoredState {
  version: number;
  /** รายชื่อ identity ที่ดูจบ/ปิดไปแล้ว — ดู `tutorialIdentity()` */
  seen: string[];
}

/** ชื่อเจ้าของสถานะ — แยกตาม `userId` เพราะคะแนน/สถิติก็แยกตามบัญชีอยู่แล้ว */
export function tutorialIdentity(userId: number): string {
  return `user:${userId}`;
}

/**
 * ของ **โหมดสอนเล่นในห้องฝึกซ้อม** (ADR-065 ข้อ 2) — คนละ identity กับคู่มือการใช้เว็บ
 * แต่ใช้คีย์ `localStorage` กับเลขรุ่นชุดเดียวกัน (ขยับ `TUTORIAL_VERSION` ทีเดียวได้เห็นใหม่ทั้งคู่)
 */
export function practiceTutorialIdentity(userId: number): string {
  return `practice:user:${userId}`;
}

function read(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: TUTORIAL_VERSION, seen: [] };
    const parsed: unknown = JSON.parse(raw);
    // ข้อมูลมาจากเครื่องผู้ใช้ อาจถูกแก้มือหรือค้างจากเวอร์ชันเก่า — รูปร่างไม่ตรงถือว่ายังไม่เคยดู
    if (typeof parsed !== 'object' || parsed === null)
      return { version: TUTORIAL_VERSION, seen: [] };
    const state = parsed as Partial<StoredState>;
    if (state.version !== TUTORIAL_VERSION || !Array.isArray(state.seen)) {
      return { version: TUTORIAL_VERSION, seen: [] };
    }
    return { version: TUTORIAL_VERSION, seen: state.seen.filter((x) => typeof x === 'string') };
  } catch {
    // โหมดส่วนตัว/ปิด storage ไว้ — ถือว่ายังไม่เคยดู แล้วปล่อยให้ `markSeen` พังเงียบ ๆ ต่อไป
    return { version: TUTORIAL_VERSION, seen: [] };
  }
}

export function hasSeenTutorial(identity: string): boolean {
  return read().seen.includes(identity);
}

export function markTutorialSeen(identity: string): void {
  const state = read();
  if (state.seen.includes(identity)) return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: TUTORIAL_VERSION, seen: [...state.seen, identity] }),
    );
  } catch {
    // เขียนไม่ได้ = คู่มือจะเด้งอีกรอบหน้าถัดไป ยอมได้ ดีกว่าทำให้หน้าจอพัง
  }
}

/** ลืมทั้งหมด (ใช้ตอนทดสอบ — เรียกจาก console ได้ผ่าน `import` ในหน้า dev) */
export function forgetTutorial(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ไม่มีอะไรต้องทำ
  }
}
