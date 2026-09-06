/**
 * ทางเข้าเดียวของโมดูลคิวบ์ 3 มิติ — ส่วนอื่นของแอปให้ import จากที่นี่เท่านั้น
 * จะได้ไม่มีใครไปผูกกับ renderer ตัวใดตัวหนึ่งตรง ๆ (ADR-019 · ADR-026)
 *
 * **เฟส 3.5 ก้อนที่ 2:** ครบทั้ง 4 ประเภทแล้ว ทุกตัวใช้ `ThreeCubeView` ที่เราเขียนเอง
 * `<twisty-player>` ของ cubing.js ถูกลบออกหมดแล้ว เหลือ cubing.js ไว้ทำงานตรรกะอย่างเดียว
 * (KPuzzle เดินสถานะ + ตัดสินแก้เสร็จของลูกบาศก์กับ Pyraminx)
 *
 * แต่ละประเภทประกอบจากสองชิ้น: **โมเดล** (พิกัดชิ้น + move ไหนหมุนอะไร) กับ
 * **geometry** (รูปทรงของแต่ละชิ้น) ทั้งคู่เป็นโค้ดของเราเอง ไม่ได้มาจาก cubing.js
 */
import type { CubeType } from '@/types/cube';
import { buildCubeletGeometries } from './nxn/cube-geometry.ts';
import { NxNCubeModel } from './nxn/cube-model.ts';
import { buildPyraminxGeometries } from './pyraminx/pyraminx-geometry.ts';
import { PyraminxModel } from './pyraminx/pyraminx-model.ts';
import { buildPyramorphixGeometries } from './pyramorphix/pyramorphix-geometry.ts';
import { PyramorphixModel } from './pyramorphix/pyramorphix-model.ts';
import { getKPuzzle } from './puzzle.ts';
import { ThreeCubeView } from './three/ThreeCubeView.ts';
import type { CubeView } from './types.ts';

export type {
  CubeMoveEvent,
  CubeMoveListener,
  CubeMoveSource,
  CubeState,
  CubeStateListener,
  CubeView,
} from './types.ts';
export { ALLOWED_MOVES, inverseMove, isAllowedMove, normalizeMove } from './moves.ts';

/** สร้างคิวบ์ 3 มิติลงใน `container` */
export async function createCubeView(
  cubeType: CubeType,
  container: HTMLElement,
): Promise<CubeView> {
  const kpuzzle = await getKPuzzle(cubeType);

  // Pyramorphix = 2x2x2 ที่ตัดเป็นทรงพีระมิด — ตรรกะเหมือนกันเป๊ะ ต่างที่รูปทรงกับกติกาแก้เสร็จ
  if (cubeType === 'pyramorphix') {
    const model = new PyramorphixModel();
    return new ThreeCubeView(container, {
      cubeType,
      model,
      geometries: buildPyramorphixGeometries(model.lattice.homeCoords),
      kpuzzle,
      isSolved: () => model.isSolved(),
    });
  }

  if (cubeType === 'pyraminx') {
    const model = new PyraminxModel();
    return new ThreeCubeView(container, {
      cubeType,
      model,
      geometries: buildPyraminxGeometries(),
      kpuzzle,
      isSolved: () => model.isSolved(),
    });
  }

  const model = new NxNCubeModel(cubeType === '2x2x2' ? 2 : 3);
  return new ThreeCubeView(container, {
    cubeType,
    model,
    geometries: buildCubeletGeometries(model.n, model.lattice.homeCoords),
    kpuzzle,
    // **ยอมให้ทั้งลูกถูกหมุนไปทั้งก้อน** — `U D'` (2x2x2) กับ `Uw D'` (3x3x3) หมุนทั้งลูกได้
    // ทั้งที่ไม่มี move `x y z` อยู่ในกติกา ถ้าใช้ `isIdentical` ลูกที่ครบทุกหน้าแล้วจะถูก
    // ตัดสินว่ายังไม่เสร็จ นาฬิกาไม่หยุด (ADR-030) · ต้องตรงกับ `backend/src/lib/cube-state.ts`
    isSolved: (pattern) =>
      pattern.experimentalIsSolved({
        ignorePuzzleOrientation: true,
        // ลูกบาศก์ของ cubing.js ไม่นับทิศของชิ้นกลางหน้าอยู่แล้ว (`orientationMod` = 1)
        // ใส่ไว้เพราะ type บังคับ และเพื่อให้ตรงกับสติกเกอร์สีเดียวที่เราวาด
        ignoreCenterOrientation: true,
      }),
  });
}
