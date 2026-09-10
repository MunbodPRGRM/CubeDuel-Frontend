/**
 * รูปทรงของชิ้นส่วนทั้ง 14 ชิ้นของ **Pyraminx** (เฟส 3.5 ก้อนที่ 2)
 *
 * ทรงสี่หน้าอันเดียวกับ Pyramorphix (จุดยอดอยู่ที่มุมลูกบาศก์ [-1,1]³ ที่คูณเครื่องหมาย
 * กันได้ +1) แต่คนละรอยตัด: Pyraminx ตัดด้วย **ระนาบขนานกับหน้า** ทีละ 1/3 ของความสูง
 * แกนละ 2 ระนาบ รวม 8 ระนาบ ได้ชิ้นส่วน 4 + 4 + 6 = 14 ชิ้น
 *
 * เขียนเป็น "ชิ้นนี้ถูกล้อมด้วยระนาบอะไรบ้าง" แล้วปล่อยให้ `three/convex-piece.ts`
 * ไปหาจุดยอดกับปะสติกเกอร์เอง — ไม่ต้องนั่งไล่พิกัดสามเหลี่ยมทีละชิ้น
 *
 * ### พิกัดที่ใช้ในไฟล์นี้
 *
 * `u_i = Vᵢ · p` คือ "ความลึกตามแกนของจุดยอด i" — ในทรงสี่หน้านี้ `u_i` วิ่งจาก **−1**
 * (บนหน้าที่อยู่ตรงข้ามจุดยอด) ถึง **3** (ที่จุดยอดพอดี) รอยตัดสามชั้นจึงอยู่ที่
 * `u_i = 1/3` และ `u_i = 5/3` พอดี
 */
import type * as THREE from 'three';
import { CLASSIC_SKIN, tetraFaceColors, type CubeSkin } from '../three/colors.ts';
import {
  buildConvexPiece,
  touchedFaces,
  type HalfSpace,
  type OuterFace,
} from '../three/convex-piece.ts';
import { matApply, type Vec3 } from '../three/lattice.ts';
import { ORIENTATION, PYRAMINX_PIECES, VERTEX_AXES } from './pyraminx-model.ts';

/** รอยตัดชั้นใน (แบ่งมุมออกจากขอบ) และชั้นนอก (แบ่งยอดออกจากมุม) */
const INNER_CUT = 1 / 3;
const OUTER_CUT = 5 / 3;

/**
 * หน้าไหนได้สีไหน — index คือหมายเลขจุดยอด **ที่หน้านั้นอยู่ตรงข้าม**
 *
 * ยึดสีตามลูกจริงที่พบบ่อยที่สุด: หน้าที่หันเข้าหาคนเล่นเป็นเขียว ขวาแดง ซ้ายน้ำเงิน ฐานเหลือง
 * (`TETRA_FACE_COLORS` เรียง เขียว · แดง · น้ำเงิน · เหลือง)
 */
const COLOR_OF_OPPOSITE_VERTEX = [3, 1, 2, 0];

/** `Vᵢ · p >= value` ในระบบพิกัดที่เห็นบนจอ */
function atLeast(vertex: number, value: number): HalfSpace {
  return { normal: matApply(ORIENTATION, VERTEX_AXES[vertex]!), d: value };
}

/** `Vᵢ · p <= value` — เขียนกลับด้านให้อยู่ในรูป `normal · p >= d` */
function atMost(vertex: number, value: number): HalfSpace {
  return { normal: matApply(ORIENTATION, VERTEX_AXES[vertex]!).map((v) => -v), d: -value };
}

/** หน้าทั้งสี่ของพีระมิด (หน้า index `i` อยู่ตรงข้ามจุดยอด `i`) พร้อมสีของสกินที่เลือก */
export function pyraminxFaces(skin: CubeSkin): readonly OuterFace[] {
  const colors = tetraFaceColors(skin);
  return VERTEX_AXES.map((_, vertex) => ({
    plane: atLeast(vertex, -1),
    color: colors[COLOR_OF_OPPOSITE_VERTEX[vertex]!]!,
  }));
}

/** หน้าทั้งสี่ในสกินตั้งต้น — ระนาบไม่ขึ้นกับสกิน จึงใช้ตัวนี้เป็นตัวแทนตอนคิดรูปทรงได้ */
export const PYRAMINX_FACES: readonly OuterFace[] = pyraminxFaces(CLASSIC_SKIN);

const TETRA_SHELL: readonly HalfSpace[] = PYRAMINX_FACES.map((face) => face.plane);

/**
 * ระนาบที่ล้อมชิ้นส่วนแต่ละชิ้น
 *
 *   - **ยอด** = ส่วนที่เลยรอยตัดชั้นนอกของจุดยอดตัวเองไป
 *   - **มุม** = อยู่ระหว่างรอยตัดสองชั้นของจุดยอดตัวเอง และไม่เลยรอยตัดชั้นในของยอดอื่นเลย
 *   - **ขอบ** = เลยรอยตัดชั้นในของ **สองยอด** พร้อมกัน แต่ไม่เลยรอยตัดชั้นนอกของทั้งคู่
 */
export function planesForPiece(pieceIndex: number): HalfSpace[] {
  const piece = PYRAMINX_PIECES[pieceIndex]!;
  const planes = [...TETRA_SHELL];

  if (piece.kind === 'tip') {
    planes.push(atLeast(piece.vertices[0]!, OUTER_CUT));
    return planes;
  }

  for (const vertex of piece.vertices) {
    planes.push(atLeast(vertex, INNER_CUT), atMost(vertex, OUTER_CUT));
  }
  for (let vertex = 0; vertex < 4; vertex++) {
    if (!piece.vertices.includes(vertex)) planes.push(atMost(vertex, INNER_CUT));
  }
  return planes;
}

/** ชิ้นนี้มีสติกเกอร์กี่แผ่น (ยอด/มุม = 3 · ขอบ = 2 — รวมทั้งลูก 36 แผ่นเท่าลูกจริง) */
export function stickerCount(pieceIndex: number): number {
  return touchedFaces(planesForPiece(pieceIndex), PYRAMINX_FACES).length;
}

/** geometry ของทุกชิ้น เรียงตรงกับ id ของชิ้นใน `PyraminxModel` */
export function buildPyraminxGeometries(skin: CubeSkin = CLASSIC_SKIN): THREE.BufferGeometry[] {
  const faces = pyraminxFaces(skin);
  return PYRAMINX_PIECES.map((_, index) =>
    buildConvexPiece(planesForPiece(index), faces, undefined, skin.bodyColor),
  );
}

/** ทิศของจุดยอดในระบบพิกัดที่เห็นบนจอ — สคริปต์ verify ใช้ตรวจว่า U ชี้ขึ้นจริง */
export function orientedVertexAxis(vertex: number): Vec3 {
  return matApply(ORIENTATION, VERTEX_AXES[vertex]!);
}
