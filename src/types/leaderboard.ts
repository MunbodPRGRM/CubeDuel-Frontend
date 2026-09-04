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
