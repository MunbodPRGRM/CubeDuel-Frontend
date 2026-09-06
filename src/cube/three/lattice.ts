/**
 * โมเดลชิ้นส่วนบน **แลตทิซจำนวนเต็ม** — ส่วนที่ renderer ทุกประเภทใช้ร่วมกัน (เฟส 3.5 ก้อนที่ 1)
 *
 * เดิมอยู่ใน `pyramorphix/rotation.ts` ตัวเดียว ตอนนี้ยกออกมาเป็นของกลางเพราะทั้ง
 * 2x2x2 / 3x3x3 / Pyramorphix ใช้กติกาเดียวกันหมด: **ทุก move คือการหมุนรอบจุดกำเนิด**
 * ชิ้นส่วนจึงเก็บแค่ 2 อย่าง — อยู่พิกัดไหน กับหมุนไปแล้วเท่าไหร่
 *
 * บทเรียนจากเฟส 0.5: เก็บการหมุนเป็น **เมทริกซ์ 3×3 จำนวนเต็ม** แล้วบังคับให้ภาพตรงกับ
 * สถานะทุกครั้งหลังอนิเมชันจบ ถ้าปล่อยให้ทศนิยมสะสม สถานะจะเพี้ยนหลังหมุนหลายร้อยครั้ง
 *
 * ไฟล์นี้ **ห้าม import three หรือ DOM** — สคริปต์ `verify-*` รันบน Node เปล่า ๆ ต้องเรียกได้
 *
 * ⚠️ ทุกไฟล์ใน `src/cube/` เขียน import แบบ **ใส่นามสกุล `.ts`** ด้วยเหตุผลเดียวกัน:
 * Node ESM ไม่เติมนามสกุลให้เอง ถ้าตัดออกสคริปต์ `verify-*` จะพังทันที
 * (tsconfig เปิด `allowImportingTsExtensions` ไว้แล้ว · Vite รองรับอยู่แล้ว)
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

/** สลับแถวกับหลัก — สำหรับเมทริกซ์หมุน ตัวนี้คือตัวผกผัน */
export function matTranspose(m: Mat3): Mat3 {
  return [m[0]!, m[3]!, m[6]!, m[1]!, m[4]!, m[7]!, m[2]!, m[5]!, m[8]!];
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
}

export function cross(a: Vec3, b: Vec3): number[] {
  return [
    a[1]! * b[2]! - a[2]! * b[1]!,
    a[2]! * b[0]! - a[0]! * b[2]!,
    a[0]! * b[1]! - a[1]! * b[0]!,
  ];
}

export function normalize(v: Vec3): number[] {
  const length = Math.hypot(v[0]!, v[1]!, v[2]!);
  if (length < 1e-12) throw new Error('normalize เวกเตอร์ศูนย์ไม่ได้');
  return [v[0]! / length, v[1]! / length, v[2]! / length];
}

/**
 * เมทริกซ์หมุนรอบแกนอะไรก็ได้ (สูตร Rodrigues) — Pyraminx หมุนรอบแกนเอียง ไม่ใช่ x/y/z
 * `axis` ไม่ต้องเป็นเวกเตอร์หนึ่งหน่วย เดี๋ยวปรับให้เอง
 */
export function rotationAbout(axis: Vec3, angle: number): Mat3 {
  const [x, y, z] = normalize(axis) as [number, number, number];
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  return [
    t * x * x + c,
    t * x * y - s * z,
    t * x * z + s * y,
    t * x * y + s * z,
    t * y * y + c,
    t * y * z - s * x,
    t * x * z - s * y,
    t * y * z + s * x,
    t * z * z + c,
  ];
}

/**
 * เหมือน `rotationAbout` แต่ปัดเป็นจำนวนเต็ม แล้ว**โยน error ถ้าปัดไม่ลงตัว**
 *
 * ใช้กับการหมุนที่ต้องเก็บเป็นสถานะ (90° รอบแกนหลัก · 120° รอบเส้นทแยงมุมลูกบาศก์)
 * เพราะสถานะต้องไม่มีทศนิยมสะสม — บทเรียนจากเฟส 0.5 ที่เขียนไว้หัวไฟล์
 */
export function integerRotationAbout(axis: Vec3, angle: number): Mat3 {
  const raw = rotationAbout(axis, angle);
  const rounded = raw.map((v) => Math.round(v));
  for (let i = 0; i < 9; i++) {
    if (Math.abs(raw[i]! - rounded[i]!) > 1e-9) {
      throw new Error(
        `หมุนรอบแกน [${axis.join(',')}] ${((angle * 180) / Math.PI).toFixed(1)}° แล้วไม่ได้เมทริกซ์จำนวนเต็ม`,
      );
    }
  }
  return rounded;
}

/**
 * เมทริกซ์ที่ย้ายฐาน `[ex, ey, ez]` (ตั้งฉากกันและยาวหนึ่งหน่วย) ไปเป็นแกน x/y/z ตามลำดับ
 *
 * ใช้ตั้ง "ท่ายืน" ของรูบิคที่ระบบพิกัดภายในไม่ตรงกับที่ควรเห็นบนจอ:
 * Pyraminx เก็บสถานะบนแลตทิซที่ยอดพีระมิดชี้ไปทางเส้นทแยงมุมลูกบาศก์ (ถึงจะได้เมทริกซ์
 * จำนวนเต็ม) แต่บนจอต้องเห็นยอดชี้ขึ้นตรง ๆ
 */
export function basisMatrix(ex: Vec3, ey: Vec3, ez: Vec3): Mat3 {
  return [ex[0]!, ex[1]!, ex[2]!, ey[0]!, ey[1]!, ey[2]!, ez[0]!, ez[1]!, ez[2]!];
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

/**
 * ติดตามว่าชิ้นส่วนแต่ละชิ้นอยู่พิกัดไหนและหมุนไปเท่าไหร่แล้ว
 *
 * **พิกัดเดินทีละ 2** เพื่อให้ชั้นนอกสุดเป็นจำนวนเต็มเสมอไม่ว่ากี่ชั้น:
 *   - 2 ชั้น → ค่าที่เป็นไปได้คือ −1, +1   (ชั้นนอก = 1)
 *   - 3 ชั้น → ค่าที่เป็นไปได้คือ −2, 0, +2 (ชั้นนอก = 2, ชั้นกลาง = 0)
 *
 * สถานะที่ใช้ตัดสินผลจริงคือ `KPattern` ของ cubing.js — ตัวนี้ไว้วาดภาพกับหาว่าจะหมุนชิ้นไหน
 * สคริปต์ `verify-*` มีหน้าที่พิสูจน์ว่าสองฝั่งไม่หลุดกัน
 */
export class LatticePieceModel {
  /** พิกัดบ้านของแต่ละชิ้น (index ในอาร์เรย์นี้คือ id ของชิ้น) */
  readonly homeCoords: readonly (readonly number[])[];
  /** ตอนนี้ชิ้นแต่ละชิ้นอยู่พิกัดไหน */
  coords: number[][];
  /** ชิ้นแต่ละชิ้นหมุนไปแล้วเท่าไหร่ เทียบกับตอนอยู่บ้าน */
  rotations: Mat3[];

  #slotByCoord = new Map<string, number>();

  constructor(homeCoords: readonly (readonly number[])[]) {
    this.homeCoords = homeCoords.map((c) => [...c]);
    this.homeCoords.forEach((c, slot) => this.#slotByCoord.set(c.join(','), slot));
    if (this.#slotByCoord.size !== this.homeCoords.length) {
      throw new Error('พิกัดบ้านของชิ้นส่วนซ้ำกัน');
    }
    this.coords = this.homeCoords.map((c) => [...c]);
    this.rotations = this.homeCoords.map(() => IDENTITY);
  }

  get pieceCount(): number {
    return this.homeCoords.length;
  }

  reset(): void {
    this.coords = this.homeCoords.map((c) => [...c]);
    this.rotations = this.homeCoords.map(() => IDENTITY);
  }

  /** ชิ้นไหนอยู่ในชั้นที่ระบุ (`layers` = ค่าพิกัดตามแกนนั้นที่นับว่าอยู่ในชั้น) */
  piecesInLayers(axis: number, layers: readonly number[]): number[] {
    const ids: number[] = [];
    for (let i = 0; i < this.coords.length; i++) {
      if (layers.includes(this.coords[i]![axis]!)) ids.push(i);
    }
    return ids;
  }

  /**
   * ชิ้นไหนอยู่ "ฝั่ง `direction`" ลึกอย่างน้อย `minDot`
   *
   * ลูกบาศก์เลือกชั้นด้วยค่าพิกัดตรง ๆ ได้เพราะชั้นตั้งฉากกับแกนพิกัดพอดี แต่ชั้นของพีระมิด
   * ตั้งฉากกับ **เส้นทแยงมุม** จึงต้องวัดด้วยผลคูณจุดแทน (Pyraminx — เฟส 3.5 ก้อนที่ 2)
   */
  piecesWithDotAtLeast(direction: Vec3, minDot: number): number[] {
    const ids: number[] = [];
    for (let i = 0; i < this.coords.length; i++) {
      if (dot(this.coords[i]!, direction) >= minDot) ids.push(i);
    }
    return ids;
  }

  /** หมุนชิ้นที่ระบุรอบแกน (ไม่แตะภาพ) */
  rotate(axis: number, quarters: number, ids: readonly number[]): void {
    this.rotateBy(rotationMatrix(axis, quarters), ids);
  }

  /** หมุนชิ้นที่ระบุด้วยเมทริกซ์ที่ให้มา — **ต้องเป็นจำนวนเต็ม** ไม่งั้นสถานะจะเพี้ยนสะสม */
  rotateBy(rotation: Mat3, ids: readonly number[]): void {
    for (const i of ids) {
      this.rotations[i] = matMul(rotation, this.rotations[i]!);
      this.coords[i] = matApply(rotation, this.coords[i]!);
    }
  }

  /** พิกัดนี้เป็นช่องหมายเลขอะไร */
  slotOf(coord: readonly number[]): number {
    const slot = this.#slotByCoord.get(coord.join(','));
    if (slot === undefined) throw new Error(`พิกัด [${coord.join(',')}] ไม่ตรงกับช่องไหนเลย`);
    return slot;
  }

  /** ตอนนี้ช่องนี้มีชิ้นไหนอยู่ (`-1` ถ้ายังไม่มีใคร — ไม่ควรเกิด) */
  pieceAtSlot(slot: number): number {
    return this.toPiecesArray()[slot]!;
  }

  /** แปลงเป็นรูปเดียวกับ KPuzzle: `pieces[slot]` = ชิ้นที่อยู่ที่ช่องนั้น */
  toPiecesArray(): number[] {
    const pieces = new Array<number>(this.coords.length).fill(-1);
    for (let i = 0; i < this.coords.length; i++) pieces[this.slotOf(this.coords[i]!)] = i;
    return pieces;
  }

  /** ทุกชิ้นกลับบ้านและหันตรงหมดแล้วหรือยัง (ภาพของ "แก้เสร็จ" แบบเข้มที่สุด) */
  isHome(): boolean {
    for (let i = 0; i < this.coords.length; i++) {
      if (this.slotOf(this.coords[i]!) !== i) return false;
      if (!matEq(this.rotations[i]!, IDENTITY)) return false;
    }
    return true;
  }
}
