/**
 * ข้อความ "ทำไมถึงหลุดออกจากระบบ" ที่ต้องข้ามการเปลี่ยนหน้าไปโผล่ที่หน้าเข้าสู่ระบบ
 *
 * เก็บในหน่วยความจำ **ไม่ใช่ query string** (ADR-076 ข้อ 6) — ข้อความแบบนี้อ่านครั้งเดียวแล้วจบ
 * ถ้าอยู่ใน URL จะค้างให้เห็นซ้ำทุกครั้งที่กดรีเฟรชหรือแชร์ลิงก์ต่อ
 *
 * ตัวที่พาไป `/login` คือ `RequireAuth` (เพราะ `user` กลายเป็น `null`) ไม่ใช่โค้ดที่รู้เหตุผล
 * จึงส่งข้อความผ่านตัวแปรโมดูลแทนการส่ง state ไปกับ `navigate()`
 */
let notice: string | null = null;

export function setSessionNotice(message: string): void {
  notice = message;
}

/** อ่านแล้วล้างทิ้งทันที — ข้อความนี้ต้องขึ้นครั้งเดียว */
export function takeSessionNotice(): string | null {
  const current = notice;
  notice = null;
  return current;
}
