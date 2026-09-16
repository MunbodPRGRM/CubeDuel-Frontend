import { createContext } from 'react';
import type { QueueKind, QueueRival, QueueTimeoutReason } from './types';
import type { CubeType } from '@/types/cube';

/**
 * สถานะของคิวจับคู่อัตโนมัติ — **เป็นของทั้งแอป ไม่ใช่ของหน้าใดหน้าหนึ่ง** (ADR-040 ข้อ 1)
 *
 * เหตุผลที่ไม่ทำเป็น hook ประจำหน้า: server พาผู้เล่น **กลับเข้าคิวเอง** เมื่อห้องแข่งขัน
 * ถูกยุบก่อนเริ่มจับเวลา (`game-rules.md` ข้อ 6 · ADR-039 ข้อ 6) ตอนนั้นผู้ใช้อยู่หน้าห้อง
 * ไม่ใช่หน้าที่กดเข้าคิว — ถ้าไม่มีใครฟัง `queue:status` อยู่ ผู้ใช้จะอยู่ในคิวโดยไม่รู้ตัว
 * แล้วโดนดึงเข้าห้องใหม่แบบไม่มีปี่มีขลุ่ย
 */

export type QueuePhase =
  /** ไม่ได้อยู่ในคิว */
  | 'idle'
  /** กำลังรอคู่ */
  | 'queued'
  /**
   * เจอกลุ่มแล้ว **แต่ยังไม่มีห้อง** — ต้องกด "เล่นเลย / ยกเลิก" ภายใน 12 วินาที (ADR-077)
   * ยังนับว่าอยู่ในคิวอยู่ ถ้ากลุ่มถูกยกเลิกจะกลับมาเป็น `queued` เอง
   */
  | 'ready_check'
  /**
   * หมดเวลาแล้วและ **server เอาออกจากคิวให้แล้ว** — ดู `timedOutReason` ว่าหมดเวลาตัวไหน
   * (รอครบ 180 วิไม่เจอใคร หรือเจอคู่แล้วไม่กดยืนยันทัน)
   */
  | 'timeout';

/** กลุ่มที่กำลังรอยืนยัน — มีค่าเฉพาะตอน `phase === 'ready_check'` */
export interface QueueReadyCheck {
  /** คนอื่นในกลุ่ม ไม่รวมตัวเอง */
  rivals: QueueRival[];
  /** จำนวนคนทั้งกลุ่มรวมตัวเอง */
  groupSize: number;
  /** กดยอมรับไปแล้วกี่คน — โชว์ "2/4" ในห้องหลายคน */
  acceptedCount: number;
  /** เรากดยอมรับไปแล้วหรือยัง — ใช้ล็อกปุ่ม ค่านี้มาจาก server ไม่ใช่จำเอง */
  youAccepted: boolean;
  /** เวลาของ **นาฬิกา server** ที่หมดเวลายืนยัน — ใช้คู่กับ `ServerClock` เท่านั้น */
  expiresAtTs: number;
}

export interface QueueState {
  phase: QueuePhase;
  /**
   * ช่องคิวที่กำลังรออยู่ — `competitive` = หาคู่ 1v1 · `multiplayer` = หากลุ่ม 3–4 คน
   * `null` เฉพาะตอน `idle` · ค่านี้มาจาก `queue:status` ของ server ไม่ใช่จำจากตอนกดเอง
   * เพราะ server พาเรากลับเข้าคิวเองได้เมื่อห้องยุบก่อนเริ่ม (ADR-044 ข้อ 2)
   */
  kind: QueueKind | null;
  /** ประเภทรูบิคที่กำลังรออยู่ — `null` เฉพาะตอน `idle` (เหตุผลเดียวกับ `kind`) */
  cubeType: CubeType | null;
  /** เวลาของ **นาฬิกา server** ที่เริ่มรอ — ใช้คู่กับ `ServerClock` เท่านั้น */
  queuedAtTs: number | null;
  /** ช่วง Elo ที่ยอมรับตอนนี้ · `null` = ไม่จำกัดแล้ว (รอเกิน 120 วิ) */
  eloWindow: number | null;
  /** จำนวนคนในคิวช่องเดียวกัน (ประเภทเดียวกัน) รวมตัวเอง */
  playersInQueue: number;
  /** รอไปทั้งหมดกี่ ms ก่อนหมดเวลา — มีค่าเฉพาะตอน `phase === 'timeout'` */
  timedOutAfterMs: number | null;
  /** หมดเวลาเพราะอะไร — มีค่าเฉพาะตอน `phase === 'timeout'` (ADR-077 ข้อ 6) */
  timedOutReason: QueueTimeoutReason | null;
  /** กลุ่มที่รอยืนยันอยู่ — `null` ทุก phase ยกเว้น `ready_check` */
  readyCheck: QueueReadyCheck | null;
  /**
   * ข้อความอธิบายสิ่งที่ server เพิ่งทำให้เอง (เช่นกลุ่มถูกยกเลิกแล้วพากลับเข้าคิว)
   * แยกจาก `error` เพราะไม่ใช่ความผิดพลาด — จอควรแสดงคนละโทนสี
   */
  notice: string | null;
}

export interface QueueContextValue extends QueueState {
  /** กำลังรอ ack ของ `queue:join` / `queue:leave` */
  busy: boolean;
  error: string | null;
  /** คืน `true` เมื่อเข้าคิวสำเร็จ — `kind` เลือกช่องคิว (1v1 หรือ 3–4 คน) */
  join: (cubeType: CubeType, kind: QueueKind) => Promise<boolean>;
  leave: () => Promise<void>;
  /** กด "เล่นเลย" ในหน้ายืนยัน — ครบทุกคนแล้ว server ถึงจะสร้างห้อง (ADR-077) */
  accept: () => Promise<void>;
  /** กด "ยกเลิก" ในหน้ายืนยัน — ออกจากคิวไปเลย */
  decline: () => Promise<void>;
  /** ปิดข้อความหมดเวลา/ข้อผิดพลาดทิ้ง */
  dismiss: () => void;
}

export const QueueContext = createContext<QueueContextValue | null>(null);
