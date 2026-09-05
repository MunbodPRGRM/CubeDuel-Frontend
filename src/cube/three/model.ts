/**
 * สัญญาระหว่าง **ตัววาด** (`ThreeCubeView`) กับ **โมเดลของรูบิคแต่ละประเภท**
 *
 * ตัววาดไม่รู้เลยว่าเป็นลูกบาศก์หรือพีระมิด รู้แค่ว่า "move นี้หมุนชิ้นไหน รอบแกนไหน กี่องศา"
 * ประเภทใหม่ (เช่น Pyraminx ในก้อนที่ 2) แค่เขียนคลาสที่ทำตาม interface นี้ก็ใช้ตัววาดเดิมได้
 *
 * ไฟล์ในสายนี้ **ห้าม import three หรือ DOM** — สคริปต์ `verify-*` รันบน Node เปล่า ๆ ต้องเรียกได้
 */
import type { Mat3, Vec3 } from './lattice.ts';

/** สิ่งที่ตัววาดต้องรู้เพื่อเล่นอนิเมชันหมุนหนึ่งครั้ง */
export interface TurnSpec {
  /** แกนหมุน (เวกเตอร์หนึ่งหน่วย) — ทิศบวกตามกฎมือขวา */
  axis: Vec3;
  /** มุมเป็นเรเดียน (บวก = ตามกฎมือขวา) */
  angle: number;
  /** id ของชิ้นที่ต้องหมุน — ต้องคิดจากสถานะ **ก่อน** ลง move */
  pieceIds: number[];
}

/** ตัวเลือกที่เกิดได้เมื่อผู้เล่นลากบนชิ้นหนึ่ง ๆ */
export interface DragCandidate {
  /** แกนที่จะหมุน (เวกเตอร์หนึ่งหน่วย) */
  axis: Vec3;
  /** ชื่อ move เมื่อหมุน **ทางบวกตามกฎมือขวา** รอบแกนนี้ (ทางลบใช้ `inverseMove`) */
  move: string;
}

export interface PuzzleModel {
  readonly pieceCount: number;

  /** การหมุนสะสมของชิ้น (หมุนรอบจุดกำเนิด — geometry ของทุกชิ้นอบพิกัดบ้านไว้แล้ว) */
  rotationOf(pieceId: number): Mat3;

  /** แปลง move เป็นแกน/มุม/ชิ้นที่ต้องหมุน — **ต้องเรียกก่อน `apply`** */
  turnFor(move: string): TurnSpec;

  /** ลง move ลงสถานะภายใน (ไม่แตะภาพ) */
  apply(move: string): void;

  /** กลับไปสถานะที่แก้เสร็จ */
  reset(): void;

  /** ลากชิ้นนี้แล้วหมุนอะไรได้บ้าง */
  dragCandidates(pieceId: number): DragCandidate[];
}
