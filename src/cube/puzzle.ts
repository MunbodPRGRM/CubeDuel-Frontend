/**
 * ตรรกะสถานะคิวบ์ฝั่ง client — โหลด KPuzzle ของ cubing.js ไว้ให้ `ThreeCubeView` เดินคู่ไปกับภาพ
 *
 * ตรงกับฝั่ง server (`backend/src/lib/cube-state.ts`) ทุกกติกา แต่เขียนแยกกันตาม ADR-021
 * ฝั่ง client ตรวจเพื่อ **หยุดนาฬิกาให้ทันที** ส่วนผลที่นับจริงยังเป็นของ server เสมอ (เฟส 4)
 *
 * **เฟส 3.5 ก้อนที่ 2:** ตัวช่วยของ Pyramorphix ที่เคยอยู่ในไฟล์นี้ (`deriveSlotOctants` /
 * `deriveApexSlots` / `isPyramorphixSolved`) ถูกลบทิ้ง — โมเดลของ Pyramorphix คิดพิกัดชิ้น
 * และตัดสิน "แก้เสร็จ" จากแลตทิซของตัวเองแล้ว เหมือน 2x2x2 / 3x3x3 (ADR-028)
 * ส่วนการพิสูจน์ว่าตรงกับ KPuzzle ย้ายไปอยู่ที่ `scripts/verify-pyramorphix.ts`
 */
import type { KPuzzle } from 'cubing/kpuzzle';
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
