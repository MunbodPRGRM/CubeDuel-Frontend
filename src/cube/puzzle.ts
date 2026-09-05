/**
 * ตรรกะสถานะคิวบ์ฝั่ง client — โหลด KPuzzle ของ cubing.js และตรวจว่า "แก้เสร็จ" หรือยัง
 *
 * ตรงกับฝั่ง server (`backend/src/lib/cube-state.ts`) ทุกกติกา แต่เขียนแยกกันตาม ADR-021
 * ฝั่ง client ตรวจเพื่อ **หยุดนาฬิกาให้ทันที** ส่วนผลที่นับจริงยังเป็นของ server เสมอ (เฟส 4)
 */
import type { KPattern, KPuzzle } from 'cubing/kpuzzle';
import { puzzles } from 'cubing/puzzles';
import type { CubeType } from '@/types/cube';

/** ประเภทรูบิค → puzzle ของ cubing.js ที่ใช้เป็นตรรกะ (Pyramorphix ใช้ของ 2x2x2 — ADR-019) */
export const PUZZLE_ID: Record<CubeType, string> = {
  '2x2x2': '2x2x2',
  '3x3x3': '3x3x3',
  pyraminx: 'pyraminx',
  pyramorphix: '2x2x2',
};

const kpuzzleCache = new Map<string, Promise<KPuzzle>>();

/** โหลด KPuzzle (ครั้งแรกหนักพอควร) แล้วเก็บไว้ใช้ซ้ำตลอดอายุแท็บ */
export function getKPuzzle(cubeType: CubeType): Promise<KPuzzle> {
  const id = PUZZLE_ID[cubeType];
  let cached = kpuzzleCache.get(id);
  if (!cached) {
    cached = puzzles[id]!.kpuzzle();
    kpuzzleCache.set(id, cached);
  }
  return cached;
}

// ---------------------------------------------------------------- Pyramorphix

const CORNERS_ORBIT = 'CORNERS';

function movedSlots(kpuzzle: KPuzzle, move: string): Set<number> {
  const { pieces } = kpuzzle.defaultPattern().applyMove(move).patternData[CORNERS_ORBIT]!;
  return new Set(pieces.map((_, slot) => slot).filter((slot) => pieces[slot] !== slot));
}

/**
 * ช่อง (slot) แต่ละช่องอยู่ octant ไหนของลูกบาศก์ — `[sx, sy, sz]` แต่ละตัวเป็น +1 หรือ -1
 * หาจากตัว KPuzzle เอง: ชั้นที่ move `U` ขยับคือชั้น y บวก, `R` = x บวก, `F` = z บวก
 */
export function deriveSlotOctants(kpuzzle: KPuzzle): number[][] {
  const yPlus = movedSlots(kpuzzle, 'U');
  const xPlus = movedSlots(kpuzzle, 'R');
  const zPlus = movedSlots(kpuzzle, 'F');
  if (yPlus.size !== 4 || xPlus.size !== 4 || zPlus.size !== 4) {
    throw new Error('KPuzzle ของ 2x2x2 ผิดรูป: U/R/F ต้องขยับชั้นละ 4 ชิ้น');
  }

  const octants: number[][] = [];
  for (let slot = 0; slot < 8; slot++) {
    octants.push([xPlus.has(slot) ? 1 : -1, yPlus.has(slot) ? 1 : -1, zPlus.has(slot) ? 1 : -1]);
  }
  if (new Set(octants.map((o) => o.join(','))).size !== 8) {
    throw new Error('แปลง slot เป็น octant แล้วได้ค่าซ้ำ');
  }
  return octants;
}

/**
 * ชิ้นไหนเป็น "ยอดพีระมิด" ของ Pyramorphix (เห็น 3 หน้า จึงมองออกว่าหมุนไปทางไหน)
 *
 * ⚠️ ห้าม hard-code `[0, 2, 5, 7]` — ลำดับ index ของ cubing.js ไม่ตรงกับที่คนทั่วไปคิด
 * และอาจเปลี่ยนเมื่ออัปเดตเวอร์ชัน (ADR-019) จึงคำนวณใหม่ทุกครั้ง
 */
export function deriveApexSlots(slotOctants: readonly number[][]): number[] {
  const apex: number[] = [];
  for (let slot = 0; slot < 8; slot++) {
    const [x, y, z] = slotOctants[slot] as [number, number, number];
    if (x * y * z === 1) apex.push(slot);
  }
  if (apex.length !== 4) throw new Error(`ยอดพีระมิดต้องมี 4 ชิ้น แต่คำนวณได้ ${apex.length}`);
  return apex;
}

/**
 * Pyramorphix แก้เสร็จ = ตำแหน่งถูกครบ 8 ชิ้น AND ทิศทางถูกเฉพาะ 4 ชิ้นที่เป็นยอดพีระมิด
 * (อีก 4 ชิ้นโผล่เป็นสามเหลี่ยมสีเดียว มองไม่ออกว่าหมุนไปทางไหน — ADR-019)
 */
export function isPyramorphixSolved(pattern: KPattern, apexSlots: readonly number[]): boolean {
  const orbit = pattern.patternData[CORNERS_ORBIT]!;
  for (let slot = 0; slot < 8; slot++) {
    if (orbit.pieces[slot] !== slot) return false;
    if (apexSlots.includes(slot) && orbit.orientation[slot] !== 0) return false;
  }
  return true;
}
