import { createContext } from 'react';
import type { QueueKind } from './types';
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
  /** รอครบ 180 วิแล้วไม่เจอใคร — server เอาออกจากคิวให้แล้ว */
  | 'timeout';

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
}

export interface QueueContextValue extends QueueState {
  /** กำลังรอ ack ของ `queue:join` / `queue:leave` */
  busy: boolean;
  error: string | null;
  /** คืน `true` เมื่อเข้าคิวสำเร็จ — `kind` เลือกช่องคิว (1v1 หรือ 3–4 คน) */
  join: (cubeType: CubeType, kind: QueueKind) => Promise<boolean>;
  leave: () => Promise<void>;
  /** ปิดข้อความหมดเวลา/ข้อผิดพลาดทิ้ง */
  dismiss: () => void;
}

export const QueueContext = createContext<QueueContextValue | null>(null);
