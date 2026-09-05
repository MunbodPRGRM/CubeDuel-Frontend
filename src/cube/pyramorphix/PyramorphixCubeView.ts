/**
 * เส้นทางที่ 2 ของ interface กลาง — **Pyramorphix เขียน renderer เองด้วย Three.js** (ADR-019)
 *
 * `<twisty-player>` ใช้กับ Pyramorphix ไม่ได้ (โมเดล `"t e 0"` รับได้แค่ move 180°)
 * ที่นี่จึงแบ่งหน้าที่เป็น:
 *   - ตรรกะ/ผลแพ้ชนะ → `KPattern` ของ **2x2x2** (ชุดเดียวกับที่ server ใช้ replay)
 *   - ภาพ            → ชิ้นส่วน 8 ชิ้นที่หมุนด้วยเมทริกซ์จำนวนเต็ม (`PieceModel`)
 *
 * ทั้งสองฝั่งพิสูจน์แล้วว่าตรงกันเป๊ะทุก move — ดู `scripts/verify-pyramorphix.ts`
 *
 * **shape-shifting เกิดเอง** ไม่ต้องเขียนโค้ดพิเศษ เพราะแต่ละชิ้นเป็นของแข็งที่คงรูปตัวเอง
 */
import gsap from 'gsap';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Alg } from 'cubing/alg';
import type { KPattern } from 'cubing/kpuzzle';
import type { CubeType } from '@/types/cube';
import { isAllowedMove } from '../moves';
import { deriveApexSlots, deriveSlotOctants, getKPuzzle, isPyramorphixSolved } from '../puzzle';
import type { CubeState, CubeStateListener, CubeView } from '../types';
import { buildPieceGeometry } from './tetra-geometry';
import {
  IDENTITY,
  matEq,
  moveNameFor,
  parseMove,
  PieceModel,
  type Mat3,
  type ParsedMove,
} from './rotation';

/** ระยะเวลาอนิเมชันหมุนหนึ่งครั้ง — เร็วพอให้ speedcuber ไม่รู้สึกว่าคิวบ์หนืด */
const TURN_DURATION_MS = 110;
/** ต้องลากเกินกี่พิกเซลถึงจะนับว่าตั้งใจหมุนชั้น (กันการกดแล้วสั่นนิดเดียว) */
const DRAG_THRESHOLD_PX = 8;
/** ทิศที่ลากต้องตรงกับทิศการหมุนอย่างน้อยเท่านี้ ไม่งั้นถือว่ากำกวม ไม่หมุนอะไรเลย */
const DIRECTION_MATCH_MIN = 0.3;
/** ค้างคิวอนิเมชันได้มากสุดกี่ move ก่อนจะข้ามไปสถานะล่าสุดทันที */
const MAX_PENDING_TURNS = 3;

/** move ที่ลงบัญชีแล้ว รออนิเมชันอย่างเดียว */
interface QueuedTurn {
  parsed: ParsedMove;
  /** ชิ้นที่ต้องหมุน — คิดไว้ตั้งแต่ตอนลงบัญชี เพราะตอนนั้นสถานะยังเป็นก่อนหมุน */
  ids: number[];
}

export class PyramorphixCubeView implements CubeView {
  readonly cubeType: CubeType = 'pyramorphix';

  #container: HTMLElement;
  #scene: THREE.Scene;
  #camera: THREE.PerspectiveCamera;
  #renderer: THREE.WebGLRenderer;
  #controls: OrbitControls;
  #pivot: THREE.Group;
  #meshes: THREE.Mesh[] = [];
  #resizeObserver: ResizeObserver;
  #animationFrame = 0;

  #model: PieceModel;
  #apexSlots: readonly number[];
  #scrambledPattern: KPattern;
  #pattern: KPattern;
  #scramble = '';

  #moves: string[] = [];
  #listeners = new Set<CubeStateListener>();
  #queue: QueuedTurn[] = [];
  #animating = false;
  /** ปิดอนิเมชันที่ค้างอยู่ตอนถูกสั่ง scramble ใหม่ ไม่งั้นคิว move จะค้างตลอดไป */
  #finishAnimation: (() => void) | null = null;
  #turnsEnabled = true;
  #disposed = false;

  /** ข้อมูลของนิ้ว/เมาส์ที่กำลังลากอยู่บนตัวคิวบ์ */
  #drag: { pointerId: number; pieceId: number; point: THREE.Vector3; x: number; y: number } | null =
    null;

  private constructor(
    container: HTMLElement,
    slotOctants: number[][],
    apexSlots: number[],
    solvedPattern: KPattern,
  ) {
    this.#container = container;
    this.#apexSlots = apexSlots;
    this.#model = new PieceModel(slotOctants);
    this.#scrambledPattern = solvedPattern;
    this.#pattern = solvedPattern;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;

    this.#scene = new THREE.Scene();
    this.#camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    this.#camera.position.set(3.4, 2.6, 3.4);
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
    this.#controls.minDistance = 3;
    this.#controls.maxDistance = 12;

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.45,
      metalness: 0.02,
      flatShading: true,
    });
    for (let i = 0; i < slotOctants.length; i++) {
      const mesh = new THREE.Mesh(buildPieceGeometry(slotOctants[i]!), material);
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

  static async create(container: HTMLElement): Promise<PyramorphixCubeView> {
    const kpuzzle = await getKPuzzle('pyramorphix');
    const slotOctants = deriveSlotOctants(kpuzzle);
    return new PyramorphixCubeView(
      container,
      slotOctants,
      deriveApexSlots(slotOctants),
      kpuzzle.defaultPattern(),
    );
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
      const r: Mat3 = this.#model.pieceRotation[i]!;
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
   * สำคัญมาก: ห้ามให้สถานะไปผูกกับ "อนิเมชันเล่นจบ" เพราะอนิเมชันของ GSAP เดินด้วย
   * `requestAnimationFrame` ซึ่ง **หยุดเดินเมื่อแท็บถูกพักไว้เบื้องหลัง** ถ้าผูกไว้
   * คิว move จะค้าง สถานะภาพกับสถานะจริงจะแยกกันทันที (เจอจริงตอนทดสอบเฟส 3)
   */
  #commit(move: string): void {
    const parsed = parseMove(move);
    // ต้องรู้ว่าชิ้นไหนอยู่ในชั้นนี้ *ก่อน* อัปเดตสถานะ เพราะอนิเมชันจะหมุนชิ้นเหล่านั้น
    const ids = this.#model.piecesInLayer(parsed.axis, parsed.layerSign);
    this.#model.applyParsed(parsed);
    this.#pattern = this.#pattern.applyMove(move);
    this.#moves = [...this.#moves, move];

    this.#queue.push({ parsed, ids });
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
      await this.#animateTurn(this.#queue.shift()!);
    }
    this.#animating = false;
  }

  #animateTurn({ parsed, ids }: QueuedTurn): Promise<void> {
    this.#pivot.rotation.set(0, 0, 0);
    this.#pivot.updateMatrixWorld(true);
    for (const id of ids) this.#pivot.attach(this.#meshes[id]!);

    const axisName = (['x', 'y', 'z'] as const)[parsed.axis]!;
    return new Promise((resolve) => {
      const finish = () => {
        this.#finishAnimation = null;
        for (const id of ids) this.#scene.attach(this.#meshes[id]!);
        this.#pivot.rotation.set(0, 0, 0);
        this.#syncMeshes();
        resolve();
      };
      this.#finishAnimation = finish;
      gsap.to(this.#pivot.rotation, {
        [axisName]: (Math.PI / 2) * parsed.quarters,
        duration: TURN_DURATION_MS / 1000,
        ease: 'power2.inOut',
        onComplete: finish,
      });
    });
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
    if (move) this.#commit(move);
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
   * แปลงทิศที่ลางบนจอ เป็น move
   *
   * ชิ้นที่จับอยู่ในชั้นของทั้ง 3 แกนพร้อมกัน จึงต้องเดาว่าผู้เล่นหมายถึงแกนไหน:
   * ลองหมุนรอบแต่ละแกนดูว่า **จุดที่จับ** จะเคลื่อนไปทางไหนบนจอ (`ω × r` แล้วฉายลงจอ)
   * แล้วเลือกแกนที่ทิศตรงกับที่ลากมากที่สุด — วิธีนี้ใช้ได้กับผิวเอียงของพีระมิดด้วย
   * ต่างจากวิธีของลูกบาศก์ที่อาศัยว่าหน้าตั้งฉากกับแกนเสมอ
   */
  #moveForDrag(pieceId: number, point: THREE.Vector3, dirX: number, dirY: number): string | null {
    const origin = this.#screenPoint(point);
    let best: { axis: number; score: number } | null = null;

    for (let axis = 0; axis < 3; axis++) {
      const axisVector = new THREE.Vector3(
        axis === 0 ? 1 : 0,
        axis === 1 ? 1 : 0,
        axis === 2 ? 1 : 0,
      );
      const tangent = axisVector.clone().cross(point);
      if (tangent.lengthSq() < 1e-8) continue;

      const moved = this.#screenPoint(point.clone().add(tangent.setLength(0.05)));
      const mx = moved.x - origin.x;
      const my = moved.y - origin.y;
      const length = Math.hypot(mx, my);
      if (length < 1e-6) continue;

      const score = (dirX * mx + dirY * my) / length;
      if (!best || Math.abs(score) > Math.abs(best.score)) best = { axis, score };
    }

    if (!best || Math.abs(best.score) < DIRECTION_MATCH_MIN) return null;
    const layerSign = this.#model.pieceOctant[pieceId]![best.axis]!;
    return moveNameFor(best.axis, layerSign, best.score > 0 ? 1 : -1);
  }

  // ---------------------------------------------------------------- CubeView

  async setScramble(scramble: string): Promise<void> {
    const kpuzzle = await getKPuzzle('pyramorphix');
    this.#queue = [];
    gsap.killTweensOf(this.#pivot.rotation);
    this.#finishAnimation?.();
    this.#pivot.rotation.set(0, 0, 0);
    for (const mesh of this.#meshes) this.#scene.attach(mesh);

    this.#scramble = scramble;
    this.#model.reset();
    for (const move of scramble.split(/\s+/).filter(Boolean)) {
      this.#model.applyParsed(parseMove(move));
    }
    this.#syncMeshes();

    this.#scrambledPattern = kpuzzle.defaultPattern().applyAlg(new Alg(scramble));
    this.#pattern = this.#scrambledPattern;
    this.#moves = [];
    this.#emit();
  }

  applyMove(move: string): Promise<void> {
    if (!isAllowedMove('pyramorphix', move)) {
      throw new Error(`move "${move}" ใช้กับ Pyramorphix ไม่ได้`);
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
    return { moves: this.#moves, solved: isPyramorphixSolved(this.#pattern, this.#apexSlots) };
  }

  subscribe(listener: CubeStateListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** ทรงตอนนี้ยังเป็นพีระมิดอยู่ไหม — ไว้ใช้ตอนทดสอบว่า shape-shifting ทำงานจริง */
  isTetrahedronShape(): boolean {
    const pieces = this.#model.getPiecesArray();
    return this.#apexSlots.every((slot) => this.#apexSlots.includes(pieces[slot]!));
  }

  /** ชิ้นยอดพีระมิดที่อยู่บ้านตัวเองแล้ว หันถูกทางครบทุกชิ้นไหม — ใช้ตรวจว่าภาพกับตรรกะยังตรงกัน */
  apexPiecesUpright(): boolean {
    const pieces = this.#model.getPiecesArray();
    return this.#apexSlots.every((slot) =>
      matEq(this.#model.pieceRotation[pieces[slot]!]!, IDENTITY),
    );
  }

  dispose(): void {
    this.#disposed = true;
    this.#endDrag();
    this.#listeners.clear();
    this.#queue = [];
    gsap.killTweensOf(this.#pivot.rotation);
    cancelAnimationFrame(this.#animationFrame);
    this.#resizeObserver.disconnect();
    this.#container.removeEventListener('pointerdown', this.#onPointerDown, { capture: true });
    this.#controls.dispose();
    for (const mesh of this.#meshes) mesh.geometry.dispose();
    (this.#meshes[0]?.material as THREE.Material | undefined)?.dispose();
    this.#renderer.dispose();
    this.#renderer.domElement.remove();
  }
}
