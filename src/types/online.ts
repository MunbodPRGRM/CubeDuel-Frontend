import type { CubeType } from './cube';

/**
 * `GET /users/online` (api-contract.md ข้อ 3 · ADR-086) — ต้องตรงกับ `OnlineUsersDto` ฝั่ง backend
 * ไม่มี `roomCode` โดยตั้งใจ: รหัสห้องคือกุญแจเข้าห้อง (ADR-082)
 */
export type OnlineActivity = 'playing' | 'spectating' | 'in_room' | 'queue' | 'idle';

export interface OnlineUser {
  userId: number;
  username: string;
  nickname: string | null;
  activity: OnlineActivity;
  /** ประเภทของห้อง/คิว · `idle` = `null` */
  cubeType: CubeType | null;
}

export interface OnlineUsers {
  /** สมาชิกออนไลน์ทั้งหมด — ตัวเลขเดียวกับ `presence:count` */
  online: number;
  /** คนที่ตรงกับคำค้นก่อนตัดที่ `limit` */
  total: number;
  users: OnlineUser[];
}

/** server ส่งมาไม่เกินเท่านี้ต่อครั้ง ไม่มีหน้าที่ 2 */
export const ONLINE_USERS_LIMIT = 50;

export const ACTIVITY_LABEL: Record<OnlineActivity, string> = {
  playing: 'กำลังแข่ง',
  spectating: 'ดูการแข่ง',
  in_room: 'อยู่ในห้อง',
  queue: 'รอจับคู่',
  idle: 'ว่าง',
};
