/**
 * รูปทรงของชิ้นส่วนลูกบาศก์ N ชั้น (เฟส 3.5 ก้อนที่ 1)
 *
 * หนึ่งชิ้น = **หนึ่ง mesh** เสมอ (เนื้อพลาสติก + สติกเกอร์รวมเป็น geometry เดียว) เพราะตัววาด
 * หมุนชิ้นด้วยการ `attach` mesh เข้า pivot ถ้าแยกเป็นหลาย object จะต้องไล่จัดกลุ่มเองทุกครั้ง
 *
 * geometry **อบพิกัดบ้านของชิ้นไว้ในตัว** (ไม่ได้อยู่ที่จุดกำเนิด) — ทุก move ของลูกบาศก์คือ
 * การหมุนรอบจุดกำเนิด ท่าของชิ้นจึงเป็นแค่ "เมทริกซ์หมุน" ตัวเดียว ไม่ต้องเก็บตำแหน่งแยก
 * (หลักการเดียวกับ Pyramorphix ใน `tetra-geometry.ts`)
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BODY_COLOR, FACE_COLORS } from '../three/colors.ts';

/** ย่อเนื้อชิ้นลงเพื่อให้เห็น **ร่องระหว่างชิ้น** เหมือนลูกจริง */
const BODY_SCALE = 0.92;
/** สติกเกอร์เล็กกว่าหน้าของชิ้น จะได้เห็นขอบพลาสติกดำล้อมรอบ */
const STICKER_SCALE = 0.78;
/** ยกสติกเกอร์ให้ลอยเหนือผิวนิดเดียว กัน z-fighting */
const STICKER_LIFT = 0.002;

/** หน้าที่อยู่ฝั่งนั้นของแกน (0=x, 1=y, 2=z) */
const FACE_AT: Record<string, string> = {
  '0:1': 'R',
  '0:-1': 'L',
  '1:1': 'U',
  '1:-1': 'D',
  '2:1': 'F',
  '2:-1': 'B',
};

/** ทา geometry ด้วยสีเดียวทั้งก้อน แล้วคลาย index ออกให้รวมกับก้อนอื่นได้ */
function painted(geometry: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flat !== geometry) geometry.dispose();

  const count = flat.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color(hex);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  flat.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return flat;
}

/** สติกเกอร์หนึ่งแผ่นบนหน้าที่ตั้งฉากกับแกน `axis` ฝั่ง `sign` ของชิ้นที่อยู่ตรง `center` */
function buildSticker(
  axis: number,
  sign: number,
  center: readonly number[],
  cell: number,
): THREE.BufferGeometry {
  const size = cell * STICKER_SCALE;
  const plane = new THREE.PlaneGeometry(size, size);

  // PlaneGeometry หันหน้าไปทาง +z เป็นค่าเริ่มต้น — หมุนให้ไปทางแกน/ฝั่งที่ต้องการ
  if (axis === 0) plane.rotateY((sign * Math.PI) / 2);
  else if (axis === 1) plane.rotateX((-sign * Math.PI) / 2);
  else if (sign < 0) plane.rotateY(Math.PI);

  const offset = (cell * BODY_SCALE) / 2 + STICKER_LIFT;
  const position = [center[0]!, center[1]!, center[2]!];
  position[axis] += sign * offset;
  plane.translate(position[0]!, position[1]!, position[2]!);

  return painted(plane, FACE_COLORS[FACE_AT[`${axis}:${sign}`]!]!);
}

/**
 * geometry ของทุกชิ้น เรียงตรงกับ `homeCoords` ที่ส่งเข้ามา (ต้องเป็นชุดเดียวกับที่โมเดลใช้)
 *
 * @param n จำนวนชั้น
 * @param homeCoords พิกัดบ้านของแต่ละชิ้น (เดินทีละ 2 — ดู `LatticePieceModel`)
 */
export function buildCubeletGeometries(
  n: number,
  homeCoords: readonly (readonly number[])[],
): THREE.BufferGeometry[] {
  const outer = n - 1;
  /** ความกว้างของหนึ่งชิ้น เมื่อทั้งลูกกินพื้นที่ [-1, 1] เท่ากับ Pyramorphix */
  const cell = 2 / n;

  return homeCoords.map((coord) => {
    const center = coord.map((v) => (v * cell) / 2);
    const body = new THREE.BoxGeometry(
      cell * BODY_SCALE,
      cell * BODY_SCALE,
      cell * BODY_SCALE,
    ).translate(center[0]!, center[1]!, center[2]!);

    const parts = [painted(body, BODY_COLOR)];
    for (let axis = 0; axis < 3; axis++) {
      for (const sign of [1, -1]) {
        if (coord[axis] === sign * outer) parts.push(buildSticker(axis, sign, center, cell));
      }
    }

    const merged = mergeGeometries(parts, false);
    if (!merged) throw new Error(`รวม geometry ของชิ้น [${coord.join(',')}] ไม่สำเร็จ`);
    for (const part of parts) part.dispose();
    return merged;
  });
}
