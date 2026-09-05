/**
 * รูปทรงของชิ้นส่วนทั้ง 8 ชิ้นของ Pyramorphix — ยกมาจาก `poc/pyramorphix-renderer/src/tetra-geometry.js`
 *
 * แนวคิด: Pyramorphix = 2x2x2 ที่ถูกตัดเป็นทรงสี่หน้า
 *   - เอาลูกบาศก์ [-1,1]^3 แบ่งเป็น 8 octant (= 8 ชิ้นของ 2x2x2)
 *   - ฝังทรงสี่หน้าที่มีจุดยอดอยู่ที่มุมลูกบาศก์ 4 มุมที่เครื่องหมายคูณกันได้ +1
 *   - ชิ้นส่วนแต่ละชิ้น = octant ∩ ทรงสี่หน้า
 *
 * ผลที่ได้เอง (ไม่ต้องเขียนพิเศษ): ชิ้นที่อยู่ตรงจุดยอด → เป็นยอดแหลม เห็น 3 หน้า
 *                                ชิ้นที่อยู่มุมตรงข้าม → เป็นสามเหลี่ยมกลางหน้า เห็นหน้าเดียว
 *
 * และเพราะแต่ละชิ้นเป็นของแข็งที่คงรูปของตัวเอง การหมุน 90° จึงทำให้รูปทรงรวม
 * เปลี่ยนไป (shape-shifting) โดยอัตโนมัติ ไม่ต้องเขียนโค้ดพิเศษใด ๆ (พิสูจน์แล้วในเฟส 0.5)
 */
import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';

/** ระนาบ 4 หน้าของทรงสี่หน้า เขียนเป็น n·p >= d — จุดยอดอยู่ที่มุมลูกบาศก์ที่คูณเครื่องหมายได้ +1 */
export const TETRA_FACES = [
  { normal: [1, 1, 1], d: -1, color: 0xe63946, name: 'แดง' },
  { normal: [1, -1, -1], d: -1, color: 0x2a9d8f, name: 'เขียว' },
  { normal: [-1, 1, -1], d: -1, color: 0xf4a261, name: 'ส้ม' },
  { normal: [-1, -1, 1], d: -1, color: 0x457b9d, name: 'น้ำเงิน' },
] as const;

/** หน้าที่เกิดจากรอยตัด ไม่ใช่ผิวนอกของพีระมิด */
const INTERNAL_COLOR = 0x0b0f16;

/**
 * ย่อชิ้นส่วนเข้าหาจุดกึ่งกลางของตัวเอง เพื่อให้เห็น **ร่องระหว่างชิ้น** (roadmap เฟส 3)
 * ถ้าไม่ย่อ ตอนแก้เสร็จพีระมิดจะดูเป็นทรงตันสีเดียว แยกไม่ออกว่ามีกี่ชิ้น
 */
const PIECE_SCALE = 0.94;

interface HalfSpace {
  normal: readonly number[];
  d: number;
}

/** ระนาบทั้งหมดที่ล้อมชิ้นส่วนของ octant นี้ (n·p >= d) */
function halfSpacesFor(octant: readonly number[]): HalfSpace[] {
  const [sx, sy, sz] = octant as [number, number, number];
  return [
    // 3 ระนาบของ octant (ผ่านจุดกำเนิด)
    { normal: [sx, 0, 0], d: 0 },
    { normal: [0, sy, 0], d: 0 },
    { normal: [0, 0, sz], d: 0 },
    // 4 ระนาบของทรงสี่หน้า
    ...TETRA_FACES.map((f) => ({ normal: f.normal, d: f.d })),
  ];
}

function solve3x3(m: readonly (readonly number[])[], rhs: readonly number[]): number[] | null {
  const [a, b, c] = m[0] as [number, number, number];
  const [d, e, f] = m[1] as [number, number, number];
  const [g, h, i] = m[2] as [number, number, number];
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-12) return null;
  const [r1, r2, r3] = rhs as [number, number, number];
  return [
    (r1 * (e * i - f * h) - b * (r2 * i - f * r3) + c * (r2 * h - e * r3)) / det,
    (a * (r2 * i - f * r3) - r1 * (d * i - f * g) + c * (d * r3 - r2 * g)) / det,
    (a * (e * r3 - r2 * h) - b * (d * r3 - r2 * g) + r1 * (d * h - e * g)) / det,
  ];
}

/** จุดยอดทั้งหมดของชิ้นส่วน = จุดตัดของระนาบ 3 ระนาบที่ยังอยู่ในขอบเขตของทุกระนาบ */
export function pieceVertices(octant: readonly number[]): number[][] {
  const planes = halfSpacesFor(octant);
  const points: number[][] = [];

  for (let i = 0; i < planes.length; i++) {
    for (let j = i + 1; j < planes.length; j++) {
      for (let k = j + 1; k < planes.length; k++) {
        const p = solve3x3(
          [planes[i]!.normal, planes[j]!.normal, planes[k]!.normal],
          [planes[i]!.d, planes[j]!.d, planes[k]!.d],
        );
        if (!p) continue;
        const inside = planes.every(
          (pl) =>
            pl.normal[0]! * p[0]! + pl.normal[1]! * p[1]! + pl.normal[2]! * p[2]! >= pl.d - 1e-7,
        );
        if (!inside) continue;
        const duplicate = points.some(
          (q) => Math.hypot(q[0]! - p[0]!, q[1]! - p[1]!, q[2]! - p[2]!) < 1e-6,
        );
        if (!duplicate) points.push(p);
      }
    }
  }
  return points;
}

/**
 * geometry ของชิ้นส่วน พร้อมระบายสีต่อหน้า:
 * หน้าที่อยู่บนระนาบของทรงสี่หน้า = สีของหน้านั้น · หน้าที่เหลือ = สีรอยตัด (เกือบดำ)
 */
export function buildPieceGeometry(octant: readonly number[]): THREE.BufferGeometry {
  const raw = pieceVertices(octant);
  if (raw.length < 4) {
    throw new Error(`ชิ้นส่วน octant [${octant.join(',')}] มีจุดยอดแค่ ${raw.length} จุด`);
  }

  // ย่อเข้าหาจุดกึ่งกลางของชิ้นตัวเอง → เกิดร่องระหว่างชิ้น โดยรูปทรงยังได้สัดส่วนเดิม
  const centroid = raw
    .reduce((acc, p) => [acc[0]! + p[0]!, acc[1]! + p[1]!, acc[2]! + p[2]!], [0, 0, 0])
    .map((v) => v / raw.length) as [number, number, number];
  const points = raw.map(
    (p) =>
      new THREE.Vector3(
        centroid[0] + (p[0]! - centroid[0]) * PIECE_SCALE,
        centroid[1] + (p[1]! - centroid[1]) * PIECE_SCALE,
        centroid[2] + (p[2]! - centroid[2]) * PIECE_SCALE,
      ),
  );

  const geometry = new ConvexGeometry(points);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const color = new THREE.Color();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();

  for (let t = 0; t < position.count; t += 3) {
    a.fromBufferAttribute(position, t);
    b.fromBufferAttribute(position, t + 1);
    c.fromBufferAttribute(position, t + 2);
    const mid = a.clone().add(b).add(c).divideScalar(3);

    // หน้านี้ขนานกับระนาบของทรงสี่หน้าหน้าไหนไหม (ชดเชยระยะที่ย่อลงไปด้วย)
    let hex = INTERNAL_COLOR;
    for (const face of TETRA_FACES) {
      const distance = face.normal[0] * mid.x + face.normal[1] * mid.y + face.normal[2] * mid.z;
      const centroidDistance =
        face.normal[0] * centroid[0] + face.normal[1] * centroid[1] + face.normal[2] * centroid[2];
      const expected = centroidDistance + (face.d - centroidDistance) * PIECE_SCALE;
      if (Math.abs(distance - expected) < 1e-6) {
        hex = face.color;
        break;
      }
    }

    color.setHex(hex);
    for (let k = 0; k < 3; k++) {
      colors[(t + k) * 3] = color.r;
      colors[(t + k) * 3 + 1] = color.g;
      colors[(t + k) * 3 + 2] = color.b;
    }
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** ชิ้นนี้เห็นผิวนอกของพีระมิดกี่หน้า (3 = ยอดพีระมิด, 1 = สามเหลี่ยมกลางหน้า) */
export function countOuterFaces(octant: readonly number[]): number {
  const points = pieceVertices(octant);
  let count = 0;
  for (const face of TETRA_FACES) {
    const on = points.filter(
      (p) =>
        Math.abs(
          face.normal[0] * p[0]! + face.normal[1] * p[1]! + face.normal[2] * p[2]! - face.d,
        ) < 1e-6,
    );
    if (on.length >= 3) count++;
  }
  return count;
}
