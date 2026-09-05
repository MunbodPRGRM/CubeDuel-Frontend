/**
 * คณิตศาสตร์ของ Pyramorphix renderer — แยกออกมาจากส่วนที่แตะ Three.js/DOM เพื่อ **ทดสอบได้**
 * (สคริปต์ตรวจสอบกับ KPuzzle จริงอยู่ที่ `scripts/verify-pyramorphix.ts`)
 *
 * บทเรียนจากเฟส 0.5: เก็บสถานะการหมุนเป็น **เมทริกซ์ 3×3 จำนวนเต็ม** แล้วบังคับให้ภาพ
 * ตรงกับสถานะทุกครั้งหลังอนิเมชันจบ ถ้าปล่อยให้ทศนิยมสะสม สถานะจะเพี้ยนหลังหมุนหลายร้อยครั้ง
 */

/** เมทริกซ์ 3×3 เรียงทีละแถว */
export type Mat3 = readonly number[];
export type Vec3 = readonly number[];

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function matMul(a: Mat3, b: Mat3): Mat3 {
  const out = new Array<number>(9).fill(0);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      for (let k = 0; k < 3; k++) out[r * 3 + c] += a[r * 3 + k]! * b[k * 3 + c]!;
    }
  }
  return out;
}

export function matApply(m: Mat3, v: Vec3): number[] {
  return [
    m[0]! * v[0]! + m[1]! * v[1]! + m[2]! * v[2]!,
    m[3]! * v[0]! + m[4]! * v[1]! + m[5]! * v[2]!,
    m[6]! * v[0]! + m[7]! * v[1]! + m[8]! * v[2]!,
  ];
}

export function matEq(a: Mat3, b: Mat3): boolean {
  return a.every((v, i) => v === b[i]);
}

/** เมทริกซ์หมุนรอบแกน `axis` (0=x, 1=y, 2=z) เป็นมุม 90°×quarters ตามกฎมือขวา */
export function rotationMatrix(axis: number, quarters: number): Mat3 {
  const q = ((quarters % 4) + 4) % 4;
  const c = [1, 0, -1, 0][q]!;
  const s = [0, 1, 0, -1][q]!;
  if (axis === 0) return [1, 0, 0, 0, c, -s, 0, s, c];
  if (axis === 1) return [c, 0, s, 0, 1, 0, -s, 0, c];
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

// ---------------------------------------------------------------- move

export interface ParsedMove {
  /** 0 = x, 1 = y, 2 = z */
  axis: number;
  /** ชั้นที่หมุน: +1 = ฝั่งบวกของแกน, -1 = ฝั่งลบ */
  layerSign: number;
  /** มุมหมุนเป็นจำนวนเท่าของ 90° ตามกฎมือขวา */
  quarters: number;
}

/** หน้าคิวบ์ → (แกน, ฝั่งของแกน) — Pyramorphix ใช้ notation ของ 2x2x2 ครบ 6 หน้า (ADR-019) */
const FACE_TO_LAYER: Record<string, { axis: number; layerSign: number }> = {
  R: { axis: 0, layerSign: 1 },
  L: { axis: 0, layerSign: -1 },
  U: { axis: 1, layerSign: 1 },
  D: { axis: 1, layerSign: -1 },
  F: { axis: 2, layerSign: 1 },
  B: { axis: 2, layerSign: -1 },
};

const LAYER_TO_FACE: Record<string, string> = {
  '0:1': 'R',
  '0:-1': 'L',
  '1:1': 'U',
  '1:-1': 'D',
  '2:1': 'F',
  '2:-1': 'B',
};

/**
 * "หมุนตามเข็มเมื่อมองจากด้านนอกของหน้านั้น" = หมุน -90° รอบแกนฝั่งบวก ตามกฎมือขวา
 * ฝั่งลบของแกน (L/D/B) จึงกลับทิศเป็น +90° → เขียนรวบเป็น `-layerSign`
 */
export function parseMove(move: string): ParsedMove {
  const layer = FACE_TO_LAYER[move[0] ?? ''];
  if (!layer) throw new Error(`ไม่รู้จัก move: ${move}`);
  const suffix = move.slice(1);
  const multiplier = suffix === "'" ? -1 : suffix === '2' ? 2 : suffix === '' ? 1 : null;
  if (multiplier === null) throw new Error(`ไม่รู้จัก move: ${move}`);
  return { ...layer, quarters: -layer.layerSign * multiplier };
}

/** ทางกลับของ `parseMove` — ใช้ตอนแปลงการลากนิ้วเป็นชื่อ move */
export function moveNameFor(axis: number, layerSign: number, quarters: number): string {
  const face = LAYER_TO_FACE[`${axis}:${layerSign}`];
  if (!face) throw new Error(`ไม่มีหน้าที่ตรงกับแกน ${axis} ฝั่ง ${layerSign}`);
  const multiplier = quarters / -layerSign;
  if (multiplier === 1) return face;
  if (multiplier === -1) return `${face}'`;
  if (multiplier === 2 || multiplier === -2) return `${face}2`;
  throw new Error(`มุมหมุน ${quarters} ควอเตอร์ ใช้ไม่ได้`);
}

// ---------------------------------------------------------------- สถานะของชิ้นส่วน

/**
 * ติดตามว่าชิ้นส่วนแต่ละชิ้นอยู่ octant ไหนและหมุนไปเท่าไหร่แล้ว
 * (สถานะที่ใช้ตัดสินผลจริงคือ KPattern ของ 2x2x2 — ตัวนี้ไว้วาดภาพและหาว่าจะหมุนชิ้นไหน)
 */
export class PieceModel {
  readonly slotOctants: readonly number[][];
  pieceOctant: number[][];
  pieceRotation: Mat3[];

  constructor(slotOctants: readonly number[][]) {
    this.slotOctants = slotOctants;
    this.pieceOctant = slotOctants.map((o) => [...o]);
    this.pieceRotation = slotOctants.map(() => IDENTITY);
  }

  reset(): void {
    this.pieceOctant = this.slotOctants.map((o) => [...o]);
    this.pieceRotation = this.slotOctants.map(() => IDENTITY);
  }

  /** ชิ้นไหนอยู่ในชั้นที่ move นี้จะหมุน */
  piecesInLayer(axis: number, layerSign: number): number[] {
    const ids: number[] = [];
    for (let i = 0; i < this.pieceOctant.length; i++) {
      if (this.pieceOctant[i]![axis] === layerSign) ids.push(i);
    }
    return ids;
  }

  /** อัปเดตสถานะภายในตาม move (ไม่แตะภาพ) */
  applyParsed({ axis, layerSign, quarters }: ParsedMove): number[] {
    const rotation = rotationMatrix(axis, quarters);
    const ids = this.piecesInLayer(axis, layerSign);
    for (const i of ids) {
      this.pieceRotation[i] = matMul(rotation, this.pieceRotation[i]!);
      this.pieceOctant[i] = matApply(rotation, this.pieceOctant[i]!);
    }
    return ids;
  }

  /** octant นี้เป็นช่องหมายเลขอะไร */
  octantToSlot(octant: readonly number[]): number {
    for (let slot = 0; slot < this.slotOctants.length; slot++) {
      if (this.slotOctants[slot]!.every((v, k) => v === octant[k])) return slot;
    }
    throw new Error(`octant [${octant.join(',')}] ไม่ตรงกับช่องไหนเลย`);
  }

  /** แปลงเป็นรูปเดียวกับ KPuzzle: `pieces[slot]` = ชิ้นที่อยู่ที่ช่องนั้น */
  getPiecesArray(): number[] {
    const pieces = new Array<number>(this.pieceOctant.length).fill(-1);
    for (let i = 0; i < this.pieceOctant.length; i++) {
      pieces[this.octantToSlot(this.pieceOctant[i]!)] = i;
    }
    return pieces;
  }
}
