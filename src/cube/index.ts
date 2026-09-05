/**
 * ทางเข้าเดียวของโมดูลคิวบ์ 3 มิติ — ส่วนอื่นของแอปให้ import จากที่นี่เท่านั้น
 * จะได้ไม่มีใครไปผูกกับ `<twisty-player>` หรือ renderer ของ Pyramorphix ตรง ๆ (ADR-019)
 */
import type { CubeType } from '@/types/cube';
import { PyramorphixCubeView } from './pyramorphix/PyramorphixCubeView';
import { TwistyCubeView } from './TwistyCubeView';
import type { CubeView } from './types';

export type { CubeState, CubeStateListener, CubeView } from './types';
export { ALLOWED_MOVES, isAllowedMove, normalizeMove } from './moves';

/** สร้างคิวบ์ 3 มิติลงใน `container` — เลือกเส้นทางให้เองตามประเภท */
export function createCubeView(cubeType: CubeType, container: HTMLElement): Promise<CubeView> {
  if (cubeType === 'pyramorphix') return PyramorphixCubeView.create(container);
  return TwistyCubeView.create(cubeType, container);
}
