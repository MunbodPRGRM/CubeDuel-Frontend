/**
 * ตรวจว่าโมเดลชิ้นส่วนของ Pyramorphix renderer **ตรงกับ KPuzzle ของ 2x2x2 เป๊ะ** (ADR-019)
 *
 * เฟส 0.5 ตรวจไว้แค่ 9 move (U/R/F) — ของจริงรับครบ 6 หน้าเพราะผู้เล่นลากหมุนหน้าไหนก็ได้
 * จึงต้องตรวจซ้ำทั้ง 18 move + เดินสุ่มยาว ๆ ว่าไม่มีจุดไหนคลาดกัน
 *
 * รัน: `npm run verify:pyramorphix`
 */
import { puzzles } from 'cubing/puzzles';
import { deriveApexSlots, deriveSlotOctants, isPyramorphixSolved } from '../src/cube/puzzle.ts';
import { ALLOWED_MOVES } from '../src/cube/moves.ts';
import {
  PieceModel,
  parseMove,
  moveNameFor,
  matEq,
  IDENTITY,
} from '../src/cube/pyramorphix/rotation.ts';

const kpuzzle = await puzzles['2x2x2']!.kpuzzle();
const slotOctants = deriveSlotOctants(kpuzzle);
const apexSlots = deriveApexSlots(slotOctants);
const moves = ALLOWED_MOVES.pyramorphix;

let failures = 0;
function check(label: string, ok: boolean, detail = ''): void {
  if (!ok) failures++;
  console.log(`${ok ? '  ✓' : '  ✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}

console.log(`slotOctants = ${JSON.stringify(slotOctants)}`);
console.log(`apexSlots   = ${JSON.stringify(apexSlots)} (ADR-019 คาดไว้ [0,2,5,7])\n`);
check('ยอดพีระมิดตรงกับที่พิสูจน์ไว้ในเฟส 0.5', JSON.stringify(apexSlots) === '[0,2,5,7]');

console.log(`\n1) move ทั้ง ${moves.length} ตัว ให้ผลตรงกับ KPuzzle`);
for (const move of moves) {
  const expected = kpuzzle.defaultPattern().applyMove(move).patternData.CORNERS!.pieces;
  const model = new PieceModel(slotOctants);
  model.applyParsed(parseMove(move));
  const actual = model.getPiecesArray();
  check(
    move.padEnd(3),
    JSON.stringify([...expected]) === JSON.stringify(actual),
    `${expected} vs ${actual}`,
  );
}

console.log('\n2) แปลงกลับ (แกน+ฝั่ง+มุม → ชื่อ move) ได้ชื่อเดิม');
for (const move of moves) {
  const { axis, layerSign, quarters } = parseMove(move);
  const back = moveNameFor(axis, layerSign, quarters);
  check(`${move.padEnd(3)} → ${back}`, back === move);
}

console.log('\n3) เดินสุ่ม 5000 ก้าว โมเดลกับ KPuzzle ต้องไม่คลาดกันเลย');
{
  const model = new PieceModel(slotOctants);
  let pattern = kpuzzle.defaultPattern();
  let mismatch = -1;
  for (let step = 0; step < 5000; step++) {
    const move = moves[Math.floor(Math.random() * moves.length)]!;
    pattern = pattern.applyMove(move);
    model.applyParsed(parseMove(move));
    const expected = JSON.stringify([...pattern.patternData.CORNERS!.pieces]);
    if (expected !== JSON.stringify(model.getPiecesArray())) {
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

console.log('\n4) "แก้เสร็จ" ของภาพกับของ KPuzzle ตัดสินตรงกัน');
{
  let disagreements = 0;
  let solvedSeen = 0;
  const inverseOf = (move: string) =>
    move.endsWith('2') ? move : move.endsWith("'") ? move.slice(0, -1) : `${move}'`;

  // สุ่มเดินไปแล้วเดินย้อนกลับ เพื่อให้ "ผ่านสถานะแก้เสร็จ" จริง ๆ หลายพันครั้ง
  // (ถ้าสุ่มเดินอย่างเดียวจะแทบไม่มีทางเจอสถานะแก้เสร็จเลย ข้อนี้ก็จะไม่ได้ตรวจอะไร)
  for (let trial = 0; trial < 2000; trial++) {
    const model = new PieceModel(slotOctants);
    let pattern = kpuzzle.defaultPattern();
    const walk: string[] = [];
    for (let i = 0; i < 1 + Math.floor(Math.random() * 6); i++) {
      walk.push(moves[Math.floor(Math.random() * moves.length)]!);
    }
    const sequence = [...walk, ...walk.map(inverseOf).reverse()];

    for (const move of sequence) {
      pattern = pattern.applyMove(move);
      model.applyParsed(parseMove(move));

      // ฝั่งภาพ: ทุกชิ้นอยู่บ้านตัวเอง + ชิ้นยอดพีระมิดต้องไม่ถูกหมุน
      const pieces = model.getPiecesArray();
      const visuallySolved = pieces.every(
        (pieceId, slot) =>
          pieceId === slot &&
          (!apexSlots.includes(slot) || matEq(model.pieceRotation[pieceId]!, IDENTITY)),
      );
      const logicallySolved = isPyramorphixSolved(pattern, apexSlots);
      if (visuallySolved !== logicallySolved) disagreements++;
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
  const middleSlots = [0, 1, 2, 3, 4, 5, 6, 7].filter((s) => !apexSlots.includes(s));
  const pattern = kpuzzle.defaultPattern();
  const data = structuredClone(pattern.patternData);
  data.CORNERS!.orientation[middleSlots[0]!] = 1;
  data.CORNERS!.orientation[middleSlots[1]!] = 2;
  const twisted = new (
    pattern.constructor as new (k: typeof kpuzzle, d: typeof data) => typeof pattern
  )(kpuzzle, data);
  check('Pyramorphix บอก "แก้เสร็จ"', isPyramorphixSolved(twisted, apexSlots));
  check('2x2x2 บอก "ยังไม่เสร็จ"', !twisted.isIdentical(kpuzzle.defaultPattern()));
}

console.log(failures === 0 ? '\nผ่านทุกข้อ ✅' : `\nไม่ผ่าน ${failures} ข้อ ❌`);
process.exit(failures === 0 ? 0 : 1);
