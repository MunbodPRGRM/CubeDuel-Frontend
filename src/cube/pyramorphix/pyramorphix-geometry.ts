/**
 * รูปทรงของชิ้นส่วนทั้ง 8 ชิ้นของ **Pyramorphix** (เขียนใหม่ในเฟส 3.5 ก้อนที่ 2)
 *
 * แนวคิด: Pyramorphix = 2x2x2 ที่ถูกตัดเป็นทรงสี่หน้า
 *   - เอาลูกบาศก์ [-1,1]³ แบ่งเป็น 8 octant (= 8 ชิ้นของ 2x2x2)
 *   - ฝังทรงสี่หน้าที่มีจุดยอดอยู่ที่มุมลูกบาศก์ 4 มุมที่คูณเครื่องหมายกันได้ +1
 *   - ชิ้นส่วนแต่ละชิ้น = octant ∩ ทรงสี่หน้า
 *
 * ผลที่ได้เอง (ไม่ต้องเขียนพิเศษ): ชิ้นที่อยู่ตรงจุดยอด → เป็นยอดแหลม เห็น 3 หน้า ·
 * ชิ้นที่อยู่มุมตรงข้าม → เป็นสามเหลี่ยมกลางหน้า เห็นหน้าเดียว
 *
 * และเพราะแต่ละชิ้นเป็นของแข็งที่คงรูปของตัวเอง การหมุน 90° จึงทำให้รูปทรงรวมเปลี่ยนไป
 * (shape-shifting) โดยอัตโนมัติ ไม่ต้องเขียนโค้ดพิเศษใด ๆ (พิสูจน์แล้วในเฟส 0.5)
 *
 * ### ต่างจากไฟล์ `tetra-geometry.ts` เดิมยังไง
 *
 * เดิมรับ "octant ของแต่ละช่อง" ที่คำนวณมาจาก KPuzzle ของ cubing.js และระบายสีทั้งชิ้น
 * ตอนนี้รับพิกัดบ้านจากโมเดลของเราเอง และวาดแบบเดียวกับ 2x2x2 / 3x3x3 คือ
 * **เนื้อพลาสติกสีเข้ม + สติกเกอร์สีลอยอยู่บนหน้า** ผ่านตัวสร้างกลาง `three/convex-piece.ts`
 */
import type * as THREE from 'three';
import { TETRA_FACE_COLORS } from '../three/colors.ts';
import {
  buildConvexPiece,
  touchedFaces,
  type HalfSpace,
  type OuterFace,
} from '../three/convex-piece.ts';

/**
 * จุดยอดของทรงสี่หน้าที่ฝังอยู่ในลูกบาศก์ = มุมลูกบาศก์ที่คูณเครื่องหมายกันได้ +1
 *
 * หน้าของทรงสี่หน้าคือหน้าที่ **อยู่ตรงข้าม** จุดยอดแต่ละจุด — ระนาบ `V · p = -1`
 * (ทั้งลูกอยู่ฝั่ง `V · p >= -1` ครบทั้งสี่จุดยอด)
 */
export const TETRA_VERTICES: readonly (readonly number[])[] = [
  [1, 1, 1],
  [1, -1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
];

/** หน้าทั้งสี่ของพีระมิด พร้อมสี — ลำดับตรงกับ `TETRA_VERTICES` (หน้าที่อยู่ตรงข้ามจุดยอดนั้น) */
export const TETRA_FACES: readonly OuterFace[] = TETRA_VERTICES.map((vertex, index) => ({
  plane: { normal: vertex, d: -1 },
  color: TETRA_FACE_COLORS[index]!,
}));

/** ระนาบทั้งหมดที่ล้อมชิ้นของ octant นี้ — 3 ระนาบของ octant + 4 หน้าของพีระมิด */
export function planesFor(octant: readonly number[]): HalfSpace[] {
  const [sx, sy, sz] = octant as [number, number, number];
  return [
    { normal: [sx, 0, 0], d: 0 },
    { normal: [0, sy, 0], d: 0 },
    { normal: [0, 0, sz], d: 0 },
    ...TETRA_FACES.map((face) => face.plane),
  ];
}

/** ชิ้นนี้เห็นผิวนอกของพีระมิดกี่หน้า (3 = ยอดพีระมิด, 1 = สามเหลี่ยมกลางหน้า) */
export function countOuterFaces(octant: readonly number[]): number {
  return touchedFaces(planesFor(octant), TETRA_FACES).length;
}

/**
 * geometry ของทุกชิ้น เรียงตรงกับ `homeCoords` ที่ส่งเข้ามา
 * (ต้องเป็นชุดเดียวกับที่ `PyramorphixModel` ใช้ — ก็คือ octant ทั้ง 8 ของลูกบาศก์ 2 ชั้น)
 */
export function buildPyramorphixGeometries(
  homeCoords: readonly (readonly number[])[],
): THREE.BufferGeometry[] {
  return homeCoords.map((coord) => buildConvexPiece(planesFor(coord), TETRA_FACES));
}
