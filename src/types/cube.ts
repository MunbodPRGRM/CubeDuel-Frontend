/**
 * ประเภทรูบิคที่รองรับ — ต้องตรงกับ backend/src/types/cube.ts เป๊ะ
 * ขอบเขต 4 ประเภทล็อกไว้ในเล่มแล้ว ไม่เพิ่มอีก (ADR-021)
 *
 * ⚠️ **ลำดับในอาร์เรย์นี้คือลำดับที่แสดงบนหน้าจอทั้งแอป** (ตัวเลือกประเภท · กล่องแก้คะแนนของแอดมิน · Tutorial)
 * เจ้าของสั่งเรียงแบบนี้ (2026-09-16 · เฟส 13 ก้อนที่ 3) — **จงใจไม่ตรงกับลำดับของ `enum CubeType` ใน DB**
 * ห้ามเรียงใหม่ให้ "ตรงกับ schema" · ลำดับ enum ของ PostgreSQL ผูกกับลำดับที่ประกาศและไม่มี query ไหนใช้เรียง
 */
export const CUBE_TYPES = ['2x2x2', '3x3x3', 'pyramorphix', 'pyraminx'] as const;
export type CubeType = (typeof CUBE_TYPES)[number];

export function isCubeType(v: unknown): v is CubeType {
  return typeof v === 'string' && (CUBE_TYPES as readonly string[]).includes(v);
}
