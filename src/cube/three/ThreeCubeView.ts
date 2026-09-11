/**
 * **ตัววาดคิวบ์ 3 มิติตัวเดียวของทั้งแอป** — Three.js + GSAP (ADR-026, เฟส 3.5 ก้อนที่ 1)
 *
 * ยกมาจาก `PyramorphixCubeView` เดิมแล้วถอดส่วนที่รู้จัก Pyramorphix ออกให้หมด
 * เหลือแต่งานที่ทุกประเภทใช้เหมือนกัน: ฉาก · กล้อง · OrbitControls · คิวอนิเมชัน ·
 * resize · raycast · ลากเพื่อหมุนชั้น · ผูกสถานะกับ `KPattern`
 *
 * แบ่งหน้าที่กับ `PuzzleModel` แบบนี้:
 *   - **โมเดล** ตอบว่า move นี้หมุนชิ้นไหน รอบแกนไหน กี่องศา (ไม่รู้จัก three เลย)
 *   - **ตัววาด** เอาไปเล่นอนิเมชันและรับ input (ไม่รู้ว่าเป็นลูกบาศก์หรือพีระมิด)
 *
 * ตรรกะที่ใช้ตัดสินผลจริงยังเป็น `KPattern` ของ cubing.js ที่เดินคู่กันไป — สคริปต์
 * `verify-*` มีหน้าที่พิสูจน์ว่าภาพกับตรรกะไม่หลุดกัน
 */
import gsap from 'gsap';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Alg } from 'cubing/alg';
import type { KPattern, KPuzzle } from 'cubing/kpuzzle';
import type { CubeType } from '@/types/cube';
import { inverseMove, isAllowedMove } from '../moves.ts';
import type {
  CubeMoveEvent,
  CubeMoveListener,
  CubeMoveSource,
  CubeState,
  CubeStateListener,
  CubeView,
  SetScrambleOptions,
} from '../types.ts';
import type { Mat3 } from './lattice.ts';
import type { DragCandidate, PuzzleModel, TurnSpec } from './model.ts';

/** ระยะเวลาอนิเมชันหมุนหนึ่งครั้ง — เร็วพอให้ speedcuber ไม่รู้สึกว่าคิวบ์หนืด */
const TURN_DURATION_MS = 110;
/** เวลาที่ใช้ "ดีด" ชั้นเข้าที่หลังปล่อยนิ้ว (คิดจากระยะเต็มหนึ่งช่วง แล้วลดตามสัดส่วน) */
const SNAP_DURATION_MS = 110;
/** ต้องลากเกินกี่พิกเซลถึงจะเลือกแกนหมุน (กันการกดแล้วสั่นนิดเดียว) */
const DRAG_THRESHOLD_PX = 8;
/** ทิศที่ลากต้องตรงกับทิศการหมุนอย่างน้อยเท่านี้ ไม่งั้นถือว่ากำกวม ไม่หมุนอะไรเลย */
const DIRECTION_MATCH_MIN = 0.3;
/**
 * รัศมีขั้นต่ำที่ใช้แปลง "พิกเซลที่ลาก" เป็น "องศาที่หมุน" (หน่วยเดียวกับฉาก คิวบ์กว้าง 2)
 *
 * ถ้าจับใกล้แกนหมุนมาก ๆ (เช่นกลางหน้าของ 3x3x3) รัศมีจริงเกือบเป็นศูนย์ ลากนิดเดียว
 * ชั้นจะเหวี่ยงหลายรอบ — จึงคิดเสมือนว่าจับอยู่ห่างจากแกนอย่างน้อยเท่านี้
 */
const MIN_TURN_RADIUS = 0.6;
/**
 * แกนที่ "ตั้งฉากกับหน้าที่จับ" เกินค่านี้ ถือว่าไม่ใช่สิ่งที่ผู้เล่นตั้งใจ → ตัดทิ้ง
 *
 * จับสติกเกอร์บนหน้า U ของลูกบาศก์จริงแล้วลาก มันหมุนได้แค่รอบแกน x กับ z เท่านั้น
 * (คือ move ตระกูล L/R และ F/B) ส่วนการหมุนรอบแกน y เอง — `U` — ต้องไปจับที่หน้าข้าง
 * ถ้าไม่ตัดออก แกน y จะแย่งคะแนนกับอีกสองแกนแบบสุ่ม ๆ กลายเป็น "ตั้งใจ U แต่ได้ F"
 */
const FACE_AXIS_MAX_DOT = 0.9;
/** ค้างคิวอนิเมชันได้มากสุดกี่ move ก่อนจะข้ามไปสถานะล่าสุดทันที */
const MAX_PENDING_TURNS = 3;
/**
 * ระยะเวลาต่อท่าตอน**เล่นชุด move ให้ดู** — ทั้ง scramble และปุ่ม "เสร็จทันที" (ADR-033)
 *
 * ช้ากว่าการหมุนของผู้เล่นตั้งใจ เพราะทั้งสองกรณีมีไว้ให้ **ดู** ว่าหมุนท่าอะไรไปบ้าง
 * ไม่ได้มีไว้ให้จบไว ๆ — ถ้าเร็วจนดูไม่ทันก็ไม่ต่างอะไรกับกระโดดไปสถานะสุดท้ายเลย
 */
const PLAYBACK_TURN_MS = 250;
/** เว้นจังหวะระหว่างท่า ให้เห็นชัดว่าจบท่าหนึ่งแล้วถึงขึ้นท่าใหม่ */
const PLAYBACK_GAP_MS = 60;

/**
 * ทุกประเภทวาดในกล่อง [-1, 1] เท่ากันหมด กล้องจึงใช้ค่าชุดเดียวได้
 *
 * ถอยออก ×1.4 จากทิศเดิม `[3.4, 2.6, 3.4]` ให้คิวบ์กินความสูงกล่อง ~65% แทน ~92% (ADR-059 ข้อ 4)
 * — ย่อที่กล้อง ไม่ย่อ geometry เพราะการลากหมุนชั้นคิดจากการฉายจุดลงจอ
 */
const CAMERA_POSITION: readonly [number, number, number] = [4.76, 3.64, 4.76];
/** มุมมองของกล้อง (องศา) — เป็นมุม **แนวตั้ง** ตามนิยามของ `PerspectiveCamera` */
const CAMERA_FOV = 38;
const MIN_CAMERA_DISTANCE = 3;
const MAX_CAMERA_DISTANCE = 12;

/**
 * มุมกล้องแนวตั้งสำหรับกล่องสัดส่วน `aspect` (กว้าง ÷ สูง)
 *
 * กล่องกว้างกว่าสูงใช้ `CAMERA_FOV` ตรง ๆ · กล่อง **สูงกว่ากว้าง** (มือถือแนวตั้ง) ถ้าใช้ค่าเดิม
 * ด้านข้างจะแคบกว่าด้านบนแล้วคิวบ์ล้นกรอบ → ขยายมุมแนวตั้งให้ **มุมแนวนอน** เท่ากับ `CAMERA_FOV` แทน
 * ไม่แตะระยะกล้อง ระยะที่ผู้เล่นซูมไว้จึงไม่เด้งกลับตอน resize (ADR-059 ข้อ 4)
 */
function fovFor(aspect: number): number {
  if (!(aspect > 0) || aspect >= 1) return CAMERA_FOV;
  const halfHorizontal = THREE.MathUtils.degToRad(CAMERA_FOV / 2);
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(halfHorizontal) / aspect));
}

export interface ThreeCubeViewSpec {
  cubeType: CubeType;
  /** โมเดลตรรกะ/ภาพของประเภทนี้ */
  model: PuzzleModel;
  /** geometry ของแต่ละชิ้น เรียงตรงกับ id ของชิ้นในโมเดล */
  geometries: THREE.BufferGeometry[];
  /** KPuzzle ที่ใช้เดินสถานะจริง (Pyramorphix ใช้ของ 2x2x2 — ADR-019) */
  kpuzzle: KPuzzle;
  /** กติกา "แก้เสร็จ" ของประเภทนี้ */
  isSolved(pattern: KPattern): boolean;
}

/** move ที่ลงบัญชีแล้ว รออนิเมชันอย่างเดียว */
interface QueuedTurn {
  turn: TurnSpec;
}

/** ชั้นที่กำลังหมุนตามนิ้วอยู่ — เกิดขึ้นตอนลากเกิน `DRAG_THRESHOLD_PX` แล้วเท่านั้น */
interface ActiveTurn {
  /** ชื่อ move เมื่อหมุน **ทางบวก** หนึ่งช่วงรอบแกนนี้ (ทางลบใช้ `inverseMove`) */
  move: string;
  /** แกนหมุน (เวกเตอร์หนึ่งหน่วย) — ปรับทิศแล้วให้มุมบวก = `move` เสมอ */
  axis: THREE.Vector3;
  pieceIds: number[];
  /** ขนาดของหนึ่งช่วง (เรเดียน) — 90° ของลูกบาศก์ · 120° ของพีระมิด */
  unit: number;
  /** เวกเตอร์บนจอ (พิกเซล) ที่ตรงกับการหมุน **1 เรเดียน** + ความยาวยกกำลังสองของมัน */
  screenX: number;
  screenY: number;
  screenLengthSq: number;
  /** มุมที่หมุนไปแล้วตามนิ้ว (เรเดียน) */
  angle: number;
}

/** นิ้ว/เมาส์ที่กดค้างอยู่บนตัวคิวบ์ */
interface Gesture {
  pointerId: number;
  pieceId: number;
  /** จุดที่จับได้ (พิกัดโลก ณ ตอนกด) — ใช้คิดว่าหมุนแล้วจุดนี้จะวิ่งไปทางไหนบนจอ */
  point: THREE.Vector3;
  /** เวกเตอร์ตั้งฉากของ **หน้าที่จับ** (พิกัดโลก) — ใช้ตัดแกนที่ผู้เล่นไม่ได้ตั้งใจ */
  normal: THREE.Vector3 | null;
  startX: number;
  startY: number;
  /** `null` = ยังลากไม่ถึงเกณฑ์ ยังไม่รู้ว่าจะหมุนแกนไหน */
  turn: ActiveTurn | null;
}

/** ผลของการยิงรังสีหาชิ้นที่ผู้เล่นกดโดน */
interface PointerHit {
  pieceId: number;
  point: THREE.Vector3;
  normal: THREE.Vector3 | null;
}

export class ThreeCubeView implements CubeView {
  readonly cubeType: CubeType;

  #spec: ThreeCubeViewSpec;
  #container: HTMLElement;
  #scene: THREE.Scene;
  #camera: THREE.PerspectiveCamera;
  #renderer: THREE.WebGLRenderer;
  #controls: OrbitControls;
  #material: THREE.Material;
  #pivot: THREE.Group;
  #meshes: THREE.Mesh[] = [];
  #resizeObserver: ResizeObserver;
  /** id ของเฟรมที่จองไว้แล้วยังไม่ได้วาด — `0` = ไม่มีเฟรมค้างอยู่ (ADR-044 ข้อ 4) */
  #animationFrame = 0;

  #scrambledPattern: KPattern;
  #pattern: KPattern;
  #scramble = '';

  #moves: string[] = [];
  #listeners = new Set<CubeStateListener>();
  #moveListeners = new Set<CubeMoveListener>();
  #queue: QueuedTurn[] = [];
  #animating = false;
  /** ตัวที่ GSAP tween อยู่ — เก็บไว้เพื่อ kill ตอนถูกสั่ง scramble ใหม่ */
  #progress = { t: 0 };
  /** ปิดอนิเมชันที่ค้างอยู่ตอนถูกสั่ง scramble ใหม่ ไม่งั้นคิว move จะค้างตลอดไป */
  #finishAnimation: (() => void) | null = null;
  #turnsEnabled = true;
  #disposed = false;
  /** กำลังเล่นชุด move ให้ดู (`solve()` / scramble แบบมีอนิเมชัน) — ห้ามหมุนแทรก ห้ามตัดคิว */
  #playingAlg = false;
  /**
   * **รุ่นของสถานะคิวบ์** — เพิ่มทุกครั้งที่มีคำสั่งที่ยึดสถานะไปทั้งก้อน (`setScramble` / `solve`)
   *
   * ตัวที่เล่นอนิเมชันค้างอยู่ต้องเทียบเลขนี้ **ก่อนลงทุกท่า** ถ้าไม่ตรงแปลว่ามีคำสั่งใหม่แซง
   * เข้ามาแล้ว ต้องหยุดกลางคันทันที ห้ามลง move ต่อทับสถานะของรอบใหม่ (ADR-033)
   */
  #stateGeneration = 0;
  /** คนที่รออยู่ว่าคิวอนิเมชันจะว่างเมื่อไหร่ */
  #idleWaiters: (() => void)[] = [];

  /** ท่าที่นิ้ว/เมาส์กำลังลากอยู่บนตัวคิวบ์ (`null` = ไม่ได้ลากอะไรอยู่) */
  #gesture: Gesture | null = null;

  constructor(container: HTMLElement, spec: ThreeCubeViewSpec) {
    if (spec.geometries.length !== spec.model.pieceCount) {
      throw new Error(
        `จำนวน geometry (${spec.geometries.length}) ไม่ตรงกับจำนวนชิ้นในโมเดล (${spec.model.pieceCount})`,
      );
    }

    this.#spec = spec;
    this.cubeType = spec.cubeType;
    this.#container = container;
    this.#scrambledPattern = spec.kpuzzle.defaultPattern();
    this.#pattern = this.#scrambledPattern;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;

    this.#scene = new THREE.Scene();
    this.#camera = new THREE.PerspectiveCamera(fovFor(width / height), width / height, 0.1, 100);
    this.#camera.position.set(...CAMERA_POSITION);
    this.#camera.lookAt(0, 0, 0);

    this.#renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.#renderer.setSize(width, height);
    this.#renderer.domElement.style.display = 'block';
    this.#renderer.domElement.style.touchAction = 'none'; // ไม่งั้นบนมือถือจะกลายเป็นการเลื่อนหน้าจอ
    container.appendChild(this.#renderer.domElement);

    this.#scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
    keyLight.position.set(4, 6, 5);
    this.#scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-5, -2, -4);
    this.#scene.add(fillLight);

    this.#controls = new OrbitControls(this.#camera, this.#renderer.domElement);
    // กล้องขยับ (ลากเอง หรือ damping กำลังคายตัว) = ภาพเปลี่ยน → ขอเฟรมใหม่ (ADR-044 ข้อ 4)
    this.#controls.addEventListener('change', this.#invalidate);
    this.#controls.enableDamping = true;
    this.#controls.enablePan = false;
    this.#controls.minDistance = MIN_CAMERA_DISTANCE;
    this.#controls.maxDistance = MAX_CAMERA_DISTANCE;

    this.#material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.45,
      metalness: 0.02,
      flatShading: true,
    });
    for (let i = 0; i < spec.geometries.length; i++) {
      const mesh = new THREE.Mesh(spec.geometries[i]!, this.#material);
      mesh.userData.pieceId = i;
      this.#scene.add(mesh);
      this.#meshes.push(mesh);
    }

    this.#pivot = new THREE.Group();
    this.#scene.add(this.#pivot);

    this.#resizeObserver = new ResizeObserver(() => this.#resize());
    this.#resizeObserver.observe(container);

    // ต้องดักที่ container ในจังหวะ capture เพื่อให้ทันก่อน OrbitControls ที่ดักอยู่บน canvas
    container.addEventListener('pointerdown', this.#onPointerDown, { capture: true });

    this.#invalidate();
  }

  // ---------------------------------------------------------------- ฉาก

  /**
   * **ขอวาดหนึ่งเฟรม** — ตัวเดียวที่จองอนิเมชันเฟรมได้ในไฟล์นี้ (ADR-044 ข้อ 4)
   *
   * ของเดิมวนวาดทุกเฟรมตลอดเวลา ซึ่งที่ห้อง 4 คนคือ 4 WebGL context ที่วาดภาพนิ่งซ้ำ
   * 60 ครั้ง/วินาทีฟรี ๆ · ตอนนี้ไม่มีลูปเดินอยู่เบื้องหลังเลย วาดเฉพาะตอนภาพเปลี่ยนจริง
   *
   * **ต้องเรียกทุกครั้งที่ทำให้ภาพเปลี่ยน** — ทางที่มีอยู่คือ: `'change'` ของ OrbitControls ·
   * `#syncMeshes()` · `onUpdate` ของ GSAP · `#onPointerMove` · `#resize()`
   * ลืมเรียกที่ไหน คิวบ์จะ**ค้าง** ไม่ใช่แค่ช้า
   */
  #invalidate = (): void => {
    if (this.#disposed || this.#animationFrame !== 0) return;
    this.#animationFrame = requestAnimationFrame(this.#tick);
  };

  /**
   * วาดหนึ่งเฟรม แล้วจองเฟรมถัดไป**เฉพาะตอนที่ยังมีอะไรขยับอยู่จริง**
   *
   * damping ของกล้องไม่ต้องจองเอง เพราะ `controls.update()` ที่เรียกอยู่ตรงนี้ dispatch
   * `'change'` ของตัวเองตราบใดที่กล้องยังขยับเกิน EPS แล้ว listener จองเฟรมถัดไปให้ —
   * ตอนนั้น `#animationFrame` เป็น 0 ไปแล้ว (ล้างเป็นบรรทัดแรก) จึงจองติดเสมอ
   *
   * แต่ **GSAP กับการลากนิ้วเดินบน rAF ของตัวเอง ซึ่งอาจทำงานก่อน `#tick` ในเฟรมเดียวกัน**
   * ตอนนั้น `#invalidate()` เจอเฟรมที่จองไว้แล้วเลยไม่ทำอะไร พอ `#tick` วาดเสร็จก็ไม่มี
   * เฟรมค้างอยู่ ต้องรอ tick ถัดไปของ GSAP มาจองใหม่ = ได้ครึ่งเฟรมเรต (วัดได้ 32 fps
   * ตอนหมุนคิวบ์) จึงจองต่อเองที่นี่ตลอดที่ยังมี tween หรือมือลากค้างอยู่
   */
  #tick = (): void => {
    this.#animationFrame = 0;
    if (this.#disposed) return;
    this.#controls.update();
    this.#renderer.render(this.#scene, this.#camera);
    if (this.#finishAnimation !== null || this.#gesture?.turn) this.#invalidate();
  };

  #resize(): void {
    const width = this.#container.clientWidth;
    const height = this.#container.clientHeight;
    if (width === 0 || height === 0) return;
    this.#camera.aspect = width / height;
    this.#camera.fov = fovFor(this.#camera.aspect);
    this.#camera.updateProjectionMatrix();
    this.#renderer.setSize(width, height);
    this.#invalidate();
  }

  /** บังคับให้ภาพตรงกับสถานะภายในเป๊ะ ๆ (กันทศนิยมสะสมจากอนิเมชัน — บทเรียนจากเฟส 0.5) */
  #syncMeshes(): void {
    for (let i = 0; i < this.#meshes.length; i++) {
      const r: Mat3 = this.#spec.model.rotationOf(i);
      const matrix = new THREE.Matrix4().set(
        r[0]!,
        r[1]!,
        r[2]!,
        0,
        r[3]!,
        r[4]!,
        r[5]!,
        0,
        r[6]!,
        r[7]!,
        r[8]!,
        0,
        0,
        0,
        0,
        1,
      );
      const mesh = this.#meshes[i]!;
      mesh.position.set(0, 0, 0);
      mesh.setRotationFromMatrix(matrix);
      mesh.updateMatrixWorld(true);
    }
    // ทางออกร่วมของทุกคำสั่งที่ยึดสถานะทั้งก้อน — ขอเฟรมที่นี่ที่เดียวจึงครอบได้หมด
    this.#invalidate();
  }

  // ---------------------------------------------------------------- การหมุน

  #emit(): void {
    const state = this.getState();
    for (const listener of this.#listeners) listener(state);
  }

  /**
   * ลง move ลงสถานะ **ทันที** ทั้งฝั่งตรรกะและบัญชี move แล้วแจ้งผู้ฟังทุกคน
   *
   * สำคัญมาก (ADR-025 ข้อ 3): ห้ามให้สถานะไปผูกกับ "อนิเมชันเล่นจบ" เพราะอนิเมชันของ GSAP
   * เดินด้วย `requestAnimationFrame` ซึ่ง **หยุดเดินเมื่อแท็บถูกพักไว้เบื้องหลัง** ถ้าผูกไว้
   * คิว move จะค้าง สถานะภาพกับสถานะจริงจะแยกกันทันที (เจอจริงตอนทดสอบเฟส 3)
   * ด้วยเหตุผลเดียวกัน `subscribeMoves` ก็ต้องได้ move จากที่นี่ ไม่ใช่ตอนอนิเมชันจบ
   */
  #applyMoveState(move: string, source: CubeMoveSource): void {
    this.#spec.model.apply(move);
    this.#pattern = this.#pattern.applyMove(move);
    this.#moves = [...this.#moves, move];

    const event: CubeMoveEvent = { move, seq: this.#moves.length, at: Date.now(), source };
    for (const listener of this.#moveListeners) listener(event);
    this.#emit();
  }

  /**
   * ลง move พร้อม **เข้าคิวอนิเมชัน** ให้ — ทางของคำสั่งจากโปรแกรม
   * (การลากนิ้วไม่ผ่านทางนี้ เพราะชั้นหมุนตามนิ้วไปแล้วระหว่างลาก)
   */
  #commit(move: string, source: CubeMoveSource): void {
    // ผู้เล่นลากค้างอยู่แล้วโปรแกรมสั่งหมุนทับ → ปิดท่าที่ค้างก่อน ไม่งั้นแย่ง pivot กัน
    this.#settleGesture();
    // ต้องรู้ว่าชิ้นไหนอยู่ในชั้นนี้ *ก่อน* อัปเดตสถานะ เพราะอนิเมชันจะหมุนชิ้นเหล่านั้น
    const turn = this.#spec.model.turnFor(move);
    this.#applyMoveState(move, source);

    this.#queue.push({ turn });
    void this.#drainQueue();
  }

  async #drainQueue(): Promise<void> {
    if (this.#animating) return;
    this.#animating = true;
    while (this.#queue.length > 0 && !this.#disposed) {
      // หมุนเร็วรัวจนอนิเมชันตามไม่ทัน (หรือแท็บถูกพัก) → ข้ามไปสถานะล่าสุดเลย ดีกว่าค้าง
      // ยกเว้นตอนเล่นชุดให้ดู ซึ่งคิวยาวเป็นเรื่องปกติและอนิเมชันคือสิ่งที่ผู้เล่นอยากเห็น
      if (!this.#playingAlg && this.#queue.length > MAX_PENDING_TURNS) {
        this.#queue = [];
        this.#syncMeshes();
        break;
      }
      await this.#animateTurn(this.#queue.shift()!.turn);
    }
    this.#animating = false;
    for (const wake of this.#idleWaiters) wake();
    this.#idleWaiters = [];
  }

  /**
   * **เล่นชุด move ให้ดูทีละท่าจริง ๆ** — ลง move → รออนิเมชันท่านั้นจบ → ค่อยลงท่าถัดไป (ADR-033)
   *
   * ⚠️ **เฟส 4 ห้ามลอกวิธีนี้ไปใช้กับ move ที่ผู้เล่นหมุนเอง** — move ของผู้เล่นต้องลงบัญชี
   * **ทันที** โดยไม่รออนิเมชันตาม ADR-025 ข้อ 3 (rAF หยุดเดินตอนแท็บถูกพักไว้เบื้องหลัง
   * ถ้าผูกไว้ คิวจะค้างและสถานะจะแยกจากภาพ) ที่นี่ยอมผูกได้เพราะเป็น move ของ**โปรแกรม**
   * ที่เกิดนอกช่วงจับเวลา ไม่ยิงขึ้น server และ "การได้เห็นภาพหมุน" คือจุดประสงค์ทั้งหมด
   *
   * ก่อนลงแต่ละท่าต้องเทียบ `#stateGeneration` ก่อนเสมอ — ถ้ามี `setScramble`/`solve` ใหม่
   * แซงเข้ามา ตัวที่ค้างอยู่ต้องถอยทันที ห้ามหมุนทับสถานะของรอบใหม่
   */
  async #playAlg(moves: readonly string[], generation: number): Promise<void> {
    this.#playingAlg = true;
    try {
      for (let i = 0; i < moves.length; i++) {
        if (this.#superseded(generation)) return;
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, PLAYBACK_GAP_MS));
          if (this.#superseded(generation)) return;
        }
        this.#commit(moves[i]!, 'program');
        await this.#whenIdle();
      }
    } finally {
      // ตัวที่ตกรุ่นแล้วห้ามปลดธงของรอบใหม่ที่กำลังเล่นอยู่ (ไม่งั้นผู้เล่นหมุนแทรกกลางอนิเมชันได้)
      if (this.#stateGeneration === generation) this.#playingAlg = false;
    }
  }

  /** ชุดที่เล่นอยู่ตกรุ่นแล้วหรือยัง (ถูกสั่งใหม่ทับ หรือ view ถูกทิ้งไปแล้ว) */
  #superseded(generation: number): boolean {
    return this.#disposed || generation !== this.#stateGeneration;
  }

  /** รอจนคิวอนิเมชันว่าง (คืนทันทีถ้าว่างอยู่แล้ว) */
  #whenIdle(): Promise<void> {
    if (!this.#animating && this.#queue.length === 0) return Promise.resolve();
    return new Promise((resolve) => this.#idleWaiters.push(resolve));
  }

  #animateTurn({ axis, angle, pieceIds }: TurnSpec): Promise<void> {
    this.#pivot.quaternion.identity();
    this.#pivot.updateMatrixWorld(true);
    for (const id of pieceIds) this.#pivot.attach(this.#meshes[id]!);

    // แกนหมุนเป็นเวกเตอร์อะไรก็ได้ (Pyraminx ในก้อนที่ 2 ใช้แกนเอียง ไม่ใช่ x/y/z)
    const axisVector = new THREE.Vector3(axis[0]!, axis[1]!, axis[2]!).normalize();
    this.#progress.t = 0;

    return new Promise((resolve) => {
      const finish = () => {
        this.#releasePivot(pieceIds);
        resolve();
      };
      this.#finishAnimation = finish;
      gsap.to(this.#progress, {
        t: 1,
        duration: (this.#playingAlg ? PLAYBACK_TURN_MS : TURN_DURATION_MS) / 1000,
        ease: 'power2.inOut',
        onUpdate: () => {
          this.#pivot.quaternion.setFromAxisAngle(axisVector, angle * this.#progress.t);
          this.#invalidate();
        },
        onComplete: finish,
      });
    });
  }

  /** คืนชิ้นจาก pivot กลับเข้าฉาก แล้วบังคับให้ภาพตรงกับสถานะภายในเป๊ะ ๆ */
  #releasePivot(pieceIds: readonly number[]): void {
    this.#finishAnimation = null;
    for (const id of pieceIds) this.#scene.attach(this.#meshes[id]!);
    this.#pivot.quaternion.identity();
    this.#syncMeshes();
  }

  /** ยกเลิกอนิเมชันที่ค้างอยู่ทั้งหมด แล้วคืน mesh กลับเข้าฉาก */
  #cancelAnimations(): void {
    this.#queue = [];
    gsap.killTweensOf(this.#progress);
    this.#finishAnimation?.();
    this.#pivot.quaternion.identity();
    for (const mesh of this.#meshes) this.#scene.attach(mesh);
    this.#syncMeshes();
  }

  // ---------------------------------------------------------------- ลากเพื่อหมุน

  #screenPoint(world: THREE.Vector3): { x: number; y: number } {
    const projected = world.clone().project(this.#camera);
    const rect = this.#renderer.domElement.getBoundingClientRect();
    return {
      x: (projected.x * 0.5 + 0.5) * rect.width,
      y: (-projected.y * 0.5 + 0.5) * rect.height,
    };
  }

  /**
   * เวกเตอร์บนจอ (พิกเซล) ที่ตรงกับการหมุนจุด `point` รอบแกนนี้ **1 เรเดียน**
   *
   * เป็นหัวใจของทั้งการเดาแกนและการหมุนตามนิ้ว: ความเร็วของจุดคือ `ω × r` เอาไปฉายลงจอ
   * แล้วหารด้วยมุมที่ใช้ทดลอง — ได้อัตราแลกเปลี่ยน "พิกเซลที่ลาก ↔ เรเดียนที่หมุน"
   * วิธีนี้ใช้กับรูปทรงอะไรก็ได้ ไม่ต้องรู้ว่าหน้าตั้งฉากกับแกนไหม (ADR-025 ข้อ 4)
   */
  #screenPerRadian(point: THREE.Vector3, axis: THREE.Vector3): { x: number; y: number } | null {
    const tangent = axis.clone().cross(point);
    const speed = tangent.length();
    if (speed < 1e-6) return null; // จับตรงแกนพอดี — หมุนแล้วจุดนี้ไม่ขยับ ตัดสินทิศไม่ได้
    if (speed < MIN_TURN_RADIUS) tangent.setLength(MIN_TURN_RADIUS);
    const step = 0.05 / tangent.length(); // มุมทดลองเล็ก ๆ พอที่จะประมาณเป็นเส้นตรงได้

    const origin = this.#screenPoint(point);
    const moved = this.#screenPoint(point.clone().addScaledVector(tangent, step));
    const x = (moved.x - origin.x) / step;
    const y = (moved.y - origin.y) / step;
    return Math.hypot(x, y) < 1e-6 ? null : { x, y }; // มองจากปลายแกนพอดี
  }

  /** ยิงรังสีหาชิ้นที่กดโดน พร้อมหน้าที่โดน — คืน `null` ถ้ากดโดนพื้นหลัง */
  #raycast(event: PointerEvent): PointerHit | null {
    const rect = this.#renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.#camera);
    const hit = raycaster.intersectObjects(this.#meshes, false)[0];
    if (!hit) return null;

    // `face.normal` เป็นพิกัดของตัว mesh เอง ต้องแปลงเป็นพิกัดโลกก่อนถึงจะเทียบกับแกนหมุนได้
    const normal = hit.face
      ? hit.face.normal
          .clone()
          .applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld))
          .normalize()
      : null;
    return { pieceId: hit.object.userData.pieceId as number, point: hit.point.clone(), normal };
  }

  #onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;

    // นิ้วที่สองระหว่างลากหน้าคิวบ์ = กำลังจะซูม → ปิดท่าที่ค้าง แล้วปล่อยให้ OrbitControls รับช่วง
    if (this.#gesture) {
      this.#endGesture(true);
      return;
    }
    if (!this.#turnsEnabled || this.#playingAlg) return;

    let hit = this.#raycast(event);
    if (!hit) return; // ไม่โดนตัวคิวบ์ = ปล่อยให้ OrbitControls หมุนกล้องตามปกติ

    // ท่าก่อนหน้ายังดีดไม่เข้าที่ → ตัดจบก่อน แล้ว **ยิงรังสีใหม่** เพราะชิ้นเพิ่งกระโดดเข้าที่
    if (this.#finishAnimation || this.#queue.length > 0) {
      this.#cancelAnimations();
      hit = this.#raycast(event);
      if (!hit) return;
    }

    // **ห้ามปิด `controls.enabled`** — ต้องให้ OrbitControls นับนิ้วต่อไป ไม่งั้นนิ้วที่สอง
    // จะไม่ถูกนับ แล้ว pinch zoom จะพังทุกครั้งที่นิ้วแรกลงบนตัวคิวบ์ (ADR-029)
    this.#controls.enableRotate = false;
    this.#gesture = {
      pointerId: event.pointerId,
      pieceId: hit.pieceId,
      point: hit.point,
      normal: hit.normal,
      startX: event.clientX,
      startY: event.clientY,
      turn: null,
    };
    window.addEventListener('pointermove', this.#onPointerMove);
    window.addEventListener('pointerup', this.#onPointerUp);
    window.addEventListener('pointercancel', this.#onPointerUp);
  };

  #onPointerMove = (event: PointerEvent): void => {
    const gesture = this.#gesture;
    if (!gesture || event.pointerId !== gesture.pointerId) return;

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;

    if (!gesture.turn) {
      const distance = Math.hypot(dx, dy);
      if (distance < DRAG_THRESHOLD_PX) return;

      const turn = this.#turnForDrag(gesture, dx / distance, dy / distance);
      // ทิศกำกวมเกินกว่าจะเดาได้ → จบท่านี้ไปเลย ดีกว่าหมุนผิดชั้นให้ผู้เล่นตามแก้
      if (!turn) {
        this.#endGesture(false);
        return;
      }
      gesture.turn = turn;
      this.#pivot.quaternion.identity();
      this.#pivot.updateMatrixWorld(true);
      for (const id of turn.pieceIds) this.#pivot.attach(this.#meshes[id]!);
    }

    // ชั้นหมุนตามนิ้วต่อเนื่อง — ยังไม่ลงบัญชีเป็น move จนกว่าจะปล่อยนิ้ว
    // **จำกัดไว้ที่หนึ่งช่วงต่อการลากหนึ่งครั้ง** ลากเลยไปก็ค้างอยู่ที่สุดช่วง: ลากยาว ๆ
    // แล้วได้หลายช่วงติดกันคุมยากกว่าเดิมมาก (เจ้าของทดสอบแล้วสั่งแก้ 2026-09-06)
    const turn = gesture.turn;
    const raw = (dx * turn.screenX + dy * turn.screenY) / turn.screenLengthSq;
    turn.angle = Math.max(-turn.unit, Math.min(turn.unit, raw));
    this.#pivot.quaternion.setFromAxisAngle(turn.axis, turn.angle);
    this.#invalidate();
  };

  #onPointerUp = (): void => this.#endGesture(true);

  /**
   * แกนที่ลากชิ้นนี้แล้วหมุนได้ **หลังตัดแกนที่ตั้งฉากกับหน้าที่จับออก**
   *
   * ตัวตัดนี้คือสิ่งที่ทำให้ทิศแม่นขึ้น: บนลูกบาศก์จริง จับหน้า U แล้วลาก ยังไงก็ไม่ได้ move
   * `U` — ต้องไปจับหน้าข้าง การปล่อยให้แกน y เข้ามาแข่งด้วยจึงมีแต่ทำให้เดาผิด
   * (พีระมิดผิวเอียงส่วนใหญ่ไม่มีแกนไหนเข้าเงื่อนไข ก็จะได้ตัวเลือกเท่าเดิม)
   */
  #candidatesFor(gesture: Gesture): DragCandidate[] {
    const candidates = this.#spec.model.dragCandidates(gesture.pieceId);
    const normal = gesture.normal;
    if (!normal) return candidates;

    const usable = candidates.filter((candidate) => {
      const axis = new THREE.Vector3(candidate.axis[0]!, candidate.axis[1]!, candidate.axis[2]!);
      return Math.abs(axis.normalize().dot(normal)) < FACE_AXIS_MAX_DOT;
    });
    // ตัดแล้วไม่เหลืออะไรเลยก็ใช้ของเดิม ดีกว่าลากแล้วไม่มีอะไรเกิดขึ้น
    return usable.length > 0 ? usable : candidates;
  }

  /**
   * เลือกว่าจะหมุนแกนไหน จากทิศที่ผู้เล่นเริ่มลาก
   *
   * ชิ้นที่จับอยู่ในชั้นของหลายแกนพร้อมกัน จึงต้องเดา: ลองหมุนรอบแต่ละแกนที่โมเดลเสนอมา
   * ดูว่า **จุดที่จับ** จะเคลื่อนไปทางไหนบนจอ แล้วเลือกแกนที่ทิศตรงกับที่ลากมากที่สุด
   */
  #turnForDrag(gesture: Gesture, dirX: number, dirY: number): ActiveTurn | null {
    let best: { move: string; score: number } | null = null;

    for (const candidate of this.#candidatesFor(gesture)) {
      const axis = new THREE.Vector3(candidate.axis[0]!, candidate.axis[1]!, candidate.axis[2]!);
      const screen = this.#screenPerRadian(gesture.point, axis);
      if (!screen) continue;

      const score = (dirX * screen.x + dirY * screen.y) / Math.hypot(screen.x, screen.y);
      if (!best || Math.abs(score) > Math.abs(best.score)) best = { move: candidate.move, score };
    }

    if (!best || Math.abs(best.score) < DIRECTION_MATCH_MIN) return null;
    if (!isAllowedMove(this.cubeType, best.move)) return null;

    // ชิ้นที่หมุนต้องคิดจากสถานะ **ก่อน** ลง move — ตอนนี้ยังไม่มีอะไรถูกลงบัญชี
    const spec = this.#spec.model.turnFor(best.move);
    const unit = Math.abs(spec.angle);
    if (unit < 1e-6) return null;

    // ให้ "มุมบวกรอบ axis" หมายถึง best.move เสมอ เครื่องหมายของมุมจะได้ตรงกับทิศที่ลาก
    const axis = new THREE.Vector3(spec.axis[0]!, spec.axis[1]!, spec.axis[2]!)
      .normalize()
      .multiplyScalar(Math.sign(spec.angle));
    const screen = this.#screenPerRadian(gesture.point, axis);
    if (!screen) return null;

    return {
      move: best.move,
      axis,
      pieceIds: spec.pieceIds,
      unit,
      screenX: screen.x,
      screenY: screen.y,
      screenLengthSq: screen.x * screen.x + screen.y * screen.y,
      angle: 0,
    };
  }

  /**
   * จบท่าที่ลากอยู่ — `snap = true` คือปัดเข้าช่วงที่ใกล้ที่สุดแล้วลงบัญชีเป็น move จริง
   * (`false` = คืนชั้นกลับที่เดิม ใช้ตอนถูกขัดจังหวะ เช่น สั่ง scramble ใหม่ระหว่างลาก)
   */
  #endGesture(snap: boolean): void {
    const gesture = this.#gesture;
    if (!gesture) return;

    this.#gesture = null;
    this.#controls.enableRotate = true;
    window.removeEventListener('pointermove', this.#onPointerMove);
    window.removeEventListener('pointerup', this.#onPointerUp);
    window.removeEventListener('pointercancel', this.#onPointerUp);

    const turn = gesture.turn;
    if (!turn) return; // ลากไม่ถึงเกณฑ์ = แค่คลิกเฉย ๆ ไม่มีอะไรต้องคืน

    // มุมถูกจำกัดไว้ที่หนึ่งช่วงตั้งแต่ตอนลากแล้ว ผลจึงมีได้แค่ −1 / 0 / +1 ช่วง
    const steps = snap ? Math.round(turn.angle / turn.unit) : 0;
    // ลงบัญชีทันที ไม่รออนิเมชันดีดเข้าที่ (เหตุผลเดียวกับ #applyMoveState)
    if (steps !== 0) this.#applyMoveState(steps > 0 ? turn.move : inverseMove(turn.move), 'player');

    this.#snapTo(turn, steps * turn.unit);
  }

  /** ดีดชั้นจากมุมที่ลากค้างไว้ ไปยังมุมที่ปัดแล้ว — เวลาสั้นลงตามระยะที่เหลือ */
  #snapTo(turn: ActiveTurn, target: number): void {
    const from = turn.angle;
    const distance = Math.abs(target - from);
    if (distance < 1e-4) {
      this.#releasePivot(turn.pieceIds);
      return;
    }

    this.#finishAnimation = () => this.#releasePivot(turn.pieceIds);
    this.#progress.t = 0;
    gsap.to(this.#progress, {
      t: 1,
      duration: Math.min(1, distance / turn.unit) * (SNAP_DURATION_MS / 1000),
      ease: 'power2.out',
      onUpdate: () => {
        this.#pivot.quaternion.setFromAxisAngle(
          turn.axis,
          from + (target - from) * this.#progress.t,
        );
        this.#invalidate();
      },
      onComplete: () => this.#releasePivot(turn.pieceIds),
    });
  }

  /** ปิดท่าที่ผู้เล่นลากค้างไว้ให้เข้าที่ **ทันที** ก่อนที่โปรแกรมจะเข้ามาใช้ pivot ต่อ */
  #settleGesture(): void {
    if (!this.#gesture) return;
    this.#endGesture(true);
    gsap.killTweensOf(this.#progress);
    this.#finishAnimation?.();
  }

  // ---------------------------------------------------------------- CubeView

  setScramble(scramble: string, opts?: SetScrambleOptions): Promise<void> {
    const moves = scramble.split(/\s+/).filter(Boolean);
    // ตรวจให้ครบ **ก่อนแตะสถานะ** ไม่งั้น scramble ที่ผิดจะทิ้งคิวบ์ไว้กลางทาง
    // (เจอจริง: ส่ง scramble ของ 3x3x3 ให้คิวบ์ 2x2x2 ตอนสลับประเภท แล้วทั้งหน้าจอตายยกแผง)
    // ทางที่มีอนิเมชันก็ต้องตรวจตรงนี้เหมือนกัน — ห้ามปล่อยให้ไปโยน error กลางอนิเมชัน
    const bad = moves.find((move) => !isAllowedMove(this.cubeType, move));
    if (bad !== undefined) {
      throw new Error(`scramble มี move "${bad}" ที่ใช้กับ ${this.cubeType} ไม่ได้`);
    }

    this.#endGesture(false);
    this.#cancelAnimations();

    const generation = ++this.#stateGeneration;
    this.#scramble = scramble;
    this.#spec.model.reset();

    // ทางปกติ (ห้องแข่ง + ค่าเริ่มต้นทุกที่): ใส่สถานะให้ทันที ไม่มีอนิเมชัน
    if (!opts?.animate || moves.length === 0) {
      for (const move of moves) this.#spec.model.apply(move);
      this.#syncMeshes();

      this.#scrambledPattern = this.#spec.kpuzzle.defaultPattern().applyAlg(new Alg(scramble));
      this.#pattern = this.#scrambledPattern;
      this.#moves = [];
      this.#emit();
      return Promise.resolve();
    }

    return this.#animateScramble(moves, generation);
  }

  /**
   * หมุน scramble ให้ดูทีละท่าจากคิวบ์ที่แก้เสร็จ — **ห้องฝึกซ้อมเท่านั้น** (ADR-032 ข้อ 1)
   *
   * เดินทีละท่าจริง ๆ ผ่าน `#playAlg` (ADR-033) ระหว่างนี้ `#playingAlg` เป็น `true`
   * ผู้เล่นจึงหมุนแทรกไม่ได้ · จบแล้วค่อย **ล้างบัญชี move ทิ้ง** เพราะท่าของ scramble
   * ไม่ใช่ move ของผู้เล่น และ scramble ที่หมุนครบแล้วคือ "จุดออกตัว" ของรอบนี้
   */
  async #animateScramble(moves: readonly string[], generation: number): Promise<void> {
    // ออกตัวจากคิวบ์ครบสีเสมอ — นี่คือภาพที่ผู้เล่นต้องเห็นก่อนอนิเมชันเริ่ม
    this.#syncMeshes();
    this.#scrambledPattern = this.#spec.kpuzzle.defaultPattern();
    this.#pattern = this.#scrambledPattern;
    this.#moves = [];
    this.#emit();

    await this.#playAlg(moves, generation);

    // ถูกสั่ง scramble ใหม่ (หรือถูกทิ้ง) ระหว่างเล่นอยู่ → สถานะเป็นของรอบใหม่แล้ว ห้ามเขียนทับ
    if (this.#superseded(generation)) return;

    this.#scrambledPattern = this.#pattern;
    this.#moves = [];
    this.#emit();
  }

  applyMove(move: string): Promise<void> {
    if (!isAllowedMove(this.cubeType, move)) {
      throw new Error(`move "${move}" ใช้กับ ${this.cubeType} ไม่ได้`);
    }
    this.#commit(move, 'program');
    // คืนทันทีที่สถานะเปลี่ยน ไม่รออนิเมชัน (ดูเหตุผลที่ #applyMoveState)
    return Promise.resolve();
  }

  reset(): Promise<void> {
    return this.setScramble(this.#scramble);
  }

  /**
   * แก้คิวบ์ให้เสร็จพร้อมอนิเมชัน — ย้อน move ของผู้เล่นแล้วย้อน scramble ทีละตัว
   *
   * ใช้กับปุ่ม "เสร็จทันที" ของห้องฝึกซ้อม (คนที่แก้รูบิคไม่เป็นก็ต้องทดสอบระบบได้)
   * **หมุนจริงทีละท่าด้วยความเร็วเดียวกับ scramble** (ADR-033) — ของเดิมลง move ทั้งชุด
   * รวดเดียวแล้วคิวบ์เด้งไปครบสีตั้งแต่ท่าแรก ท่าที่เหลือกลายเป็นภาพหลอก
   *
   * ชุดที่ต้องย้อน = scramble + move ที่ผู้เล่นหมุนไปแล้ว ยิ่งหมุนเล่นเยอะยิ่งรอนาน —
   * ยอมแลก เพราะปุ่มนี้มีไว้ให้ **คนที่แก้รูบิคไม่เป็นได้เห็นว่าแก้ยังไง** ถ้าเร็วจนดูไม่ทัน
   * ก็ไม่ต่างอะไรกับกระโดดไปครบสีเลย
   */
  async solve(): Promise<void> {
    if (this.#playingAlg) return;
    this.#settleGesture();

    const scrambleMoves = this.#scramble.split(/\s+/).filter(Boolean);
    const undo = [...scrambleMoves, ...this.#moves].reverse().map(inverseMove);
    if (undo.length === 0) return;

    // ยึดสถานะเป็นของรอบนี้ — ถ้ามี `setScramble`/`reset` แซงเข้ามา อนิเมชันต้องหยุดกลางคัน
    await this.#playAlg(undo, ++this.#stateGeneration);
  }

  setTurnsEnabled(enabled: boolean): void {
    this.#turnsEnabled = enabled;
    // ปิดกลางคัน (เช่นเข้าช่วง inspection) → ปัดท่าที่ลากค้างให้จบตามที่ผู้เล่นตั้งใจ
    if (!enabled) this.#endGesture(true);
  }

  getState(): CubeState {
    return { moves: this.#moves, solved: this.#spec.isSolved(this.#pattern) };
  }

  subscribe(listener: CubeStateListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  subscribeMoves(listener: CubeMoveListener): () => void {
    this.#moveListeners.add(listener);
    return () => this.#moveListeners.delete(listener);
  }

  dispose(): void {
    this.#disposed = true;
    this.#playingAlg = false;
    this.#endGesture(false);
    for (const wake of this.#idleWaiters) wake();
    this.#idleWaiters = [];
    this.#listeners.clear();
    this.#moveListeners.clear();
    this.#queue = [];
    gsap.killTweensOf(this.#progress);
    if (this.#animationFrame !== 0) cancelAnimationFrame(this.#animationFrame);
    this.#animationFrame = 0;
    this.#resizeObserver.disconnect();
    this.#container.removeEventListener('pointerdown', this.#onPointerDown, { capture: true });
    this.#controls.removeEventListener('change', this.#invalidate);
    this.#controls.dispose();
    for (const mesh of this.#meshes) mesh.geometry.dispose();
    this.#material.dispose();
    this.#renderer.dispose();
    this.#renderer.domElement.remove();
  }
}
