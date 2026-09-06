/**
 * ตรวจว่าโมเดล Pyramorphix ที่ **เขียนเองล้วน ๆ** ยังตรงกับ KPuzzle ของ 2x2x2 เป๊ะ
 * (เฟส 3.5 ก้อนที่ 2 — ADR-019 + ADR-028)
 *
 * ทำไมต้องมี: ตั้งแต่เขียนใหม่ โมเดลไม่ได้อ่านอะไรจาก cubing.js อีกเลย — พิกัดชิ้นคิดเอง
 * กติกา "แก้เสร็จ" ตัดสินจากแลตทิซของเราเอง ไฟล์นี้จึงเป็น **สิ่งเดียว** ที่รับประกันว่า
 * สิ่งที่ผู้เล่นเห็นกับสิ่งที่ server จะตัดสิน (ซึ่งยังใช้ KPuzzle) ไม่หลุดจากกัน
 *
 * กติกาฝั่ง KPuzzle ในไฟล์นี้ **เขียนซ้ำขึ้นมาใหม่โดยตั้งใจ** ไม่ได้ import มาจากโค้ดที่กำลังตรวจ
 * ไม่งั้นจะกลายเป็นการตรวจโค้ดด้วยตัวมันเอง
 *
 * รัน: `npm run verify:pyramorphix`
 */
import type { KPattern, KPuzzle } from 'cubing/kpuzzle';
import { puzzles } from 'cubing/puzzles';
import { ALLOWED_MOVES, inverseMove } from '../src/cube/moves.ts';
import { countOuterFaces } from '../src/cube/pyramorphix/pyramorphix-geometry.ts';
import { PyramorphixModel } from '../src/cube/pyramorphix/pyramorphix-model.ts';

const ORBIT = 'CORNERS';
const moves = ALLOWED_MOVES.pyramorphix;

let failures = 0;
function check(label: string, ok: boolean, detail = ''): void {
  if (!ok) failures++;
  console.log(`${ok ? '  ✓' : '  ✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}

function same(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

const kpuzzle = await puzzles['2x2x2']!.kpuzzle();

function piecesAfter(move: string): number[] {
  return [...kpuzzle.defaultPattern().applyMove(move).patternData[ORBIT]!.pieces];
}

/** ช่องไหนของ orbit ถูก move นี้ย้ายที่บ้าง */
function movedSlots(move: string): Set<number> {
  const pieces = piecesAfter(move);
  return new Set(pieces.map((_, slot) => slot).filter((slot) => pieces[slot] !== slot));
}

/**
 * ช่องที่ `k` ของ KPuzzle อยู่ octant ไหน — **คำนวณจาก KPuzzle เอง ไม่ hard-code**
 * (ลำดับ index ของ cubing.js ไม่ตรงกับที่คนทั่วไปคิด และเปลี่ยนได้เมื่ออัปเวอร์ชัน — ADR-019)
 */
const xPlus = movedSlots('R');
const yPlus = movedSlots('U');
const zPlus = movedSlots('F');
const slotOctants = Array.from({ length: 8 }, (_, slot) => [
  xPlus.has(slot) ? 1 : -1,
  yPlus.has(slot) ? 1 : -1,
  zPlus.has(slot) ? 1 : -1,
]);

const model = new PyramorphixModel();

/** ช่องของ KPuzzle ↔ ช่องในแลตทิซของเรา (สองฝั่งเรียงชิ้นคนละลำดับ) */
const latticeOfKSlot = slotOctants.map((octant) => model.lattice.slotOf(octant));
const kSlotOfLattice = new Map(latticeOfKSlot.map((lattice, kSlot) => [lattice, kSlot]));

/** สถานะของโมเดลเราในรูปแบบเดียวกับ `patternData.CORNERS.pieces` */
function modelPieces(): number[] {
  const at = model.lattice.toPiecesArray();
  return latticeOfKSlot.map((lattice) => kSlotOfLattice.get(at[lattice]!)!);
}

/** ยอดพีระมิดในหมายเลขช่องของ KPuzzle (octant ที่คูณเครื่องหมายกันได้ +1) */
const apexKSlots = slotOctants
  .map((octant, slot) => ({ octant, slot }))
  .filter(({ octant }) => octant[0]! * octant[1]! * octant[2]! === 1)
  .map(({ slot }) => slot);

/**
 * กติกา "แก้เสร็จ" ฝั่ง KPuzzle ตาม ADR-019 — ตำแหน่งถูกครบ 8 ชิ้น
 * และทิศทางถูกเฉพาะ 4 ชิ้นที่เป็นยอดพีระมิด
 */
function solvedByKPuzzle(pattern: KPattern): boolean {
  const orbit = pattern.patternData[ORBIT]!;
  for (let slot = 0; slot < 8; slot++) {
    if (orbit.pieces[slot] !== slot) return false;
    if (apexKSlots.includes(slot) && orbit.orientation[slot] !== 0) return false;
  }
  return true;
}

console.log(`slotOctants (จาก KPuzzle) = ${JSON.stringify(slotOctants)}`);
console.log(`apexKSlots               = ${JSON.stringify(apexKSlots)} (ADR-019 คาดไว้ [0,2,5,7])`);
console.log(`apexPieces (ของเรา)      = ${JSON.stringify([...model.apexPieces])}\n`);

console.log('0) โมเดลที่เขียนเองชี้ยอดพีระมิดตรงกับที่ KPuzzle บอก');
check('ยอดพีระมิดตรงกับที่พิสูจน์ไว้ในเฟส 0.5', JSON.stringify(apexKSlots) === '[0,2,5,7]');
check(
  'ชิ้นยอดของเรา = ชิ้นยอดของ KPuzzle',
  same(
    [...model.apexPieces].sort((a, b) => a - b),
    apexKSlots.map((k) => latticeOfKSlot[k]!).sort((a, b) => a - b),
  ),
);

console.log(`\n1) move ทั้ง ${moves.length} ตัว ให้ผลตรงกับ KPuzzle`);
for (const move of moves) {
  model.reset();
  model.apply(move);
  const expected = piecesAfter(move);
  const actual = modelPieces();
  check(move.padEnd(3), same(expected, actual), `${expected} vs ${actual}`);
}

console.log('\n2) แปลงกลับ (แกน + ชั้น + มุม → ชื่อ move) ได้ชื่อเดิม');
{
  model.reset();
  for (const move of moves) {
    const { axis, layers, quarters } = model.parse(move);
    const back = model.nameFor(axis, layers[0]!, quarters);
    check(`${move.padEnd(3)} → ${back}`, back === move);
  }
}

console.log('\n3) เดินสุ่ม 5000 ก้าว โมเดลกับ KPuzzle ต้องไม่คลาดกันเลย');
{
  model.reset();
  let pattern = kpuzzle.defaultPattern();
  let mismatch = -1;
  for (let step = 0; step < 5000; step++) {
    const move = moves[Math.floor(Math.random() * moves.length)]!;
    pattern = pattern.applyMove(move);
    model.apply(move);
    if (!same([...pattern.patternData[ORBIT]!.pieces], modelPieces())) {
      mismatch = step;
      break;
    }
  }
  check(
    'ตำแหน่งชิ้นตรงกันทุกก้าว',
    mismatch === -1,
    mismatch === -1 ? '' : `คลาดที่ก้าวที่ ${mismatch}`,
  );
}

console.log('\n4) "แก้เสร็จ" ที่โมเดลตัดสินเอง ตรงกับกติกา ADR-019 บน KPuzzle');
{
  let disagreements = 0;
  let solvedSeen = 0;

  // สุ่มเดินไปแล้วเดินย้อนกลับ เพื่อให้ "ผ่านสถานะแก้เสร็จ" จริง ๆ หลายพันครั้ง
  // (ถ้าสุ่มเดินอย่างเดียวจะแทบไม่มีทางเจอสถานะแก้เสร็จเลย ข้อนี้ก็จะไม่ได้ตรวจอะไร)
  for (let trial = 0; trial < 2000; trial++) {
    model.reset();
    let pattern = kpuzzle.defaultPattern();
    const walk: string[] = [];
    for (let i = 0; i < 1 + Math.floor(Math.random() * 6); i++) {
      walk.push(moves[Math.floor(Math.random() * moves.length)]!);
    }

    for (const move of [...walk, ...walk.map(inverseMove).reverse()]) {
      pattern = pattern.applyMove(move);
      model.apply(move);
      const logicallySolved = solvedByKPuzzle(pattern);
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

console.log('\n5) กติกา Pyramorphix ต่างจาก 2x2x2 จริง (ADR-019)');
{
  // เคสในเอกสาร: ตำแหน่งถูกครบ แต่ชิ้นกลางหน้าหมุนอยู่ → พีระมิดดูแก้เสร็จ แต่ 2x2x2 บอกยังไม่เสร็จ
  const middleKSlots = [0, 1, 2, 3, 4, 5, 6, 7].filter((s) => !apexKSlots.includes(s));
  const pattern = kpuzzle.defaultPattern();
  const data = structuredClone(pattern.patternData);
  data[ORBIT]!.orientation[middleKSlots[0]!] = 1;
  data[ORBIT]!.orientation[middleKSlots[1]!] = 2;
  const twisted = new (pattern.constructor as new (k: KPuzzle, d: typeof data) => KPattern)(
    kpuzzle,
    data,
  );
  check('Pyramorphix บอก "แก้เสร็จ"', solvedByKPuzzle(twisted));
  check('2x2x2 บอก "ยังไม่เสร็จ"', !twisted.isIdentical(kpuzzle.defaultPattern()));
}

console.log('\n6) รูปทรงที่วาด: ยอดพีระมิดเห็น 3 หน้า · ชิ้นกลางหน้าเห็นหน้าเดียว');
{
  let wrong = '';
  let stickers = 0;
  model.lattice.homeCoords.forEach((coord, id) => {
    const faces = countOuterFaces(coord);
    stickers += faces;
    const expected = model.apexPieces.includes(id) ? 3 : 1;
    if (faces !== expected && !wrong) {
      wrong = `ชิ้น ${id} [${coord.join(',')}] เห็น ${faces} หน้า (ควรได้ ${expected})`;
    }
  });
  check('จำนวนหน้าที่โผล่ของทุกชิ้นถูกต้อง', wrong === '', wrong || `รวม ${stickers} สติกเกอร์`);
}

console.log('\n7) ลากชิ้นไหนก็ได้ move ที่ถูกกติกา และ move นั้นหมุนชิ้นนั้นจริง');
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

console.log(failures === 0 ? '\nผ่านทุกข้อ ✅' : `\nไม่ผ่าน ${failures} ข้อ ❌`);
process.exit(failures === 0 ? 0 : 1);
