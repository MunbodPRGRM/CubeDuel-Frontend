import type { CubeType } from './cube';
import type { UserRole } from './auth';

/**
 * รูปร่างข้อมูลของสถิติ ประวัติการแข่ง และโปรไฟล์สาธารณะ
 * — ต้องตรงกับ `docs/api-contract.md` ข้อ 3 (`/users/:userId`, `/users/:userId/matches`) และ ข้อ 4
 *
 * ⚠️ ไฟล์นี้ไม่ได้แชร์กับ backend (ADR-021) แก้ payload ต้องแก้เอกสารก่อนแล้วไล่แก้ทั้งสองฝั่ง
 */

/** โปรไฟล์สาธารณะ — **ไม่มี email** (ต่างจาก `SelfUser` ที่ได้จาก `/users/me`) */
export interface PublicUser {
  userId: number;
  username: string;
  nickname: string | null;
  role: UserRole;
  createdAt: string;
}

/**
 * `GET /users/:userId/stats?cubeType=` — เวลาเป็นวินาที `null` = ยังคำนวณไม่ได้
 * (ไม่ครบ N ครั้ง หรือ DNF เกิน 1 ครั้งใน N ครั้งนั้น — กติกา WCA ใน api-contract.md ข้อ 4)
 */
export interface UserStats {
  cubeType: CubeType;
  totalSolves: number;
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  dnfCount: number;
  best: number | null;
  worst: number | null;
  mean: number | null;
  ao5: number | null;
  ao12: number | null;
  ao100: number | null;
  /** สตรีค**ชนะ** — เสมอทำให้ขาดเหมือนแพ้ (ADR-045 ข้อ 2) */
  currentStreak: number;
  bestStreak: number;
}

/** ผลของแมตช์เมื่อมองจากเจ้าของประวัติ — ไม่ใช่สถานะของ solve */
export type MatchOutcome = 'win' | 'loss' | 'draw';

interface MatchHistoryBase {
  cubeType: CubeType;
  scramble: string;
  /** วินาที — `null` = DNF/ยอมแพ้ */
  myTime: number | null;
  /** จำนวน move ของเจ้าของประวัติ — `null` = แมตช์เก่าที่ยังไม่ได้เก็บ (ADR-047 ข้อ 1) */
  moveCount: number | null;
  result: MatchOutcome;
  /** `null` = ห้องที่ไม่ปรับคะแนน */
  eloChange: number | null;
  startedAt: string;
}

export interface MatchHistory1v1Row extends MatchHistoryBase {
  kind: '1v1';
  matchId: number;
  roomType: 'competitive' | 'custom';
  opponent: { userId: number; username: string; nickname: string | null };
  opponentTime: number | null;
}

export interface MatchHistoryMultiRow extends MatchHistoryBase {
  kind: 'multiplayer';
  multiplayerMatchId: number;
  roomMode: 'auto' | 'custom';
  rankNo: number;
  playerCount: number;
}

/**
 * ⚠️ `kind` เป็นตัวเลือก endpoint ตอนกดดูผลเต็ม **ห้ามเดาจากอย่างอื่น** —
 * `match_id` กับ `multiplayer_match_id` เป็น auto-increment คนละตัวและชนกันได้ (ADR-044 ข้อ 1)
 */
export type MatchHistoryRow = MatchHistory1v1Row | MatchHistoryMultiRow;

/** เลข id ที่ใช้เรียกผลเต็มของแถวนั้น คู่กับ endpoint ที่ต้องยิง */
export function matchRefOf(row: MatchHistoryRow): { kind: '1v1' | 'multiplayer'; id: number } {
  return row.kind === '1v1'
    ? { kind: '1v1', id: row.matchId }
    : { kind: 'multiplayer', id: row.multiplayerMatchId };
}
