/**
 * สร้าง mesh ของ **ชิ้นส่วนทรงนูน** จากรายการระนาบครึ่งปริภูมิ (เฟส 3.5 ก้อนที่ 2)
 *
 * ยกออกมาจาก `pyramorphix/tetra-geometry.ts` เดิม เพราะรูบิคทรงพีระมิดทั้งสองประเภท
 * สร้างชิ้นส่วนด้วยวิธีเดียวกันเป๊ะ — ต่างกันแค่ว่า "เอาระนาบอะไรมาตัด":
 *
 *   - **Pyramorphix** ตัดทรงสี่หน้าด้วยระนาบ 3 ระนาบที่ผ่านจุดกำเนิด (แบ่งเป็น 8 octant)
 *   - **Pyraminx**    ตัดทรงสี่หน้าด้วยระนาบขนานหน้า ชั้นละ 1/3 (ได้ยอด / มุม / ขอบ)
 *
 * หน้าตาที่ได้ตรงกับ `nxn/cube-geometry.ts`: **เนื้อพลาสติกสีเข้ม + สติกเกอร์สีลอยเหนือผิว
 * นิดเดียว** · หนึ่งชิ้น = หนึ่ง mesh (ตัววาดหมุนชิ้นด้วยการ `attach` เข้า pivot)
 *
 * geometry **อบพิกัดบ้านของชิ้นไว้ในตัว** ไม่ได้อยู่ที่จุดกำเนิด — ทุก move คือการหมุนรอบ
 * จุดกำเนิด ท่าของชิ้นจึงเป็นแค่เมทริกซ์หมุนตัวเดียว ไม่ต้องเก็บตำแหน่งแยก
 */
import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BODY_COLOR } from './colors.ts';
import { cross, dot, normalize, type Vec3 } from './lattice.ts';

/** ครึ่งปริภูมิ `normal · p >= d` — ผิวของมันคือระนาบ `normal · p = d` (ด้านนอกอยู่ฝั่ง −normal) */
export interface HalfSpace {
  normal: Vec3;
  d: number;
}

/** ระนาบที่เป็น "หน้าจริง" ของรูบิค (ไม่ใช่รอยตัดข้างใน) จึงต้องมีสติกเกอร์ */
export interface OuterFace {
  plane: HalfSpace;
  color: number;
}

export interface PieceStyle {
  /** ย่อเนื้อชิ้นเข้าหาจุดกึ่งกลางตัวเอง เพื่อให้เห็นร่องระหว่างชิ้น */
  bodyScale: number;
  /** สติกเกอร์เล็กกว่าหน้าของชิ้น จะได้เห็นขอบพลาสติกล้อมรอบ */
  stickerScale: number;
  /** ยกสติกเกอร์ให้ลอยเหนือผิวนิดเดียว กัน z-fighting */
  stickerLift: number;
}

export const DEFAULT_PIECE_STYLE: PieceStyle = {
  bodyScale: 0.94,
  stickerScale: 0.82,
  stickerLift: 0.004,
};

const EPS = 1e-7;

/** ทา geometry ด้วยสีเดียวทั้งก้อน แล้วคลาย index ออกให้รวมกับก้อนอื่นได้ */
export function paintGeometry(geometry: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
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

/** เหลือเฉพาะ attribute ที่ทุกก้อนมีเหมือนกัน ไม่งั้น `mergeGeometries` ปฏิเสธ */
export function keepBasicAttributes(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  for (const name of Object.keys(geometry.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'color') {
      geometry.deleteAttribute(name);
    }
  }
  return geometry;
}

function solve3x3(m: readonly Vec3[], rhs: readonly number[]): number[] | null {
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

/**
 * จุดยอดของชิ้น = จุดตัดของระนาบ 3 ระนาบ ที่ยังอยู่ในขอบเขตของ **ทุก** ระนาบ
 *
 * วิธีนี้ช้ากว่าการเขียนรูปทรงตรง ๆ แต่เรียกแค่ตอนสร้างคิวบ์ครั้งเดียว และแลกมาด้วยการที่
 * เพิ่มรอยตัดแบบใหม่ได้โดยไม่ต้องนั่งคิดรูปทรงเองเลย — แค่บอกว่าตัดด้วยระนาบอะไรบ้าง
 */
export function pieceCorners(planes: readonly HalfSpace[]): number[][] {
  const points: number[][] = [];
  for (let i = 0; i < planes.length; i++) {
    for (let j = i + 1; j < planes.length; j++) {
      for (let k = j + 1; k < planes.length; k++) {
        const p = solve3x3(
          [planes[i]!.normal, planes[j]!.normal, planes[k]!.normal],
          [planes[i]!.d, planes[j]!.d, planes[k]!.d],
        );
        if (!p) continue;
        if (!planes.every((plane) => dot(plane.normal, p) >= plane.d - EPS)) continue;
        const duplicate = points.some(
          (q) => Math.hypot(q[0]! - p[0]!, q[1]! - p[1]!, q[2]! - p[2]!) < 1e-6,
        );
        if (!duplicate) points.push(p);
      }
    }
  }
  return points;
}

function centroidOf(points: readonly (readonly number[])[]): [number, number, number] {
  const sum = points.reduce(
    (acc, p) => [acc[0]! + p[0]!, acc[1]! + p[1]!, acc[2]! + p[2]!],
    [0, 0, 0],
  );
  return sum.map((v) => v / points.length) as [number, number, number];
}

function shrinkToward(
  point: readonly number[],
  center: readonly number[],
  scale: number,
): number[] {
  return [
    center[0]! + (point[0]! - center[0]!) * scale,
    center[1]! + (point[1]! - center[1]!) * scale,
    center[2]! + (point[2]! - center[2]!) * scale,
  ];
}

/** ระนาบเดิมย้ายไปอยู่ที่ไหน หลังจากย่อชิ้นเข้าหา `center` ด้วยอัตราส่วน `scale` */
function shrunkPlaneDistance(plane: HalfSpace, center: Vec3, scale: number): number {
  const atCenter = dot(plane.normal, center);
  return atCenter + (plane.d - atCenter) * scale;
}

/**
 * สติกเกอร์หนึ่งแผ่น: เอาจุดยอดของชิ้นที่นอนอยู่บนระนาบนี้มาเรียงเป็นรูปหลายเหลี่ยม
 * ย่อเข้าหาจุดกึ่งกลางของหน้า แล้วยกลอยขึ้นตามทิศออกนอก
 */
function buildSticker(
  face: OuterFace,
  corners: readonly (readonly number[])[],
  style: PieceStyle,
): THREE.BufferGeometry | null {
  if (corners.length < 3) return null;

  // ด้านนอกอยู่ฝั่ง −normal (ข้างในของชิ้นคือฝั่งที่ normal · p มากกว่า d)
  const outward = normalize(face.plane.normal).map((v) => -v);
  const center = centroidOf(corners);

  // เรียงจุดรอบจุดกึ่งกลางของหน้าก่อน ไม่งั้นสามเหลี่ยมที่ลากจะไขว้กัน
  const uAxis = normalize([
    corners[0]![0]! - center[0],
    corners[0]![1]! - center[1],
    corners[0]![2]! - center[2],
  ]);
  const vAxis = cross(outward, uAxis);
  const angleOf = (p: readonly number[]): number => {
    const rel = [p[0]! - center[0], p[1]! - center[1], p[2]! - center[2]];
    return Math.atan2(dot(rel, vAxis), dot(rel, uAxis));
  };
  const ordered = [...corners].sort((a, b) => angleOf(a) - angleOf(b));

  const lifted = ordered.map((p) => {
    const inset = shrinkToward(p, center, style.stickerScale);
    return [
      inset[0]! + outward[0]! * style.stickerLift,
      inset[1]! + outward[1]! * style.stickerLift,
      inset[2]! + outward[2]! * style.stickerLift,
    ];
  });

  // ลากสามเหลี่ยมแบบพัด แล้วบังคับให้หน้าหันออกนอก
  const positions: number[] = [];
  for (let i = 1; i + 1 < lifted.length; i++) {
    const [a, b, c] = [lifted[0]!, lifted[i]!, lifted[i + 1]!];
    const facing = dot(
      cross(
        [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!],
        [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!],
      ),
      outward,
    );
    for (const p of facing >= 0 ? [a, b, c] : [a, c, b]) positions.push(p[0]!, p[1]!, p[2]!);
  }
  if (positions.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.computeVertexNormals();
  return paintGeometry(geometry, face.color);
}

/**
 * geometry ของชิ้นหนึ่งชิ้น — เนื้อพลาสติกสีเข้ม + สติกเกอร์เฉพาะหน้าที่ชิ้นนี้โผล่ออกมา
 *
 * @param planes ระนาบทั้งหมดที่ล้อมชิ้นนี้ (ทั้งรอยตัดข้างในและหน้าจริงของรูบิค)
 * @param outerFaces หน้าจริงของรูบิคพร้อมสี — ชิ้นที่ไม่ได้แตะหน้าไหน ก็ไม่มีสติกเกอร์ของหน้านั้น
 * @param bodyColor สีเนื้อพลาสติกของสกินที่ผู้เล่นเลือก (ไม่ส่ง = สกิน `classic`)
 */
export function buildConvexPiece(
  planes: readonly HalfSpace[],
  outerFaces: readonly OuterFace[],
  style: PieceStyle = DEFAULT_PIECE_STYLE,
  bodyColor: number = BODY_COLOR,
): THREE.BufferGeometry {
  const raw = pieceCorners(planes);
  if (raw.length < 4) {
    throw new Error(`ชิ้นส่วนนี้มีจุดยอดแค่ ${raw.length} จุด — ระนาบที่ให้มาไม่ได้ล้อมเป็นก้อน`);
  }

  const center = centroidOf(raw);
  const corners = raw.map((p) => shrinkToward(p, center, style.bodyScale));

  const body = keepBasicAttributes(
    paintGeometry(
      new ConvexGeometry(corners.map((p) => new THREE.Vector3(p[0]!, p[1]!, p[2]!))),
      bodyColor,
    ),
  );
  const parts: THREE.BufferGeometry[] = [body];

  for (const face of outerFaces) {
    const distance = shrunkPlaneDistance(face.plane, center, style.bodyScale);
    const onFace = corners.filter((p) => Math.abs(dot(face.plane.normal, p) - distance) < 1e-6);
    const sticker = buildSticker(face, onFace, style);
    if (sticker) parts.push(keepBasicAttributes(sticker));
  }

  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error('รวม geometry ของชิ้นส่วนไม่สำเร็จ');
  for (const part of parts) part.dispose();
  merged.computeVertexNormals();
  return merged;
}

/**
 * ชิ้นนี้โผล่ออกมาที่หน้าไหนบ้าง (คืน index ใน `outerFaces`)
 * สคริปต์ `verify-*` ใช้ตรวจว่าจำนวนสติกเกอร์ต่อชิ้นตรงกับลูกจริง
 */
export function touchedFaces(
  planes: readonly HalfSpace[],
  outerFaces: readonly OuterFace[],
): number[] {
  const corners = pieceCorners(planes);
  const touched: number[] = [];
  outerFaces.forEach((face, index) => {
    const on = corners.filter((p) => Math.abs(dot(face.plane.normal, p) - face.plane.d) < 1e-6);
    if (on.length >= 3) touched.push(index);
  });
  return touched;
}
