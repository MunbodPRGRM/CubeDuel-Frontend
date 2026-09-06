/**
 * ตรวจว่าโมเดล **Pyraminx** ที่เราเขียนเอง ตรงกับ KPuzzle ของ cubing.js เป๊ะ
 * (เฟส 3.5 ก้อนที่ 2 — ประเภทสุดท้ายที่ย้ายออกจาก `<twisty-player>`)
 *
 * Pyraminx เป็นจุดเสี่ยงที่สุดของเฟสนี้เพราะ **แกนหมุนทั้งสี่ไม่ตรงกับ x/y/z** และมีชิ้น
 * 3 ชนิด (ยอด / มุม / ขอบ) ที่ต้องจับคู่กับ orbit `CORNERS2` / `CORNERS` / `EDGES` ให้ถูก
 * ไฟล์นี้พิสูจน์ว่าจับคู่ถูกจริงโดย **ไม่ hard-code หมายเลขช่องของ cubing.js เลยสักตัว**
 *
 * รัน: `npm run verify:pyraminx`
 */
import type { KPuzzle } from 'cubing/kpuzzle';
import { puzzles } from 'cubing/puzzles';
import { ALLOWED_MOVES, inverseMove } from '../src/cube/moves.ts';
import {
  orientedVertexAxis,
  PYRAMINX_FACES,
  stickerCount,
} from '../src/cube/pyraminx/pyraminx-geometry.ts';
import {
  PYRAMINX_PIECES,
  PyraminxModel,
  VERTEX_NAMES,
} from '../src/cube/pyraminx/pyraminx-model.ts';

const moves = ALLOWED_MOVES.pyraminx;
const WIDE_MOVES = VERTEX_NAMES.map((name) => name as string);
const TIP_MOVES = VERTEX_NAMES.map((name) => name.toLowerCase());

let failures = 0;
function check(label: string, ok: boolean, detail = ''): void {
  if (!ok) failures++;
  console.log(`${ok ? '  ✓' : '  ✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}

function same(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

const kpuzzle: KPuzzle = await puzzles['pyraminx']!.kpuzzle();

function dataAfter(move: string, orbit: string) {
  return kpuzzle.defaultPattern().applyMove(move).patternData[orbit]!;
}

/** ช่องไหนของ orbit ถูก move นี้ **แตะ** บ้าง (ย้ายที่ก็ได้ หมุนอยู่กับที่ก็ได้) */
function touchedSlots(move: string, orbit: string): number[] {
  const { pieces, orientation } = dataAfter(move, orbit);
  const slots: number[] = [];
  for (let slot = 0; slot < pieces.length; slot++) {
    if (pieces[slot] !== slot || orientation[slot] !== 0) slots.push(slot);
  }
  return slots;
}

// ---------------------------------------------------------------- สร้างสะพานกับ KPuzzle

/**
 * จุดยอดของเรา ↔ ช่องของ KPuzzle — หาจาก **ชื่อ move** ล้วน ๆ
 * (move `U` ของเราต้องหมายถึงจุดยอดเดียวกับ move `U` ของ cubing.js เสมอ)
 */
function slotOfVertex(orbit: string, moveNames: readonly string[]): number[] {
  return moveNames.map((move, vertex) => {
    const touched = touchedSlots(move, orbit);
    if (touched.length !== 1) {
      throw new Error(
        `move "${move}" แตะ ${orbit} ${touched.length} ช่อง (ต้องได้ช่องเดียว = จุดยอด ${VERTEX_NAMES[vertex]})`,
      );
    }
    return touched[0]!;
  });
}

const kCornerSlot = slotOfVertex('CORNERS', WIDE_MOVES);
const kTipSlot = slotOfVertex('CORNERS2', TIP_MOVES);

/** ขอบแต่ละช่องของ KPuzzle คาบอยู่ระหว่างจุดยอดคู่ไหน — ดูจากว่า move ของยอดไหนแตะมันบ้าง */
const kEdgeVertices = Array.from({ length: 6 }, (_, slot) =>
  WIDE_MOVES.map((move, vertex) => ({ move, vertex }))
    .filter(({ move }) => touchedSlots(move, 'EDGES').includes(slot))
    .map(({ vertex }) => vertex),
);

const model = new PyraminxModel();

/**
 * สะพานของ orbit หนึ่ง: ช่องที่ `k` ของ KPuzzle คือชิ้น id ไหนของเรา
 * (`homeIdOfKSlot[k]` = ชิ้นที่ *ควร* อยู่ช่องนั้นตอนแก้เสร็จ)
 */
function bridgeFor(homeIdOfKSlot: readonly number[]) {
  const latticeSlots = homeIdOfKSlot.map((id) => model.lattice.slotOf(PYRAMINX_PIECES[id]!.coord));
  const kSlotOfPiece = new Map(homeIdOfKSlot.map((id, kSlot) => [id, kSlot]));
  return {
    /** สถานะของโมเดลในรูปแบบเดียวกับ `patternData[orbit].pieces` */
    pieces(): number[] {
      const at = model.lattice.toPiecesArray();
      return latticeSlots.map((slot) => kSlotOfPiece.get(at[slot]!)!);
    },
    /** ท่าหมุนของชิ้นที่นั่งอยู่ในแต่ละช่อง (เขียนเป็นสตริงไว้เทียบ) */
    rotations(): string[] {
      const at = model.lattice.toPiecesArray();
      return latticeSlots.map((slot) => model.lattice.rotations[at[slot]!]!.join(','));
    },
  };
}

const cornerHomeIds = kCornerSlot.map((_, kSlot) => {
  const vertex = kCornerSlot.findIndex((slot) => slot === kSlot);
  return PYRAMINX_PIECES.findIndex((p) => p.kind === 'corner' && p.vertices[0] === vertex);
});
const tipHomeIds = kTipSlot.map((_, kSlot) => {
  const vertex = kTipSlot.findIndex((slot) => slot === kSlot);
  return PYRAMINX_PIECES.findIndex((p) => p.kind === 'tip' && p.vertices[0] === vertex);
});
const edgeHomeIds = kEdgeVertices.map((vertices) =>
  PYRAMINX_PIECES.findIndex(
    (p) =>
      p.kind === 'edge' &&
      p.vertices.length === vertices.length &&
      p.vertices.every((v) => vertices.includes(v)),
  ),
);

const bridges = new Map([
  ['CORNERS', bridgeFor(cornerHomeIds)],
  ['CORNERS2', bridgeFor(tipHomeIds)],
  ['EDGES', bridgeFor(edgeHomeIds)],
]);

console.log('จับคู่ช่องของ KPuzzle กับชิ้นของเรา (คำนวณจาก KPuzzle ไม่ได้ hard-code):');
console.log(`  CORNERS  (มุม)  ${JSON.stringify(kCornerSlot)} ← จุดยอด ${VERTEX_NAMES.join('/')}`);
console.log(`  CORNERS2 (ยอด)  ${JSON.stringify(kTipSlot)}`);
console.log(
  `  EDGES    (ขอบ)  ${kEdgeVertices.map((vs) => vs.map((v) => VERTEX_NAMES[v]).join('')).join(' ')}`,
);

check(
  'ทุก orbit จับคู่ครบ ไม่มีชิ้นที่หาคู่ไม่เจอ',
  [...cornerHomeIds, ...tipHomeIds, ...edgeHomeIds].every((id) => id >= 0) &&
    kEdgeVertices.every((vs) => vs.length === 2),
);

// ---------------------------------------------------------------- ตัวตรวจหลัก

console.log(`\n1) move ทั้ง ${moves.length} ตัว ให้ผลตรงกับ KPuzzle ครบทุก orbit`);
for (const move of moves) {
  model.reset();
  model.apply(move);
  const wrong = [...bridges.entries()]
    .filter(([orbit, b]) => !same(b.pieces(), [...dataAfter(move, orbit).pieces]))
    .map(([orbit]) => orbit);
  check(move.padEnd(3), wrong.length === 0, wrong.join(', '));
}

console.log('\n2) แปลงกลับ (จุดยอด + ชั้น + ทิศ → ชื่อ move) ได้ชื่อเดิม');
for (const move of moves) {
  const { vertex, tipOnly, direction } = model.parse(move);
  const back = model.nameFor(vertex, tipOnly, direction);
  check(`${move.padEnd(3)} → ${back}`, back === move);
}

console.log('\n3) เดินสุ่ม 5000 ก้าว — ตำแหน่งและทิศทางของชิ้นต้องไม่คลาดกันเลย');
{
  model.reset();
  let pattern = kpuzzle.defaultPattern();
  let mismatch = '';

  /**
   * ทิศทางของชิ้น: KPuzzle เก็บเป็นเลข 0..k−1 ตามธรรมเนียมของมันเอง เราเก็บเป็นเมทริกซ์หมุน
   * แปลงตรง ๆ ไม่ได้เพราะไม่รู้ธรรมเนียมนั้น — แต่ **(ช่อง + เมทริกซ์) ชี้ขาดเลขได้ตัวเดียว**
   * ถ้าคู่เดิมได้เลขไม่เท่าเดิมเมื่อไหร่ = ภาพกับตรรกะหลุดจากกันแล้ว
   */
  const oriOfRotation = new Map<string, number>();

  for (let step = 0; step < 5000 && !mismatch; step++) {
    const move = moves[Math.floor(Math.random() * moves.length)]!;
    pattern = pattern.applyMove(move);
    model.apply(move);

    for (const [orbit, b] of bridges) {
      const data = pattern.patternData[orbit]!;
      if (!same(b.pieces(), [...data.pieces])) {
        mismatch = `ตำแหน่งคลาดที่ก้าวที่ ${step} (${move}, orbit ${orbit})`;
        break;
      }

      const rotations = b.rotations();
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
  check('ตรงกันทุกก้าว', mismatch === '', mismatch || `จับคู่ทิศทางได้ ${oriOfRotation.size} แบบ`);
}

console.log('\n4) "แก้เสร็จ" ของภาพกับของ KPuzzle ตัดสินตรงกัน');
{
  let disagreements = 0;
  let solvedSeen = 0;
  const solvedPattern = kpuzzle.defaultPattern();

  // สุ่มเดินไปแล้วเดินย้อนกลับ เพื่อให้ "ผ่านสถานะแก้เสร็จ" จริง ๆ หลายพันครั้ง
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
      if (model.isSolved() !== logicallySolved) disagreements++;
      if (logicallySolved) solvedSeen++;
    }
  }
  check(
    'ไม่มีก้าวไหนที่ภาพกับตรรกะตัดสินต่างกัน',
    disagreements === 0,
    `เจอสถานะแก้เสร็จ ${solvedSeen} ครั้ง`,
  );
}

console.log('\n5) ลากชิ้นไหนก็ได้ move ที่ถูกกติกา และ move นั้นหมุนชิ้นนั้นจริง');
{
  model.reset();
  const allowed = new Set(moves);
  const expectedCandidates = { tip: 1, corner: 1, edge: 2 } as const;
  let bad = '';
  for (let pieceId = 0; pieceId < model.pieceCount && !bad; pieceId++) {
    const kind = PYRAMINX_PIECES[pieceId]!.kind;
    const candidates = model.dragCandidates(pieceId);
    if (candidates.length !== expectedCandidates[kind]) {
      bad = `ชิ้น ${pieceId} (${kind}) เสนอ ${candidates.length} แกน (ต้องได้ ${expectedCandidates[kind]})`;
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
  check('ยอด/มุมเสนอ 1 แกน · ขอบเสนอ 2 แกน และหมุนตัวเองจริง', bad === '', bad);
}

console.log('\n6) ชั้นที่หมุนมีชิ้นครบตามลูกจริง (ตัวใหญ่ = 5 ชิ้น · ตัวเล็ก = 1 ชิ้น)');
{
  model.reset();
  let bad = '';
  for (const move of moves) {
    const count = model.turnFor(move).pieceIds.length;
    const expected = move[0] === move[0]!.toUpperCase() ? 5 : 1;
    if (count !== expected) bad = `${move} หมุน ${count} ชิ้น (ควรได้ ${expected})`;
  }
  check('ทุก move หมุนจำนวนชิ้นถูกต้อง', bad === '', bad);
}

console.log('\n7) รูปทรงที่วาด: ยอด/มุมเห็น 3 หน้า · ขอบเห็น 2 หน้า (รวม 36 สติกเกอร์)');
{
  let bad = '';
  let total = 0;
  PYRAMINX_PIECES.forEach((piece, index) => {
    const count = stickerCount(index);
    total += count;
    const expected = piece.kind === 'edge' ? 2 : 3;
    if (count !== expected && !bad) {
      bad = `ชิ้น ${index} (${piece.kind}) เห็น ${count} หน้า (ควรได้ ${expected})`;
    }
  });
  check('จำนวนสติกเกอร์ตรงกับลูกจริง', bad === '' && total === 36, bad || `รวม ${total} แผ่น`);
  check('พีระมิดมี 4 หน้า', PYRAMINX_FACES.length === 4);
}

console.log('\n8) ท่ายืนบนจอ: U ชี้ขึ้น · B อยู่หลัง · L ซ้าย · R ขวา');
{
  const axis = VERTEX_NAMES.map((_, v) => orientedVertexAxis(v));
  const round = (v: number) => Math.round(v * 1000) / 1000;
  VERTEX_NAMES.forEach((name, v) => {
    console.log(`  ${name} → [${axis[v]!.map(round).join(', ')}]`);
  });
  check('U ชี้ขึ้นตรง ๆ', axis[0]![1]! > 1.7 && Math.hypot(axis[0]![0]!, axis[0]![2]!) < 1e-9);
  check('B อยู่ด้านหลัง', axis[3]![2]! < -1 && Math.abs(axis[3]![0]!) < 1e-9);
  check('L อยู่ซ้าย · R อยู่ขวา', axis[1]![0]! < -1 && axis[2]![0]! > 1);
  check(
    'ฐานทั้งสามอยู่ระดับเดียวกันและต่ำกว่ายอด',
    [1, 2, 3].every((v) => Math.abs(axis[v]![1]! - axis[1]![1]!) < 1e-9 && axis[v]![1]! < 0),
  );
}

console.log(failures === 0 ? '\nผ่านทุกข้อ ✅' : `\nไม่ผ่าน ${failures} ข้อ ❌`);
process.exit(failures === 0 ? 0 : 1);
