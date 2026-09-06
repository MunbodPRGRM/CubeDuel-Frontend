import type { CubeType } from '@/types/cube';

/**
 * **interface กลางของคิวบ์ 3 มิติ** (roadmap เฟส 3 ข้อแรก · ADR-019 · ADR-026)
 *
 * ตั้งแต่เฟส 3.5 ก้อนที่ 2 ข้างในเหลือ **เส้นทางเดียว** — `ThreeCubeView` วาดทั้ง 4 ประเภท
 * (`<twisty-player>` ถูกลบออกหมดแล้ว) แต่ interface นี้ยังอยู่ เพราะส่วนที่เหลือของแอป
 * (จับเวลา, นับ move, ส่ง move ขึ้น server ในเฟส 4) ไม่ควรต้องรู้จัก Three.js เลย
 */

export interface CubeState {
  /** move ที่ผู้เล่นหมุนหลังจาก scramble (ไม่รวม move ของ scramble เอง) */
  moves: readonly string[];
  /** คิวบ์ถูกแก้แล้วหรือยัง — Pyramorphix ใช้กติกาพิเศษตาม ADR-019 */
  solved: boolean;
}

export type CubeStateListener = (state: CubeState) => void;

export interface CubeView {
  readonly cubeType: CubeType;

  /**
   * ตั้ง scramble ใหม่ — ใส่ให้ทันทีแบบไม่มีอนิเมชัน และล้าง move ของผู้เล่นทิ้ง
   * scramble ต้องมาจาก server เสมอ (`GET /scramble`) ห้าม client สุ่มเอง
   */
  setScramble(scramble: string): Promise<void>;

  /** หมุนตามคำสั่ง (มีอนิเมชัน) — ใช้ตอนเล่นซ้ำ/สั่งจากปุ่ม ไม่ใช่การหมุนของผู้เล่น */
  applyMove(move: string): Promise<void>;

  /** กลับไปสถานะทันทีหลัง scramble ล่าสุด (ปุ่ม "รีเซ็ต") */
  reset(): Promise<void>;

  /**
   * เปิด/ปิดการหมุนหน้าคิวบ์ของผู้เล่น — **กล้องยังหมุนได้เสมอ**
   * ใช้ช่วง inspection ที่กติกาให้พลิกดูได้แต่ห้ามหมุน (game-rules.md ข้อ 2)
   */
  setTurnsEnabled(enabled: boolean): void;

  /** สถานะปัจจุบัน */
  getState(): CubeState;

  /** รับแจ้งทุกครั้งที่สถานะเปลี่ยน — คืนฟังก์ชันสำหรับเลิกรับแจ้ง */
  subscribe(listener: CubeStateListener): () => void;

  /** คืนทรัพยากรทั้งหมด (WebGL context, event listener, requestAnimationFrame) */
  dispose(): void;
}
