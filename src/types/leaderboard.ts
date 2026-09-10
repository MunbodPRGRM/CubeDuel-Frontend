import type { CubeType } from './cube';

/**
 * รูปร่างข้อมูลของกระดานอันดับและคะแนนรายบุคคล — ต้องตรงกับ docs/api-contract.md ข้อ 3 และ ข้อ 5
 */

export interface LeaderboardRow {
  rank: number;
  userId: number;
  username: string;
  nickname: string | null;
  eloRating: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  /** 0–1 (ปัดทศนิยม 4 ตำแหน่งจากฝั่ง server) */
  winRate: number;
  /** วินาที — `null` = ยังไม่เคยมีเวลาที่บันทึกลง DB */
  bestTime: number | null;
}

/**
 * แถวของ `scope=weekly` — **รูปไม่เหมือน `scope=all`** (api-contract.md ข้อ 5)
 * ตัวเลขนับทุกตัวเป็นของ "สัปดาห์นี้" ไม่ใช่ยอดสะสม และมี `eloChange` ซึ่งเป็นคีย์จัดอันดับ
 */
export interface WeeklyLeaderboardRow extends LeaderboardRow {
  /** ผลรวม `elo_change` ของสัปดาห์นี้ */
  eloChange: number;
}

export type LeaderboardScope = 'all' | 'weekly';
export type LeaderboardSort = 'elo' | 'bestTime';

/** `meta` ของ `GET /leaderboard` — `weekStart`/`weekEnd` มีเฉพาะ `scope=weekly` */
export interface LeaderboardMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  scope: LeaderboardScope;
  cubeType: CubeType;
  weekStart?: string;
  weekEnd?: string;
  /** `PageMeta` ของ `apiFetchPage` เปิดช่องอื่นไว้ด้วย — ต้องมีให้ตรงกัน */
  [key: string]: unknown;
}

/** แถวที่ตารางวาดจริง — weekly มี `eloChange` เพิ่มมาช่องเดียว จึงใช้ตัวเดียวกันได้ */
export type AnyLeaderboardRow = LeaderboardRow & { eloChange?: number };

export interface UserRating {
  cubeType: CubeType;
  eloRating: number;
  rank: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  bestTime: number | null;
  updatedAt: string;
}

/** ชื่อประเภทรูบิคที่แสดงบนหน้าจอ */
export const CUBE_TYPE_LABEL: Record<CubeType, string> = {
  '2x2x2': '2x2x2',
  '3x3x3': '3x3x3',
  pyraminx: 'Pyraminx',
  pyramorphix: 'Pyramorphix',
};
