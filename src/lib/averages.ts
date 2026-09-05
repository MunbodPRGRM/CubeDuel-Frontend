/**
 * สถิติแบบ speedcubing — กติกาเดียวกับ `docs/api-contract.md` ข้อ 4
 *
 * ที่นี่ใช้กับ **ห้องฝึกซ้อม** ซึ่งเก็บใน localStorage และไม่นับรวมกับสถิติในโปรไฟล์
 * (game-rules.md ข้อ 12) แต่สูตรต้องเหมือนกันเป๊ะ ไม่งั้นตัวเลขสองที่จะขัดกันเอง
 *
 * `null` = DNF เสมอ (ห้ามใช้ 0 หรือค่าพิเศษอื่นแทน)
 */

/** เวลาที่ดีที่สุด ไม่นับ DNF */
export function bestTime(times: readonly (number | null)[]): number | null {
  const finished = times.filter((t): t is number => t !== null);
  return finished.length === 0 ? null : Math.min(...finished);
}

/** ค่าเฉลี่ยของ solve ที่สำเร็จทั้งหมด ไม่นับ DNF */
export function meanTime(times: readonly (number | null)[]): number | null {
  const finished = times.filter((t): t is number => t !== null);
  if (finished.length === 0) return null;
  return finished.reduce((sum, t) => sum + t, 0) / finished.length;
}

/**
 * Average of N — เอา **N ครั้งล่าสุด** ตัดเร็วสุด 1 + ช้าสุด 1 ออก แล้วเฉลี่ยที่เหลือ
 *
 * - DNF นับเป็น "ช้าที่สุด" → ถูกตัดทิ้งได้ 1 ครั้ง
 * - ถ้ามี DNF **มากกว่า 1 ครั้ง** ใน N ครั้งนั้น ผลลัพธ์เป็น `null` (DNF average)
 * - ยังไม่ครบ N ครั้ง คืน `null` ไม่ใช่เฉลี่ยเท่าที่มี
 *
 * @param times เรียงจากเก่าไปใหม่
 */
export function averageOfN(times: readonly (number | null)[], n: number): number | null {
  if (times.length < n) return null;
  const window = times.slice(times.length - n);

  const dnfCount = window.filter((t) => t === null).length;
  if (dnfCount > 1) return null;

  const finished = window.filter((t): t is number => t !== null).sort((a, b) => a - b);
  // ตัดเร็วสุด 1 ออกเสมอ · ช้าสุดที่ถูกตัดคือ DNF ถ้ามี ไม่งั้นคือเวลาที่มากที่สุด
  const trimmed = dnfCount === 1 ? finished.slice(1) : finished.slice(1, -1);
  if (trimmed.length === 0) return null;
  return trimmed.reduce((sum, t) => sum + t, 0) / trimmed.length;
}
