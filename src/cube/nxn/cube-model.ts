/**
 * โมเดลตรรกะของ **ลูกบาศก์ N ชั้น** — ใช้ร่วมกัน 3 ประเภท (เฟส 3.5 ก้อนที่ 1)
 *
 *   - `2x2x2`       → N = 2
 *   - `3x3x3`       → N = 3 (มี move สองชั้น `Uw` และสไลซ์ `M E S` เพิ่มมา)
 *   - `pyramorphix` → N = 2 เหมือนกันทุกอย่าง **ต่างแค่รูปทรงกับกติกาแก้เสร็จ** (ADR-019)
 *
 * ระบบพิกัด: แกน x = R บวก, y = U บวก, z = F บวก · ค่าพิกัดเดินทีละ 2 (ดู `LatticePieceModel`)
 *
 * ไฟล์นี้ **ห้าม import three หรือ DOM** — `scripts/verify-cube.ts` รันบน Node เปล่า ๆ
 */
import { LatticePieceModel, type Mat3 } from '../three/lattice.ts';
import type { DragCandidate, PuzzleModel, TurnSpec } from '../three/model.ts';

/**
 * หน้า/สไลซ์ → แกนที่หมุนรอบ + "ทิศที่ยึด"
 *
 * `follow` คือฝั่งของแกนที่ move นี้หมุนตาม: `U` ตามฝั่ง +y, `D` ตามฝั่ง −y
 * สไลซ์ยึดตามหน้าที่มันเดินตามตามธรรมเนียม: `M` ตาม `L` · `E` ตาม `D` · `S` ตาม `F`
 *
 * "หมุนตามเข็มเมื่อมองจากด้านนอกของหน้านั้น" = หมุน −90° รอบแกนฝั่งบวก ตามกฎมือขวา
 * ฝั่งลบจึงกลับทิศ → เขียนรวบเป็น `quarters = -follow × ตัวคูณ`
 */
const AXIS_OF: Record<string, { axis: number; follow: number }> = {
  R: { axis: 0, follow: 1 },
  L: { axis: 0, follow: -1 },
  U: { axis: 1, follow: 1 },
  D: { axis: 1, follow: -1 },
  F: { axis: 2, follow: 1 },
  B: { axis: 2, follow: -1 },
  M: { axis: 0, follow: -1 },
  E: { axis: 1, follow: -1 },
  S: { axis: 2, follow: 1 },
};

const FACE_LETTERS = ['U', 'D', 'L', 'R', 'F', 'B'] as const;
const SLICE_LETTERS = ['M', 'E', 'S'] as const;

/** ตัวหนังสือของหน้าที่อยู่ฝั่งนั้นของแกน */
const FACE_AT = new Map<string, string>(
  FACE_LETTERS.map((letter) => [`${AXIS_OF[letter]!.axis}:${AXIS_OF[letter]!.follow}`, letter]),
);
/** ตัวหนังสือของสไลซ์ที่อยู่กลางแกนนั้น */
const SLICE_AT = new Map<number, string>(
  SLICE_LETTERS.map((letter) => [AXIS_OF[letter]!.axis, letter]),
);

const SUFFIX_MULTIPLIER: Record<string, number> = { '': 1, "'": -1, '2': 2 };

const UNIT_AXES: readonly (readonly number[])[] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

export interface ParsedMove {
  axis: number;
  /** ค่าพิกัดตามแกนของชั้นที่หมุน (มากกว่าหนึ่งค่า = move สองชั้น) */
  layers: number[];
  /** มุมหมุนเป็นจำนวนเท่าของ 90° ตามกฎมือขวา */
  quarters: number;
}

/** `Uw` `u` = สองชั้น · `M E S` = สไลซ์กลาง · ที่เหลือ = หน้าเดียว */
const MOVE_PATTERN = /^([UDLRFBMES])(w?)('|2)?$/;
const LOWERCASE_WIDE = /^([udlrfb])('|2)?$/;

export class NxNCubeModel implements PuzzleModel {
  readonly n: number;
  /** ค่าพิกัดของชั้นนอกสุด (2 ชั้น → 1, 3 ชั้น → 2) */
  readonly outer: number;
  readonly lattice: LatticePieceModel;

  /**
   * @param n จำนวนชั้น (รองรับ 2 กับ 3)
   * @param homeCoords ลำดับชิ้นที่กำหนดเอง — Pyramorphix ส่งลำดับช่องของ KPuzzle เข้ามา
   *                   เพื่อให้เทียบกับ `patternData.CORNERS` ได้ตรง ๆ
   */
  constructor(n: number, homeCoords?: readonly (readonly number[])[]) {
    if (n !== 2 && n !== 3) throw new Error(`ยังไม่รองรับลูกบาศก์ ${n} ชั้น`);
    this.n = n;
    this.outer = n - 1;
    this.lattice = new LatticePieceModel(homeCoords ?? NxNCubeModel.homeCoordsFor(n));
  }

  /** พิกัดบ้านของทุกชิ้นที่ **มองเห็นได้** (3 ชั้นตัดแกนกลางที่มองไม่เห็นทิ้ง) */
  static homeCoordsFor(n: number): number[][] {
    const outer = n - 1;
    const values: number[] = [];
    for (let i = 0; i < n; i++) values.push(-outer + 2 * i);

    const coords: number[][] = [];
    for (const x of values) {
      for (const y of values) {
        for (const z of values) {
          const hidden = Math.abs(x) < outer && Math.abs(y) < outer && Math.abs(z) < outer;
          if (!hidden) coords.push([x, y, z]);
        }
      }
    }
    return coords;
  }

  get pieceCount(): number {
    return this.lattice.pieceCount;
  }

  rotationOf(pieceId: number): Mat3 {
    return this.lattice.rotations[pieceId]!;
  }

  // ---------------------------------------------------------------- move

  /** แยก move ออกเป็นแกน/ชั้น/มุม — public เพราะ `scripts/verify-cube.ts` ต้องใช้ตรวจ */
  parse(move: string): ParsedMove {
    const lower = LOWERCASE_WIDE.exec(move);
    const match = lower
      ? ([lower[1]!.toUpperCase(), 'w', lower[2]] as const)
      : (() => {
          const m = MOVE_PATTERN.exec(move);
          if (!m) throw new Error(`ไม่รู้จัก move: ${move}`);
          return [m[1]!, m[2] ?? '', m[3]] as const;
        })();

    const [letter, wide, suffix] = match;
    const spec = AXIS_OF[letter]!;
    const multiplier = SUFFIX_MULTIPLIER[suffix ?? ''];
    if (multiplier === undefined) throw new Error(`ไม่รู้จัก move: ${move}`);

    const isSlice = (SLICE_LETTERS as readonly string[]).includes(letter);
    if (isSlice && wide) throw new Error(`ไม่รู้จัก move: ${move}`);
    if (isSlice && this.n % 2 === 0) {
      throw new Error(`move "${move}" ใช้กับลูกบาศก์ ${this.n} ชั้นไม่ได้ (ไม่มีชั้นกลาง)`);
    }
    if (wide && this.n < 3) {
      throw new Error(`move "${move}" ใช้กับลูกบาศก์ ${this.n} ชั้นไม่ได้ (ไม่มีชั้นที่สอง)`);
    }

    const layers = isSlice
      ? [0]
      : wide
        ? [spec.follow * this.outer, spec.follow * (this.outer - 2)]
        : [spec.follow * this.outer];

    return { axis: spec.axis, layers, quarters: -spec.follow * multiplier };
  }

  turnFor(move: string): TurnSpec {
    const { axis, layers, quarters } = this.parse(move);
    return {
      axis: UNIT_AXES[axis]!,
      angle: (Math.PI / 2) * quarters,
      pieceIds: this.lattice.piecesInLayers(axis, layers),
    };
  }

  apply(move: string): void {
    const { axis, layers, quarters } = this.parse(move);
    this.lattice.rotate(axis, quarters, this.lattice.piecesInLayers(axis, layers));
  }

  reset(): void {
    this.lattice.reset();
  }

  /**
   * ชื่อ move ของการหมุนชั้นเดียว — ทางกลับของ `parse`
   * ใช้ตอนแปลงการลากนิ้วเป็น move และใน `scripts/verify-cube.ts`
   *
   * คืน `null` ถ้าชั้นนั้นไม่มีชื่อเรียก (ชั้นในของลูกบาศก์ตั้งแต่ 4 ชั้นขึ้นไป)
   */
  nameFor(axis: number, layerValue: number, quarters: number): string | null {
    const letter =
      Math.abs(layerValue) === this.outer
        ? FACE_AT.get(`${axis}:${Math.sign(layerValue)}`)
        : layerValue === 0 && this.n % 2 === 1
          ? SLICE_AT.get(axis)
          : undefined;
    if (!letter) return null;

    const multiplier = quarters / -AXIS_OF[letter]!.follow;
    if (multiplier === 1) return letter;
    if (multiplier === -1) return `${letter}'`;
    if (Math.abs(multiplier) === 2) return `${letter}2`;
    return null;
  }

  dragCandidates(pieceId: number): DragCandidate[] {
    const coord = this.lattice.coords[pieceId]!;
    const candidates: DragCandidate[] = [];
    for (let axis = 0; axis < 3; axis++) {
      const move = this.nameFor(axis, coord[axis]!, 1);
      if (move) candidates.push({ axis: UNIT_AXES[axis]!, move });
    }
    return candidates;
  }
}
