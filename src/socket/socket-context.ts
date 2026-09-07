import { createContext } from 'react';
import type { ServerClock } from './clock';
import type { TypedClientSocket } from './socket-client';
import type { AckError } from './types';

/**
 * `idle` = ยังไม่ล็อกอิน จึงยังไม่ต่อ · `connecting` = กำลังต่อ/กำลังต่อใหม่
 * `connected` = ใช้งานได้ · `error` = ต่อไม่ได้ด้วยเหตุผลที่ผู้ใช้ต้องรู้ (ดู `error`)
 */
export type SocketStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface SocketContextValue {
  /** null ตอนยังไม่ล็อกอิน — ทุกหน้าที่ใช้ต้องเช็คก่อน */
  socket: TypedClientSocket | null;
  status: SocketStatus;
  error: AckError | null;
  /** นาฬิกาที่เทียบกับ server แล้ว — ใช้แทน `Date.now()` ทุกที่ที่นับถอยหลัง */
  clock: ServerClock;
  /** RTT ล่าสุด (ms) — `null` = ยังไม่เคย ping สำเร็จ */
  rttMs: number | null;
  /** สั่งต่อใหม่ด้วยมือหลังเจอ error */
  reconnect: () => void;
}

export const SocketContext = createContext<SocketContextValue | null>(null);
