/**
 * ข้อมูลลวดลายต่อ vertex ของชิ้นคิวบ์ (ADR-087 ข้อ 2–3 · เฟส 13 ก้อนที่ 25)
 *
 * geometry **ไม่รู้ว่าผู้เล่นใช้สกินไหน** — ทุกชิ้นของทุกสกินมีข้อมูลชุดนี้เหมือนกัน แล้ว shader ของ
 * สกินที่มีลายเป็นคนเลือกใช้ (สกิน `classic` ไม่ได้ปะ shader จึงไม่อ่านเลย)
 *
 *   - `patternUv`   (vec2) พิกัดบนระนาบสติกเกอร์ **หน่วยโลก** วัดจากจุดกลางสติกเกอร์
 *   - `patternInfo` (vec3) = (โหมด, offset u, offset v)
 *       · โหมด 0 = เนื้อพลาสติก (ไม่รับลาย) · 1 = สติกเกอร์
 *       · offset สุ่มคงที่ต่อสติกเกอร์ — ไม่งั้นหินอ่อน 54 แผ่นเป็นลายเดียวกันซ้ำจนดูปลอม
 *
 * **หน่วยโลก** ทำให้ลายละเอียดเท่ากันทุกประเภททุกขนาด (shader หารด้วยขนาดลายหนึ่งรอบเอง)
 * และเพราะข้อมูลติดไปกับ geometry ของชิ้น **ลายจึงหมุนตามชิ้นเอง** ไม่ต้องทำอะไรในอนิเมชัน
 *
 * ⚠️ **ไม่มี "ฝา" ชิ้นกลางแล้ว** (เจ้าของสั่งเอาออก — ADR-087 หมายเหตุ) ชิ้นกลาง 3x3 กับสามเหลี่ยมกลางหน้า
 * ของ Pyramorphix ใช้ลายเดียวกับสติกเกอร์อื่น → ลายที่มีทิศทางบนชิ้นเหล่านั้นอาจหันคนละทางกับแผ่นข้าง ๆ
 * ทั้งที่คิวบ์แก้เสร็จแล้ว (ทิศของมันไม่นับตอนตัดสิน) — ยอมรับแล้ว
 *
 * ไฟล์นี้ใช้ three แต่ **ห้ามแตะ DOM** — `verify-*` สร้าง geometry บน Node
 */
import * as THREE from 'three';
import { cross, dot, normalize, type Vec3 } from './lattice.ts';

export const PATTERN_MODE = { body: 0, sticker: 1 } as const;

/** attribute ที่ทุกก้อนต้องมีเหมือนกัน — `mergeGeometries` ปฏิเสธถ้าชุดไม่ตรง */
export const PIECE_ATTRIBUTES: readonly string[] = [
  'position',
  'normal',
  'color',
  'patternUv',
  'patternInfo',
];

/** ตัดทุก attribute ที่ไม่อยู่ใน `PIECE_ATTRIBUTES` (เช่น `uv` ของ BoxGeometry/PlaneGeometry) */
export function keepPieceAttributes(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  for (const name of Object.keys(geometry.attributes)) {
    if (!PIECE_ATTRIBUTES.includes(name)) geometry.deleteAttribute(name);
  }
  return geometry;
}

function setAttributes(
  geometry: THREE.BufferGeometry,
  uv: (index: number) => [number, number],
  info: [number, number, number],
): THREE.BufferGeometry {
  const count = geometry.getAttribute('position').count;
  const uvs = new Float32Array(count * 2);
  const infos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const [u, v] = uv(i);
    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
    infos.set(info, i * 3);
  }
  geometry.setAttribute('patternUv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('patternInfo', new THREE.BufferAttribute(infos, 3));
  return geometry;
}

/** เนื้อพลาสติก — ไม่รับลาย */
export function markBody(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  return keepPieceAttributes(setAttributes(geometry, () => [0, 0], [PATTERN_MODE.body, 0, 0]));
}

/** hash จำนวนเต็ม → [0, 1) สำหรับ offset ของสติกเกอร์ — ต้องได้ค่าเดิมทุกครั้งที่สร้างคิวบ์ */
function unitHash(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * แกน u, v บนระนาบสติกเกอร์ที่หันออกทาง `outward`
 *
 * v = ทิศ "ขึ้น" ของโลกที่ฉายลงระนาบ → ลายที่มีทิศ (โลหะขัด) วิ่งทางเดียวกันทั้งหน้า
 * หน้าที่หันขึ้น/ลงตรง ๆ ใช้ทิศ "ไปข้างหลัง" แทน (ฉาย "ขึ้น" ลงไปแล้วเหลือศูนย์)
 */
function stickerAxes(outward: Vec3): { u: Vec3; v: Vec3 } {
  const n = normalize(outward);
  const ref: Vec3 = Math.abs(n[1]!) > 0.9 ? [0, 0, -1] : [0, 1, 0];
  const along = dot(ref, n);
  const v = normalize([ref[0]! - along * n[0]!, ref[1]! - along * n[1]!, ref[2]! - along * n[2]!]);
  return { u: cross(v, n), v };
}

export interface StickerFrame {
  /** จุดกลางของสติกเกอร์ (พิกัดบ้านของชิ้น) */
  center: Vec3;
  /** ทิศออกนอกของหน้า */
  outward: Vec3;
  /** เลขประจำสติกเกอร์ — ใช้สุ่ม offset แบบคงที่ */
  seed: number;
}

/** สติกเกอร์ — ใส่พิกัดบนระนาบของตัวเองตาม `frame` */
export function markSticker(
  geometry: THREE.BufferGeometry,
  frame: StickerFrame,
): THREE.BufferGeometry {
  const { u, v } = stickerAxes(frame.outward);
  const position = geometry.getAttribute('position');
  const [cx, cy, cz] = frame.center as [number, number, number];
  // offset เป็นหน่วยโลก ช่วงกว้างพอให้ทุกลายได้ตำแหน่งที่ต่างกันจริง
  const offsetU = unitHash(frame.seed * 2 + 1) * 10;
  const offsetV = unitHash(frame.seed * 2 + 2) * 10;

  return keepPieceAttributes(
    setAttributes(
      geometry,
      (i) => {
        const rel: Vec3 = [position.getX(i) - cx, position.getY(i) - cy, position.getZ(i) - cz];
        return [dot(rel, u), dot(rel, v)];
      },
      [PATTERN_MODE.sticker, offsetU, offsetV],
    ),
  );
}
