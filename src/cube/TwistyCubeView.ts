/**
 * เส้นทางที่ 1 ของ interface กลาง — 2x2x2 / 3x3x3 / Pyraminx ใช้ `<twisty-player>` ของ cubing.js
 * (Pyramorphix ใช้ไม่ได้ ต้องใช้ `PyramorphixCubeView` แทน — ADR-019)
 *
 * แบ่งหน้าที่กันแบบนี้:
 *   - `<twisty-player>`  → รับ input (ลาก/สัมผัส), อนิเมชัน, กล้อง, การแสดงผล
 *   - KPuzzle ของเราเอง → สถานะจริงที่ใช้ตอบว่า "แก้เสร็จหรือยัง"
 *
 * เหตุผลที่ไม่เชื่อ `alg` ของ twisty ตรง ๆ: ตอนผู้เล่นลากหมุน twisty จะ "หักล้าง" move
 * ที่ติดกันให้เอง (`R` แล้ว `R'` หายไปทั้งคู่) ถ้าเอาไปนับ move ดื้อ ๆ ตัวเลขจะเพี้ยน
 * เราจึงอ่าน alg ทั้งเส้นแล้วคำนวณสถานะใหม่ทุกครั้งแทน — ตรงกับภาพที่เห็นเสมอ
 */
import { Alg } from 'cubing/alg';
import type { KPattern } from 'cubing/kpuzzle';
import { TwistyPlayer } from 'cubing/twisty';
import type { CubeType } from '@/types/cube';
import { isAllowedMove, normalizeMove } from './moves';
import { getKPuzzle, PUZZLE_ID } from './puzzle';
import type { CubeState, CubeStateListener, CubeView } from './types';

/** ระยะกล้องเริ่มต้นของ `<twisty-player>` (ค่าเดียวกับ default ของ cubing.js) */
const DEFAULT_CAMERA_DISTANCE = 6;
const MIN_CAMERA_DISTANCE = 4;
const MAX_CAMERA_DISTANCE = 12;

/** ประเภทที่ `<twisty-player>` รองรับ (ทุกประเภทยกเว้น Pyramorphix) */
export type TwistyCubeType = Exclude<CubeType, 'pyramorphix'>;

export class TwistyCubeView implements CubeView {
  readonly cubeType: TwistyCubeType;

  #player: TwistyPlayer;
  #solvedPattern: KPattern;
  /** สถานะหลังใส่ scramble แล้ว แต่ยังไม่มี move ของผู้เล่น */
  #scrambledPattern: KPattern;
  #scramble = '';
  #moves: readonly string[] = [];
  #solved = false;
  #listeners = new Set<CubeStateListener>();
  /** กันลูป: ตอนเราเป็นคนเขียน `alg` เอง ไม่ต้องประมวลผล event ที่เด้งกลับมา */
  #writingAlg = false;
  #disposed = false;
  #cameraDistance = DEFAULT_CAMERA_DISTANCE;

  private constructor(cubeType: TwistyCubeType, player: TwistyPlayer, solvedPattern: KPattern) {
    this.cubeType = cubeType;
    this.#player = player;
    this.#solvedPattern = solvedPattern;
    this.#scrambledPattern = solvedPattern;
    this.#solved = true;

    player.experimentalModel.alg.addFreshListener(({ alg }) => this.#onAlgChanged(alg));
    // twisty ไม่มีการซูมด้วยล้อเมาส์มาให้ ต้องต่อเอง (Pyramorphix ได้จาก OrbitControls อยู่แล้ว)
    player.addEventListener('wheel', this.#onWheel, { passive: false });
  }

  /** ล้อเมาส์ = ซูมเข้า/ออก */
  #onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const next = this.#cameraDistance + Math.sign(event.deltaY) * 0.5;
    this.#cameraDistance = Math.min(MAX_CAMERA_DISTANCE, Math.max(MIN_CAMERA_DISTANCE, next));
    this.#player.cameraDistance = this.#cameraDistance;
  };

  static async create(cubeType: TwistyCubeType, container: HTMLElement): Promise<TwistyCubeView> {
    const kpuzzle = await getKPuzzle(cubeType);

    const player = new TwistyPlayer({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- PuzzleID ของ cubing.js ไม่ export ออกมาให้ประกาศชนิดตรง ๆ
      puzzle: PUZZLE_ID[cubeType] as any,
      alg: '',
      background: 'none',
      controlPanel: 'none',
      backView: 'none',
      // ไม่โชว์สติกเกอร์เงาด้านหลัง — ดีไซน์ในโฟลเดอร์ `ตัวอย่างเว็บไซต์/` เป็นคิวบ์ทึบธรรมดา
      hintFacelets: 'none',
      // ลากบนตัวคิวบ์ = หมุนชั้น · ลากนอกตัวคิวบ์ = หมุนกล้อง (ใช้ได้ทั้งเมาส์และนิ้ว)
      experimentalDragInput: 'auto',
      experimentalMovePressInput: 'auto',
      tempoScale: 4,
    });
    // ตั้งแค่ขนาด **ห้ามแตะ `display`** — `<twisty-player>` ใช้ `display: grid` จัดวางข้างใน
    // ถ้าทับเป็น `block` กล่องข้างในจะสูง 0 (มัน `contain: size`) แล้วคิวบ์จะหายไปทั้งลูกแบบเงียบ ๆ
    player.style.width = '100%';
    player.style.height = '100%';
    container.appendChild(player);

    return new TwistyCubeView(cubeType, player, kpuzzle.defaultPattern());
  }

  // ---------------------------------------------------------------- สถานะ

  #onAlgChanged(alg: Alg): void {
    if (this.#writingAlg || this.#disposed) return;

    const moves = [...alg.childAlgNodes()].map((node) => normalizeMove(node.toString()));

    // ADR-018: ห้าม move หมุนทั้งลูก — ถ้าหลุดเข้ามาให้ถอนออกจากภาพแล้วทำเหมือนไม่เคยเกิด
    if (moves.some((move) => !isAllowedMove(this.cubeType, move))) {
      this.#setAlg(this.#moves);
      return;
    }

    this.#moves = moves;
    let pattern = this.#scrambledPattern;
    for (const move of moves) pattern = pattern.applyMove(move);
    this.#solved = pattern.isIdentical(this.#solvedPattern);
    this.#emit();
  }

  #setAlg(moves: readonly string[]): void {
    this.#writingAlg = true;
    this.#player.alg = new Alg(moves.join(' '));
    this.#writingAlg = false;
  }

  #emit(): void {
    const state = this.getState();
    for (const listener of this.#listeners) listener(state);
  }

  // ---------------------------------------------------------------- CubeView

  async setScramble(scramble: string): Promise<void> {
    const kpuzzle = await getKPuzzle(this.cubeType);
    this.#scramble = scramble;
    this.#scrambledPattern = kpuzzle.defaultPattern().applyAlg(new Alg(scramble));
    this.#moves = [];
    this.#solved = this.#scrambledPattern.isIdentical(this.#solvedPattern);

    this.#writingAlg = true;
    this.#player.experimentalSetupAlg = scramble;
    this.#player.alg = '';
    this.#writingAlg = false;
    this.#emit();
  }

  applyMove(move: string): Promise<void> {
    if (!isAllowedMove(this.cubeType, move)) {
      throw new Error(`move "${move}" ใช้กับ ${this.cubeType} ไม่ได้`);
    }
    this.#player.experimentalAddMove(move);
    return Promise.resolve();
  }

  reset(): Promise<void> {
    return this.setScramble(this.#scramble);
  }

  setTurnsEnabled(enabled: boolean): void {
    // กล้องยังหมุนได้เสมอ — twisty แยก "ลากบนคิวบ์" กับ "ลากพื้นหลัง" ให้อยู่แล้ว
    this.#player.experimentalDragInput = enabled ? 'auto' : 'none';
    this.#player.experimentalMovePressInput = enabled ? 'auto' : 'none';
  }

  getState(): CubeState {
    return { moves: this.#moves, solved: this.#solved };
  }

  subscribe(listener: CubeStateListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  dispose(): void {
    this.#disposed = true;
    this.#listeners.clear();
    this.#player.removeEventListener('wheel', this.#onWheel);
    this.#player.remove();
  }
}
