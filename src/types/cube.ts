/**
 * ประเภทรูบิคที่รองรับ — ต้องตรงกับ backend/src/types/cube.ts เป๊ะ
 * ขอบเขต 4 ประเภทล็อกไว้ในเล่มแล้ว ไม่เพิ่มอีก (ADR-021)
 */
export const CUBE_TYPES = ['2x2x2', '3x3x3', 'pyraminx', 'pyramorphix'] as const;
export type CubeType = (typeof CUBE_TYPES)[number];

export function isCubeType(v: unknown): v is CubeType {
  return typeof v === 'string' && (CUBE_TYPES as readonly string[]).includes(v);
}
