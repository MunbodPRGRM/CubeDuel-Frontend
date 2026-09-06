/**
 * โมเดลตรรกะของ **Pyraminx** (เฟส 3.5 ก้อนที่ 2 — จุดเสี่ยงเดียวของเฟสนี้)
 *
 * ต่างจากลูกบาศก์ตรงที่ชั้นไม่ได้ตั้งฉากกับแกน x/y/z แต่ตั้งฉากกับ **เส้นที่ลากจากจุดยอด
 * ของพีระมิดไปยังจุดกึ่งกลางของหน้าตรงข้าม** ทั้ง 4 เส้น
 *
 * ### กุญแจสำคัญ: เลือกระบบพิกัดให้เมทริกซ์หมุนเป็นจำนวนเต็ม
 *
 * ถ้าวางพีระมิดให้ยอดชี้ขึ้นตรง ๆ ตามที่เห็นบนจอ แกนหมุนทั้งสี่จะเอียงเป็นเลขทศนิยม
 * การหมุน 120° จะได้เมทริกซ์ทศนิยม แล้วสถานะจะเพี้ยนสะสมหลังหมุนหลายร้อยครั้ง
 * (บทเรียนจากเฟส 0.5 ที่บังคับให้เก็บการหมุนเป็นเมทริกซ์จำนวนเต็ม)
 *
 * จึงเก็บสถานะบนแลตทิซที่ **จุดยอดทั้งสี่อยู่ตรงมุมของลูกบาศก์ [-1,1]³** (มุมที่คูณ
 * เครื่องหมายกันได้ +1) — ทรงสี่หน้าอันเดียวกับที่ Pyramorphix ใช้ ที่ระบบพิกัดนี้
 * การหมุน 120° รอบเส้นทแยงมุมเป็นแค่การสลับแกน x→y→z จึงเป็นจำนวนเต็มเป๊ะ
 *
 * แล้วค่อยคูณด้วย **เมทริกซ์ท่ายืน** (`ORIENTATION`) ตอนส่งออกไปให้ตัววาด เพื่อให้บนจอ
 * เห็นยอด `U` ชี้ขึ้นและหน้าเขียวหันเข้าหาคนเล่นตามธรรมเนียมของ Pyraminx จริง
 * สถานะภายในยังเป็นจำนวนเต็มล้วน ไม่มีทศนิยมสะสม
 *
 * ไฟล์นี้ **ห้าม import three หรือ DOM** — `scripts/verify-pyraminx.ts` รันบน Node เปล่า ๆ
 */
import {
  basisMatrix,
  cross,
  dot,
  integerRotationAbout,
  LatticePieceModel,
  matApply,
  matMul,
  matTranspose,
  normalize,
  type Mat3,
  type Vec3,
} from '../three/lattice.ts';
import type { DragCandidate, PuzzleModel, TurnSpec } from '../three/model.ts';

/** ชื่อจุดยอดตามโน้ตเทชันของ Pyraminx — ลำดับนี้ใช้เป็น index ทุกที่ในไฟล์ */
export const VERTEX_NAMES = ['U', 'L', 'R', 'B'] as const;

/**
 * ทิศของจุดยอดทั้งสี่ในระบบพิกัดภายใน (มุมลูกบาศก์ที่คูณเครื่องหมายกันได้ +1)
 *
 * เลือกตัวไหนเป็น U/L/R/B ก็ได้ ขอแค่คงที่ — `ORIENTATION` ด้านล่างจะหมุนให้ตรงกับที่
 * ควรเห็นบนจอเอง (พิสูจน์ว่าตรงกับ cubing.js ใน `scripts/verify-pyraminx.ts`)
 */
export const VERTEX_AXES: readonly Vec3[] = [
  [1, 1, 1], // U — ยอดบน
  [1, -1, -1], // L — ฐานหน้าซ้าย
  [-1, 1, -1], // R — ฐานหน้าขวา
  [-1, -1, 1], // B — ฐานหลัง
];

/** `U · p` ของชิ้นที่อยู่ในชั้นสองชั้น (ยอด + มุม + ขอบ 3 ชิ้น) อย่างต่ำเท่านี้ */
const WIDE_LAYER_MIN_DOT = 2;
/** `U · p` ของ **ชิ้นยอดอย่างเดียว** อย่างต่ำเท่านี้ (ยอดอยู่ที่ 9 · ที่เหลือไม่เกิน 3) */
const TIP_LAYER_MIN_DOT = 4;

/** หมุนตามเข็มเมื่อมองจากนอกจุดยอดนั้น = −120° ตามกฎมือขวา */
const THIRD = (2 * Math.PI) / 3;

/**
 * เมทริกซ์ท่ายืน: ย้ายจากระบบพิกัดภายใน → ระบบพิกัดที่เห็นบนจอ
 *
 *   - ยอด `U` ชี้ขึ้น (+y)
 *   - ยอด `B` อยู่ด้านหลัง (−z) หน้าที่หันเข้าหาคนเล่นจึงเป็นหน้า U–L–R ตามธรรมเนียม
 *   - `L` เลยตกไปอยู่ซ้าย (−x) และ `R` อยู่ขวา (+x) — ตรวจซ้ำใน `verify-pyraminx.ts`
 */
export const ORIENTATION: Mat3 = (() => {
  const up = normalize(VERTEX_AXES[0]!);
  const back = VERTEX_AXES[3]!;
  const alongUp = dot(back, up);
  const backFlat = normalize([
    back[0]! - alongUp * up[0]!,
    back[1]! - alongUp * up[1]!,
    back[2]! - alongUp * up[2]!,
  ]);
  const ez = backFlat.map((v) => -v); // ยอด B ต้องไปอยู่ฝั่ง −z
  const ex = cross(up, ez);
  return basisMatrix(ex, up, ez);
})();

const ORIENTATION_INVERSE = matTranspose(ORIENTATION);

export type PyraminxPieceKind = 'tip' | 'corner' | 'edge';

export interface PyraminxPiece {
  kind: PyraminxPieceKind;
  /** จุดยอดที่ชิ้นนี้เกาะอยู่ — ยอด/มุมมีตัวเดียว ขอบมีสองตัว */
  vertices: number[];
  /** พิกัดบ้านในระบบพิกัดภายใน */
  coord: number[];
}

/**
 * ชิ้นส่วนทั้ง 14 ชิ้น เรียงเป็น ยอด 4 → มุม 4 → ขอบ 6
 *
 * พิกัดบ้านเลือกให้ **ทิศตรงกับตำแหน่งจริงของชิ้น** และเป็นจำนวนเต็มที่ไม่ซ้ำกัน:
 * ยอดอยู่ไกลสุด (3V) · มุมอยู่ในสุด (V) · ขอบอยู่กึ่งกลางระหว่างสองยอด (Vᵢ + Vⱼ)
 */
export const PYRAMINX_PIECES: readonly PyraminxPiece[] = (() => {
  const pieces: PyraminxPiece[] = [];
  for (let v = 0; v < 4; v++) {
    pieces.push({ kind: 'tip', vertices: [v], coord: VERTEX_AXES[v]!.map((c) => c * 3) });
  }
  for (let v = 0; v < 4; v++) {
    pieces.push({ kind: 'corner', vertices: [v], coord: [...VERTEX_AXES[v]!] });
  }
  for (let a = 0; a < 4; a++) {
    for (let b = a + 1; b < 4; b++) {
      pieces.push({
        kind: 'edge',
        vertices: [a, b],
        coord: VERTEX_AXES[a]!.map((c, i) => c + VERTEX_AXES[b]![i]!),
      });
    }
  }
  return pieces;
})();

export interface ParsedPyraminxMove {
  vertex: number;
  /** ตัวเล็ก = หมุนเฉพาะยอด · ตัวใหญ่ = หมุนยอด + มุม + ขอบ 3 ชิ้น */
  tipOnly: boolean;
  /** +1 = ทวนเข็มเมื่อมองจากนอกจุดยอด (ตามกฎมือขวา) · −1 = ตามเข็ม (คือ move ที่ไม่มี `'`) */
  direction: 1 | -1;
}

const MOVE_PATTERN = /^([ULRBulrb])('?)$/;

export class PyraminxModel implements PuzzleModel {
  readonly lattice = new LatticePieceModel(PYRAMINX_PIECES.map((p) => p.coord));

  get pieceCount(): number {
    return this.lattice.pieceCount;
  }

  /** ท่าของชิ้นในระบบพิกัดที่เห็นบนจอ = Q · R · Qᵀ (สถานะภายใน `R` ยังเป็นจำนวนเต็ม) */
  rotationOf(pieceId: number): Mat3 {
    return matMul(matMul(ORIENTATION, this.lattice.rotations[pieceId]!), ORIENTATION_INVERSE);
  }

  // ---------------------------------------------------------------- move

  /** แยก move ออกเป็นจุดยอด/ชั้น/ทิศ — public เพราะสคริปต์ verify ต้องใช้ตรวจ */
  parse(move: string): ParsedPyraminxMove {
    const match = MOVE_PATTERN.exec(move);
    if (!match) throw new Error(`ไม่รู้จัก move: ${move}`);
    const letter = match[1]!;
    const vertex = VERTEX_NAMES.indexOf(letter.toUpperCase() as (typeof VERTEX_NAMES)[number]);
    if (vertex < 0) throw new Error(`ไม่รู้จัก move: ${move}`);
    return {
      vertex,
      tipOnly: letter === letter.toLowerCase(),
      direction: match[2] === "'" ? 1 : -1,
    };
  }

  /** ทางกลับของ `parse` — คืนชื่อ move ของการหมุนรอบจุดยอดนี้ */
  nameFor(vertex: number, tipOnly: boolean, direction: 1 | -1): string {
    const letter = tipOnly
      ? VERTEX_NAMES[vertex]!.toLowerCase()
      : (VERTEX_NAMES[vertex]! as string);
    return direction === 1 ? `${letter}'` : letter;
  }

  /** ชิ้นที่ move นี้หมุน — คิดจากสถานะ **ปัจจุบัน** เสมอ */
  #piecesFor({ vertex, tipOnly }: ParsedPyraminxMove): number[] {
    return this.lattice.piecesWithDotAtLeast(
      VERTEX_AXES[vertex]!,
      tipOnly ? TIP_LAYER_MIN_DOT : WIDE_LAYER_MIN_DOT,
    );
  }

  turnFor(move: string): TurnSpec {
    const parsed = this.parse(move);
    return {
      axis: normalize(matApply(ORIENTATION, VERTEX_AXES[parsed.vertex]!)),
      angle: parsed.direction * THIRD,
      pieceIds: this.#piecesFor(parsed),
    };
  }

  apply(move: string): void {
    const parsed = this.parse(move);
    const rotation = integerRotationAbout(VERTEX_AXES[parsed.vertex]!, parsed.direction * THIRD);
    this.lattice.rotateBy(rotation, this.#piecesFor(parsed));
  }

  reset(): void {
    this.lattice.reset();
  }

  /**
   * ลากชิ้นนี้แล้วหมุนอะไรได้บ้าง
   *
   *   - **ยอด** อยู่ในชั้นของจุดยอดเดียว และเป็นชิ้นที่แยกหมุนได้ → เสนอ move ตัวเล็ก
   *     (ถ้าอยากหมุนทั้งชั้นให้ลากที่ชิ้นมุมซึ่งอยู่ถัดลงมา เหมือนจับลูกจริง)
   *   - **มุม** อยู่ในชั้นของจุดยอดเดียว → เสนอ move ตัวใหญ่ตัวเดียว
   *   - **ขอบ** คาบอยู่สองชั้น → เสนอสองตัว แล้วให้ตัววาดเลือกตามทิศที่ลาก
   */
  dragCandidates(pieceId: number): DragCandidate[] {
    const coord = this.lattice.coords[pieceId]!;
    const candidates: DragCandidate[] = [];
    for (let vertex = 0; vertex < 4; vertex++) {
      const along = dot(coord, VERTEX_AXES[vertex]!);
      if (along < WIDE_LAYER_MIN_DOT) continue;
      const tipOnly = along >= TIP_LAYER_MIN_DOT;
      candidates.push({
        axis: normalize(matApply(ORIENTATION, VERTEX_AXES[vertex]!)),
        move: this.nameFor(vertex, tipOnly, 1),
      });
    }
    return candidates;
  }

  /**
   * **แก้เสร็จ = ทุกชิ้นกลับบ้านและหันตรงหมด**
   *
   * ต่างจาก Pyramorphix ที่ยกเว้นทิศทางของชิ้นกลางหน้า — ของ Pyraminx ทุกชิ้นมีสติกเกอร์
   * มากกว่าหนึ่งสี (ยอดกับมุมเห็น 3 หน้า ขอบเห็น 2 หน้า) ท่าที่ผิดจึงมองเห็นได้หมด
   */
  isSolved(): boolean {
    return this.lattice.isHome();
  }
}
