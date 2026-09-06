/**
 * ตรวจว่าโมเดลชิ้นส่วนของ **ลูกบาศก์ที่เราวาดเอง** ตรงกับ KPuzzle ของ cubing.js เป๊ะ
 * (เฟส 3.5 ก้อนที่ 1 — ลอกแนวมาจาก `verify-pyramorphix.ts`)
 *
 * ทำไมต้องมี: ADR-026 เลือกวิธี "หมุน mesh ตาม move เหมือนลูกจริง" ไม่ได้ render จาก KPattern
 * ภาพกับตรรกะจึงเป็นคนละชุดข้อมูลที่เดินคู่กันไป — ไฟล์นี้คือสิ่งเดียวที่รับประกันว่าไม่หลุดกัน
 *
 * รัน: `npm run verify:cube`
 */
import { puzzles } from 'cubing/puzzles';
import type { KPattern, KPuzzle } from 'cubing/kpuzzle';
import { ALLOWED_MOVES, inverseMove } from '../src/cube/moves.ts';
import { NxNCubeModel } from '../src/cube/nxn/cube-model.ts';

let failures = 0;
function check(label: string, ok: boolean, detail = ''): void {
  if (!ok) failures++;
  console.log(`${ok ? '  ✓' : '  ✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}

/**
 * หน้า → (แกน, ฝั่งของแกน) และสไลซ์ → แกนที่ระนาบของมันตั้งฉากด้วย
 * เขียนซ้ำที่นี่ **ตั้งใจ** — ถ้า import ตารางมาจากไฟล์ที่กำลังตรวจ ก็เท่ากับตรวจโค้ดด้วยตัวมันเอง
 */
const FACE_AXIS: Record<string, [number, number]> = {
  R: [0, 1],
  L: [0, -1],
  U: [1, 1],
  D: [1, -1],
  F: [2, 1],
  B: [2, -1],
};
const SLICE_AXIS: Record<string, number> = { M: 0, E: 1, S: 2 };

function same(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function numPiecesOf(kpuzzle: KPuzzle, orbit: string): number {
  return kpuzzle.definition.orbits.find((o) => o.orbitName === orbit)!.numPieces;
}

function piecesAfter(kpuzzle: KPuzzle, move: string, orbit: string): number[] {
  return [...kpuzzle.defaultPattern().applyMove(move).patternData[orbit]!.pieces];
}

/** ช่องไหนของ orbit นี้ถูก move นี้ย้ายที่บ้าง */
function movedSlots(kpuzzle: KPuzzle, move: string, orbit: string): Set<number> {
  const pieces = piecesAfter(kpuzzle, move, orbit);
  return new Set(pieces.map((_, slot) => slot).filter((slot) => pieces[slot] !== slot));
}

/**
 * สะพานระหว่าง orbit ของ KPuzzle กับชิ้นส่วนในโมเดลของเรา
 * (ช่องที่ `i` ของ orbit อยู่ที่พิกัด `coords[i]` ในโมเดล)
 */
function bridge(model: NxNCubeModel, coords: readonly (readonly number[])[]) {
  const latticeSlots = coords.map((c) => model.lattice.slotOf(c));
  const orbitOfLattice = new Map<number, number>(latticeSlots.map((ls, i) => [ls, i]));
  return {
    /** สถานะของโมเดลในรูปแบบเดียวกับ `patternData[orbit].pieces` */
    pieces(current: NxNCubeModel): number[] {
      const at = current.lattice.toPiecesArray();
      return latticeSlots.map((ls) => orbitOfLattice.get(at[ls]!)!);
    },
    /** ท่าหมุนของชิ้นที่นั่งอยู่ในแต่ละช่องของ orbit (เขียนเป็นสตริงไว้เทียบ) */
    rotations(current: NxNCubeModel): string[] {
      const at = current.lattice.toPiecesArray();
      return latticeSlots.map((ls) => current.lattice.rotations[at[ls]!]!.join(','));
    },
  };
}

type Bridge = ReturnType<typeof bridge>;

/**
 * หาว่าช่องแต่ละช่องของ orbit อยู่พิกัดไหน — **คำนวณจากตัว KPuzzle เอง ไม่ hard-code**
 * (บทเรียนจาก ADR-019: ลำดับ index ของ cubing.js ไม่ตรงกับที่คนทั่วไปคิด และเปลี่ยนได้เมื่ออัปเวอร์ชัน)
 *
 * มุม/ขอบ หาได้ตรง ๆ: ช่องที่ move `U` ย้าย = อยู่ชั้น y บวก · `R` = x บวก · ฯลฯ
 */
function deriveOrbitCoords(kpuzzle: KPuzzle, orbit: string, outer: number): number[][] {
  const coords: number[][] = Array.from({ length: numPiecesOf(kpuzzle, orbit) }, () => [0, 0, 0]);
  for (const [face, [axis, sign]] of Object.entries(FACE_AXIS)) {
    for (const slot of movedSlots(kpuzzle, face, orbit)) coords[slot]![axis] = sign * outer;
  }
  return coords;
}

/**
 * พิกัดของ **ชิ้นกลางหน้า** — cubing.js ไม่ย้ายมันเลยตอนหมุนหน้า (มันหมุนอยู่กับที่)
 * วิธีข้างบนจึงได้ [0,0,0] หมด ต้องหาอีกทาง
 *
 * แกนหาได้จากสไลซ์ แต่ **ฝั่งหาจากการเรียงสับเปลี่ยนอย่างเดียวไม่ได้** เพราะ orbit ของชิ้นกลาง
 * ไม่มีข้อมูลว่าอันไหนคือ "บน" (ต้องอ้างอิงกับ orbit อื่นถึงจะรู้)
 *
 * จึงลองทั้ง 8 แบบแล้วคัดเอาแบบที่เข้ากันได้กับ **ทุก move** — โมเดลเราผิดเมื่อไหร่จะไม่เหลือ
 * สักแบบ = ฟ้องทันที
 *
 * ⚠️ ปกติจะเหลือ **มากกว่าหนึ่งแบบ** และไม่ใช่เรื่องผิด: การพลิกลูกทั้งลูก 180° รอบแกนหนึ่ง
 * สลับป้ายชิ้นกลางเป็นคู่ ๆ แต่ให้การเรียงสับเปลี่ยนชุดเดิมเป๊ะ ข้อมูลใน orbit จึงแยกไม่ออก
 * (และไม่จำเป็นต้องแยก — renderer ไม่เคยอ่าน orbit ของชิ้นกลาง ทุกแบบที่เหลือให้ผลตรวจเท่ากัน)
 */
function deriveCenterCoords(
  kpuzzle: KPuzzle,
  orbit: string,
  outer: number,
  model: NxNCubeModel,
  moves: readonly string[],
): number[][] {
  const numPieces = numPiecesOf(kpuzzle, orbit);

  // แกนของชิ้นกลาง = แกนเดียวที่สไลซ์ของมัน "ไม่" ย้ายชิ้นนี้ (ชิ้นนั้นนั่งอยู่บนแกนพอดี)
  const byAxis: number[][] = [[], [], []];
  for (let slot = 0; slot < numPieces; slot++) {
    const axes = Object.entries(SLICE_AXIS)
      .filter(([slice]) => !movedSlots(kpuzzle, slice, orbit).has(slot))
      .map(([, axis]) => axis);
    if (axes.length !== 1) {
      throw new Error(`ชิ้นกลางช่อง ${slot} หาแกนไม่ได้ (ได้ ${axes.length} แกน)`);
    }
    byAxis[axes[0]!]!.push(slot);
  }
  if (byAxis.some((slots) => slots.length !== 2)) {
    throw new Error(
      `แต่ละแกนต้องมีชิ้นกลาง 2 ชิ้น แต่ได้ ${byAxis.map((s) => s.length).join('/')}`,
    );
  }

  const consistent: number[][][] = [];
  for (let mask = 0; mask < 8; mask++) {
    const coords: number[][] = Array.from({ length: numPieces }, () => [0, 0, 0]);
    for (let axis = 0; axis < 3; axis++) {
      const [first, second] = byAxis[axis] as [number, number];
      const positive = ((mask >> axis) & 1) === 1 ? second : first;
      coords[positive]![axis] = outer;
      coords[positive === first ? second : first]![axis] = -outer;
    }

    const candidate = bridge(model, coords);
    const ok = moves.every((move) => {
      model.reset();
      model.apply(move);
      return same(candidate.pieces(model), piecesAfter(kpuzzle, move, orbit));
    });
    if (ok) consistent.push(coords);
  }
  model.reset();

  if (consistent.length === 0) {
    throw new Error('หาพิกัดชิ้นกลางไม่ได้เลยสักแบบ — โมเดลกับ KPuzzle ไม่ตรงกันแล้ว');
  }
  console.log(`  (ชิ้นกลาง: การติดป้ายที่เข้ากันได้ ${consistent.length} แบบ — เลือกแบบแรก)`);
  return consistent[0]!;
}

// ---------------------------------------------------------------- ตัวตรวจหลัก

async function verify(puzzleId: string, n: number, moves: readonly string[]): Promise<void> {
  console.log(
    `\n${'='.repeat(64)}\n${puzzleId} — ${n} ชั้น · ${moves.length} move\n${'='.repeat(64)}`,
  );

  const kpuzzle = await puzzles[puzzleId]!.kpuzzle();
  const model = new NxNCubeModel(n);
  const outer = n - 1;

  console.log('พิกัดของแต่ละ orbit (คำนวณจาก KPuzzle ไม่ได้ hard-code):');
  const bridges = new Map<string, Bridge>();
  for (const { orbitName } of kpuzzle.definition.orbits) {
    const rough = deriveOrbitCoords(kpuzzle, orbitName, outer);
    const isCenters = rough.every((c) => c.every((v) => v === 0));
    const coords = isCenters ? deriveCenterCoords(kpuzzle, orbitName, outer, model, moves) : rough;
    console.log(`  ${orbitName.padEnd(8)} ${JSON.stringify(coords)}`);
    bridges.set(orbitName, bridge(model, coords));
  }

  console.log('\n1) move ทุกตัวให้ผลตรงกับ KPuzzle ครบทุก orbit');
  for (const move of moves) {
    model.reset();
    model.apply(move);
    const wrong = [...bridges.entries()]
      .filter(([orbit, b]) => !same(b.pieces(model), piecesAfter(kpuzzle, move, orbit)))
      .map(([orbit]) => orbit);
    check(move.padEnd(4), wrong.length === 0, wrong.join(', '));
  }

  console.log('\n2) แปลงกลับ (แกน + ชั้น + มุม → ชื่อ move) ได้ชื่อเดิม');
  for (const move of moves) {
    const { axis, layers, quarters } = model.parse(move);
    if (layers.length > 1) continue; // move สองชั้นไม่มีชื่อของชั้นเดียว
    const back = model.nameFor(axis, layers[0]!, quarters);
    check(`${move.padEnd(4)} → ${back}`, back === move);
  }

  console.log('\n3) เดินสุ่ม 5000 ก้าว — ตำแหน่งและทิศทางของชิ้นต้องไม่คลาดกันเลย');
  {
    model.reset();
    let pattern = kpuzzle.defaultPattern();
    let mismatch = '';

    /**
     * ทิศทางของชิ้น: KPuzzle เก็บเป็นเลข 0..k−1 ตามธรรมเนียมของมันเอง เราเก็บเป็นเมทริกซ์หมุน
     * แปลงตรง ๆ ไม่ได้เพราะไม่รู้ธรรมเนียมนั้น — แต่ **(ช่อง + เมทริกซ์) ชี้ขาดตัวเลขได้ตัวเดียว**
     * (เมทริกซ์บอกว่าชิ้นไหนมาจากไหนและบิดไปเท่าไหร่) ถ้าคู่เดิมได้เลขไม่เท่าเดิม = หลุดแล้ว
     *
     * ทางกลับกันไม่จริง จึงไม่ตรวจ: ช่องเดิม + เลขเดิม เกิดจากคนละชิ้นที่หมุนคนละท่าได้
     */
    const oriOfRotation = new Map<string, number>();

    for (let step = 0; step < 5000 && !mismatch; step++) {
      const move = moves[Math.floor(Math.random() * moves.length)]!;
      pattern = pattern.applyMove(move);
      model.apply(move);

      for (const [orbit, b] of bridges) {
        const data = pattern.patternData[orbit]!;
        if (!same(b.pieces(model), [...data.pieces])) {
          mismatch = `ตำแหน่งคลาดที่ก้าวที่ ${step} (${move}, orbit ${orbit})`;
          break;
        }

        const rotations = b.rotations(model);
        for (let slot = 0; slot < rotations.length; slot++) {
          const ori = data.orientation[slot]!;
          const key = `${orbit}|${slot}|${rotations[slot]}`;
          const seen = oriOfRotation.get(key);
          if (seen !== undefined && seen !== ori) {
            mismatch = `ทิศทางคลาดที่ก้าวที่ ${step} (${move}, ${orbit} ช่อง ${slot}: ${seen} ≠ ${ori})`;
            break;
          }
          oriOfRotation.set(key, ori);
        }
        if (mismatch) break;
      }
    }
    check(
      'ตรงกันทุกก้าว',
      mismatch === '',
      mismatch || `จับคู่ทิศทางได้ ${oriOfRotation.size} แบบ`,
    );
  }

  /** กติกา "แก้เสร็จ" ที่แอปใช้จริง — ยอมให้ทั้งลูกถูกหมุนไปทั้งก้อน (ADR-030) */
  const solvedLoosely = (pattern: KPattern): boolean =>
    pattern.experimentalIsSolved({ ignorePuzzleOrientation: true, ignoreCenterOrientation: true });

  console.log('\n4) "แก้เสร็จ" ของภาพกับของ KPuzzle ตัดสินตรงกัน');
  {
    let disagreements = 0;
    let solvedSeen = 0;
    const solvedPattern = kpuzzle.defaultPattern();

    // สุ่มเดินไปแล้วเดินย้อนกลับ เพื่อให้ "ผ่านสถานะแก้เสร็จ" จริง ๆ หลายพันครั้ง
    // (ถ้าสุ่มเดินอย่างเดียวจะแทบไม่มีทางเจอสถานะแก้เสร็จเลย ข้อนี้ก็จะไม่ได้ตรวจอะไร)
    for (let trial = 0; trial < 1000; trial++) {
      model.reset();
      let pattern = solvedPattern;
      const walk: string[] = [];
      for (let i = 0; i < 1 + Math.floor(Math.random() * 6); i++) {
        walk.push(moves[Math.floor(Math.random() * moves.length)]!);
      }

      for (const move of [...walk, ...walk.map(inverseMove).reverse()]) {
        pattern = pattern.applyMove(move);
        model.apply(move);
        const logicallySolved = pattern.isIdentical(solvedPattern);
        if (model.lattice.isHome() !== logicallySolved) disagreements++;
        if (logicallySolved) solvedSeen++;
        // กติกาที่แอปใช้จริง — ยอมให้ทั้งลูกถูกหมุนไปทั้งก้อน (ADR-030)
        if ((model.lattice.homeRotation() !== null) !== solvedLoosely(pattern)) disagreements++;
      }
    }
    check(
      'ไม่มีก้าวไหนที่ภาพกับตรรกะตัดสินต่างกัน',
      disagreements === 0,
      `เจอสถานะแก้เสร็จ ${solvedSeen} ครั้ง`,
    );
  }

  console.log('\n4ก) ลูกที่ครบทุกหน้าแต่ถูกหมุนทั้งก้อน ต้องนับว่าแก้เสร็จ (ADR-030)');
  {
    // move หมุนชั้นล้วน ๆ ที่ประกอบกันเป็นการหมุนทั้งลูก — ต้นเหตุที่นาฬิกาไม่ยอมหยุด
    const wholeRotations = n === 2 ? ["U D'", "R L'", "F B'"] : ["Uw D'", "Rw L'", "Fw B'"];
    let bad = '';
    for (const alg of wholeRotations) {
      model.reset();
      let pattern = kpuzzle.defaultPattern();
      for (const move of alg.split(' ')) {
        model.apply(move);
        pattern = pattern.applyMove(move);
      }
      if (pattern.isIdentical(kpuzzle.defaultPattern())) bad = `"${alg}" ไม่ได้หมุนทั้งลูกจริง`;
      else if (!solvedLoosely(pattern)) bad = `KPuzzle บอกว่า "${alg}" ยังไม่เสร็จ`;
      else if (model.lattice.homeRotation() === null) bad = `โมเดลบอกว่า "${alg}" ยังไม่เสร็จ`;
    }
    check('หมุนทั้งลูกแล้วยังนับว่าแก้เสร็จทั้งสองฝั่ง', bad === '', bad);
    model.reset();
  }

  console.log('\n5) ลากชิ้นไหนก็ได้ move ที่ถูกกติกา และ move นั้นหมุนชิ้นนั้นจริง');
  {
    model.reset();
    const allowed = new Set(moves);
    let bad = '';
    for (let pieceId = 0; pieceId < model.pieceCount && !bad; pieceId++) {
      const candidates = model.dragCandidates(pieceId);
      if (candidates.length !== 3) {
        bad = `ชิ้น ${pieceId} เสนอ ${candidates.length} แกน (ต้องได้ 3)`;
        break;
      }
      for (const { move } of candidates) {
        if (!allowed.has(move) || !allowed.has(inverseMove(move))) {
          bad = `ชิ้น ${pieceId} เสนอ move นอก whitelist: ${move}`;
        } else if (!model.turnFor(move).pieceIds.includes(pieceId)) {
          bad = `ชิ้น ${pieceId} เสนอ ${move} แต่ move นั้นไม่หมุนชิ้นนี้`;
        }
        if (bad) break;
      }
    }
    check('ทุกชิ้นเสนอครบ 3 แกน และหมุนตัวเองจริง', bad === '', bad);
  }
}

await verify('2x2x2', 2, ALLOWED_MOVES['2x2x2']);
await verify('3x3x3', 3, ALLOWED_MOVES['3x3x3']);

console.log(failures === 0 ? '\nผ่านทุกข้อ ✅' : `\nไม่ผ่าน ${failures} ข้อ ❌`);
process.exit(failures === 0 ? 0 : 1);
