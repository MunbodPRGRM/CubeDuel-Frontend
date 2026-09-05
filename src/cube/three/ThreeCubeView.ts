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
import type { CubeState, CubeStateListener, CubeView } from '../types.ts';
import type { Mat3 } from './lattice.ts';
import type { PuzzleModel, TurnSpec } from './model.ts';

/** ระยะเวลาอนิเมชันหมุนหนึ่งครั้ง — เร็วพอให้ speedcuber ไม่รู้สึกว่าคิวบ์หนืด */
const TURN_DURATION_MS = 110;
/** ต้องลากเกินกี่พิกเซลถึงจะนับว่าตั้งใจหมุนชั้น (กันการกดแล้วสั่นนิดเดียว) */
const DRAG_THRESHOLD_PX = 8;
/** ทิศที่ลากต้องตรงกับทิศการหมุนอย่างน้อยเท่านี้ ไม่งั้นถือว่ากำกวม ไม่หมุนอะไรเลย */
const DIRECTION_MATCH_MIN = 0.3;
/** ค้างคิวอนิเมชันได้มากสุดกี่ move ก่อนจะข้ามไปสถานะล่าสุดทันที */
const MAX_PENDING_TURNS = 3;

/** ทุกประเภทวาดในกล่อง [-1, 1] เท่ากันหมด กล้องจึงใช้ค่าชุดเดียวได้ */
const CAMERA_POSITION: readonly [number, number, number] = [3.4, 2.6, 3.4];
const MIN_CAMERA_DISTANCE = 3;
const MAX_CAMERA_DISTANCE = 12;

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
  #animationFrame = 0;

  #scrambledPattern: KPattern;
  #pattern: KPattern;
  #scramble = '';

  #moves: string[] = [];
  #listeners = new Set<CubeStateListener>();
  #queue: QueuedTurn[] = [];
  #animating = false;
  /** ตัวที่ GSAP tween อยู่ — เก็บไว้เพื่อ kill ตอนถูกสั่ง scramble ใหม่ */
  #progress = { t: 0 };
  /** ปิดอนิเมชันที่ค้างอยู่ตอนถูกสั่ง scramble ใหม่ ไม่งั้นคิว move จะค้างตลอดไป */
  #finishAnimation: (() => void) | null = null;
  #turnsEnabled = true;
  #disposed = false;

  /** ข้อมูลของนิ้ว/เมาส์ที่กำลังลากอยู่บนตัวคิวบ์ */
  #drag: { pointerId: number; pieceId: number; point: THREE.Vector3; x: number; y: number } | null =
    null;

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
    this.#camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
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

    this.#tick();
  }

  // ---------------------------------------------------------------- ฉาก

  #tick = (): void => {
    this.#controls.update();
    this.#renderer.render(this.#scene, this.#camera);
    this.#animationFrame = requestAnimationFrame(this.#tick);
  };

  #resize(): void {
    const width = this.#container.clientWidth;
    const height = this.#container.clientHeight;
    if (width === 0 || height === 0) return;
    this.#camera.aspect = width / height;
    this.#camera.updateProjectionMatrix();
    this.#renderer.setSize(width, height);
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
  }

  // ---------------------------------------------------------------- การหมุน

  #emit(): void {
    const state = this.getState();
    for (const listener of this.#listeners) listener(state);
  }

  /**
   * ลงบัญชี move **ทันที** ทั้งฝั่งตรรกะและฝั่งภาพ แล้วค่อยไล่เล่นอนิเมชันตามหลัง
   *
   * สำคัญมาก (ADR-025 ข้อ 3): ห้ามให้สถานะไปผูกกับ "อนิเมชันเล่นจบ" เพราะอนิเมชันของ GSAP
   * เดินด้วย `requestAnimationFrame` ซึ่ง **หยุดเดินเมื่อแท็บถูกพักไว้เบื้องหลัง** ถ้าผูกไว้
   * คิว move จะค้าง สถานะภาพกับสถานะจริงจะแยกกันทันที (เจอจริงตอนทดสอบเฟส 3)
   */
  #commit(move: string): void {
    // ต้องรู้ว่าชิ้นไหนอยู่ในชั้นนี้ *ก่อน* อัปเดตสถานะ เพราะอนิเมชันจะหมุนชิ้นเหล่านั้น
    const turn = this.#spec.model.turnFor(move);
    this.#spec.model.apply(move);
    this.#pattern = this.#pattern.applyMove(move);
    this.#moves = [...this.#moves, move];

    this.#queue.push({ turn });
    void this.#drainQueue();
    this.#emit();
  }

  async #drainQueue(): Promise<void> {
    if (this.#animating) return;
    this.#animating = true;
    while (this.#queue.length > 0 && !this.#disposed) {
      // หมุนเร็วรัวจนอนิเมชันตามไม่ทัน (หรือแท็บถูกพัก) → ข้ามไปสถานะล่าสุดเลย ดีกว่าค้าง
      if (this.#queue.length > MAX_PENDING_TURNS) {
        this.#queue = [];
        this.#syncMeshes();
        break;
      }
      await this.#animateTurn(this.#queue.shift()!.turn);
    }
    this.#animating = false;
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
        this.#finishAnimation = null;
        for (const id of pieceIds) this.#scene.attach(this.#meshes[id]!);
        this.#pivot.quaternion.identity();
        this.#syncMeshes();
        resolve();
      };
      this.#finishAnimation = finish;
      gsap.to(this.#progress, {
        t: 1,
        duration: TURN_DURATION_MS / 1000,
        ease: 'power2.inOut',
        onUpdate: () =>
          this.#pivot.quaternion.setFromAxisAngle(axisVector, angle * this.#progress.t),
        onComplete: finish,
      });
    });
  }

  /** ยกเลิกอนิเมชันที่ค้างอยู่ทั้งหมด แล้วคืน mesh กลับเข้าฉาก */
  #cancelAnimations(): void {
    this.#queue = [];
    gsap.killTweensOf(this.#progress);
    this.#finishAnimation?.();
    this.#pivot.quaternion.identity();
    for (const mesh of this.#meshes) this.#scene.attach(mesh);
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

  #onPointerDown = (event: PointerEvent): void => {
    if (!this.#turnsEnabled || this.#drag !== null || event.button !== 0) return;

    const rect = this.#renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.#camera);
    const hit = raycaster.intersectObjects(this.#meshes, false)[0];
    // ไม่โดนตัวคิวบ์ = ปล่อยให้ OrbitControls หมุนกล้องตามปกติ
    if (!hit) return;

    this.#controls.enabled = false;
    this.#drag = {
      pointerId: event.pointerId,
      pieceId: hit.object.userData.pieceId as number,
      point: hit.point.clone(),
      x: event.clientX,
      y: event.clientY,
    };
    window.addEventListener('pointermove', this.#onPointerMove);
    window.addEventListener('pointerup', this.#onPointerUp);
    window.addEventListener('pointercancel', this.#onPointerUp);
  };

  #onPointerMove = (event: PointerEvent): void => {
    const drag = this.#drag;
    if (!drag || event.pointerId !== drag.pointerId) return;

    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    const distance = Math.hypot(dx, dy);
    if (distance < DRAG_THRESHOLD_PX) return;

    this.#endDrag();
    const move = this.#moveForDrag(drag.pieceId, drag.point, dx / distance, dy / distance);
    if (move && isAllowedMove(this.cubeType, move)) this.#commit(move);
  };

  #onPointerUp = (): void => this.#endDrag();

  #endDrag(): void {
    if (!this.#drag) return;
    this.#drag = null;
    this.#controls.enabled = true;
    window.removeEventListener('pointermove', this.#onPointerMove);
    window.removeEventListener('pointerup', this.#onPointerUp);
    window.removeEventListener('pointercancel', this.#onPointerUp);
  }

  /**
   * แปลงทิศที่ลากบนจอ เป็น move
   *
   * ชิ้นที่จับอยู่ในชั้นของหลายแกนพร้อมกัน จึงต้องเดาว่าผู้เล่นหมายถึงแกนไหน:
   * ลองหมุนรอบแต่ละแกนที่โมเดลเสนอมา ดูว่า **จุดที่จับ** จะเคลื่อนไปทางไหนบนจอ
   * (`ω × r` แล้วฉายลงจอ) แล้วเลือกแกนที่ทิศตรงกับที่ลากมากที่สุด
   *
   * วิธีนี้ใช้ได้กับรูปทรงอะไรก็ได้ — ต่างจากวิธีที่อาศัยว่าหน้าตั้งฉากกับแกน ซึ่งใช้กับ
   * ผิวเอียงของพีระมิดไม่ได้ (ADR-025 ข้อ 4)
   */
  #moveForDrag(pieceId: number, point: THREE.Vector3, dirX: number, dirY: number): string | null {
    const origin = this.#screenPoint(point);
    let best: { move: string; score: number } | null = null;

    for (const candidate of this.#spec.model.dragCandidates(pieceId)) {
      const axisVector = new THREE.Vector3(
        candidate.axis[0]!,
        candidate.axis[1]!,
        candidate.axis[2]!,
      );
      const tangent = axisVector.clone().cross(point);
      if (tangent.lengthSq() < 1e-8) continue;

      const moved = this.#screenPoint(point.clone().add(tangent.setLength(0.05)));
      const mx = moved.x - origin.x;
      const my = moved.y - origin.y;
      const length = Math.hypot(mx, my);
      if (length < 1e-6) continue;

      const score = (dirX * mx + dirY * my) / length;
      if (!best || Math.abs(score) > Math.abs(best.score)) best = { move: candidate.move, score };
    }

    if (!best || Math.abs(best.score) < DIRECTION_MATCH_MIN) return null;
    return best.score > 0 ? best.move : inverseMove(best.move);
  }

  // ---------------------------------------------------------------- CubeView

  setScramble(scramble: string): Promise<void> {
    this.#cancelAnimations();

    this.#scramble = scramble;
    this.#spec.model.reset();
    for (const move of scramble.split(/\s+/).filter(Boolean)) this.#spec.model.apply(move);
    this.#syncMeshes();

    this.#scrambledPattern = this.#spec.kpuzzle.defaultPattern().applyAlg(new Alg(scramble));
    this.#pattern = this.#scrambledPattern;
    this.#moves = [];
    this.#emit();
    return Promise.resolve();
  }

  applyMove(move: string): Promise<void> {
    if (!isAllowedMove(this.cubeType, move)) {
      throw new Error(`move "${move}" ใช้กับ ${this.cubeType} ไม่ได้`);
    }
    this.#commit(move);
    // คืนทันทีที่สถานะเปลี่ยน ไม่รออนิเมชัน (ดูเหตุผลที่ #commit)
    return Promise.resolve();
  }

  reset(): Promise<void> {
    return this.setScramble(this.#scramble);
  }

  setTurnsEnabled(enabled: boolean): void {
    this.#turnsEnabled = enabled;
    if (!enabled) this.#endDrag();
  }

  getState(): CubeState {
    return { moves: this.#moves, solved: this.#spec.isSolved(this.#pattern) };
  }

  subscribe(listener: CubeStateListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  dispose(): void {
    this.#disposed = true;
    this.#endDrag();
    this.#listeners.clear();
    this.#queue = [];
    gsap.killTweensOf(this.#progress);
    cancelAnimationFrame(this.#animationFrame);
    this.#resizeObserver.disconnect();
    this.#container.removeEventListener('pointerdown', this.#onPointerDown, { capture: true });
    this.#controls.dispose();
    for (const mesh of this.#meshes) mesh.geometry.dispose();
    this.#material.dispose();
    this.#renderer.dispose();
    this.#renderer.domElement.remove();
  }
}
