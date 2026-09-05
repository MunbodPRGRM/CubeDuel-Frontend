/**
 * ทางเข้าเดียวของโมดูลคิวบ์ 3 มิติ — ส่วนอื่นของแอปให้ import จากที่นี่เท่านั้น
 * จะได้ไม่มีใครไปผูกกับ renderer ตัวใดตัวหนึ่งตรง ๆ (ADR-019 · ADR-026)
 *
 * **เฟส 3.5:** 2x2x2 / 3x3x3 / Pyramorphix ใช้ `ThreeCubeView` ที่เราเขียนเองแล้วทั้งหมด
 * เหลือ Pyraminx ที่ยังใช้ `<twisty-player>` อยู่ชั่วคราว — ก้อนที่ 2 จะทำ mini-PoC
 * แล้วย้ายมาใช้ตัวเดียวกัน (ถ้า PoC ไม่ผ่านค่อยคงไว้พร้อมบันทึกเหตุผลลง ADR-026)
 */
import type { CubeType } from '@/types/cube';
import { buildCubeletGeometries } from './nxn/cube-geometry.ts';
import { NxNCubeModel } from './nxn/cube-model.ts';
import { buildPieceGeometry } from './pyramorphix/tetra-geometry.ts';
import { deriveApexSlots, deriveSlotOctants, getKPuzzle, isPyramorphixSolved } from './puzzle.ts';
import { ThreeCubeView } from './three/ThreeCubeView.ts';
import { TwistyCubeView } from './TwistyCubeView.ts';
import type { CubeView } from './types.ts';

export type { CubeState, CubeStateListener, CubeView } from './types.ts';
export { ALLOWED_MOVES, inverseMove, isAllowedMove, normalizeMove } from './moves.ts';

/** สร้างคิวบ์ 3 มิติลงใน `container` — เลือกเส้นทางให้เองตามประเภท */
export async function createCubeView(
  cubeType: CubeType,
  container: HTMLElement,
): Promise<CubeView> {
  if (cubeType === 'pyraminx') return TwistyCubeView.create(cubeType, container);

  const kpuzzle = await getKPuzzle(cubeType);

  // Pyramorphix = 2x2x2 ที่ตัดเป็นทรงพีระมิด — ตรรกะเหมือนกันเป๊ะ ต่างที่รูปทรงกับกติกาแก้เสร็จ
  if (cubeType === 'pyramorphix') {
    const slotOctants = deriveSlotOctants(kpuzzle);
    const apexSlots = deriveApexSlots(slotOctants);
    return new ThreeCubeView(container, {
      cubeType,
      model: new NxNCubeModel(2, slotOctants),
      geometries: slotOctants.map((octant) => buildPieceGeometry(octant)),
      kpuzzle,
      isSolved: (pattern) => isPyramorphixSolved(pattern, apexSlots),
    });
  }

  const model = new NxNCubeModel(cubeType === '2x2x2' ? 2 : 3);
  const solvedPattern = kpuzzle.defaultPattern();
  return new ThreeCubeView(container, {
    cubeType,
    model,
    geometries: buildCubeletGeometries(model.n, model.lattice.homeCoords),
    kpuzzle,
    isSolved: (pattern) => pattern.isIdentical(solvedPattern),
  });
}
