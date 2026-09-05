/**
 * สถิติห้องฝึกซ้อม — เก็บใน `localStorage` ของเครื่องเท่านั้น
 *
 * 📕 ห้องฝึกซ้อม **ไม่บันทึกอะไรลง DB เลย** ไม่มีผลต่อคะแนน/สถิติ/ประวัติ
 * และ **ไม่นำไปคิดใน Ao5/Ao12/Ao100 ของโปรไฟล์** (game-rules.md ข้อ 12)
 * ข้อมูลนี้หายได้ ไม่ sync ข้ามอุปกรณ์ — เป็นไปตามที่ตกลงไว้ ไม่ใช่ข้อบกพร่อง
 */
import { CUBE_TYPES, type CubeType } from '@/types/cube';

export interface PracticeSolve {
  /** เวลาเป็นวินาที ทศนิยม 2 ตำแหน่ง · `null` = DNF (ยกเลิกกลางคัน) */
  seconds: number | null;
  scramble: string;
  moveCount: number;
  /** เวลาที่บันทึก (epoch ms) */
  at: number;
}

/** เก็บย้อนหลังพอสำหรับ Ao100 + เผื่ออีกหน่อย ไม่ให้ localStorage บวมไปเรื่อย ๆ */
const MAX_SOLVES = 200;
const STORAGE_PREFIX = 'cubeduel.practice.v1.';

function keyFor(cubeType: CubeType): string {
  return `${STORAGE_PREFIX}${cubeType}`;
}

export function loadSolves(cubeType: CubeType): PracticeSolve[] {
  try {
    const raw = localStorage.getItem(keyFor(cubeType));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // ข้อมูลมาจากเครื่องผู้ใช้ อาจถูกแก้มือหรือค้างจากเวอร์ชันเก่า — คัดเฉพาะแถวที่รูปร่างถูก
    return parsed.filter(
      (item): item is PracticeSolve =>
        typeof item === 'object' &&
        item !== null &&
        (typeof (item as PracticeSolve).seconds === 'number' ||
          (item as PracticeSolve).seconds === null) &&
        typeof (item as PracticeSolve).scramble === 'string',
    );
  } catch {
    return [];
  }
}

/** บันทึก solve ใหม่ (ใหม่สุดอยู่ท้ายรายการ) แล้วคืนรายการล่าสุดทั้งหมด */
export function appendSolve(cubeType: CubeType, solve: PracticeSolve): PracticeSolve[] {
  const solves = [...loadSolves(cubeType), solve].slice(-MAX_SOLVES);
  try {
    localStorage.setItem(keyFor(cubeType), JSON.stringify(solves));
  } catch {
    // เต็มหรือถูกปิดไว้ (โหมดส่วนตัว) — ยอมให้สถิติหาย ดีกว่าทำให้หน้าจอพัง
  }
  return solves;
}

export function clearSolves(cubeType: CubeType): void {
  try {
    localStorage.removeItem(keyFor(cubeType));
  } catch {
    // ไม่มีอะไรต้องทำ
  }
}

export function clearAllSolves(): void {
  for (const cubeType of CUBE_TYPES) clearSolves(cubeType);
}
