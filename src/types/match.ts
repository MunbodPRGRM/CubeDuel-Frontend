import type { CubeType } from './cube';
import type { SolveStatus } from '@/socket/types';

/**
 * ผลของแมตช์ 1v1 ที่ขอย้อนหลังทาง REST — ต้องตรงกับ `docs/api-contract.md` ข้อ 3
 * (`GET /matches/:matchId`) · ใช้ตอนไม่ได้รับ `match:finished` เพราะเพิ่งกด F5 หรือเพิ่งเข้ามาดู
 */

export interface MatchDetailPlayer {
  userId: number;
  username: string;
  nickname: string | null;
  /** 1 = ผู้เล่นที่เข้าคิว/สร้างห้องก่อน */
  seatNo: 1 | 2;
  rankNo: number;
  /** วินาที — `null` = DNF/ยอมแพ้ */
  solveTime: number | null;
  result: SolveStatus;
  moveCount: number;
  /** `null` ทั้งสามช่องในห้องที่ไม่ปรับคะแนน */
  eloBefore: number | null;
  eloAfter: number | null;
  eloChange: number | null;
}

export interface MatchDetail {
  matchId: number;
  roomType: 'competitive' | 'custom';
  cubeType: CubeType;
  scramble: string;
  roomCode: string | null;
  winnerId: number | null;
  spectatorCount: number;
  startedAt: string;
  finishedAt: string | null;
  ratingApplied: boolean;
  /** เรียงตาม `rankNo` แล้ว */
  players: MatchDetailPlayer[];
}

/**
 * ผลของแมตช์ผู้เล่นหลายคนที่ขอย้อนหลังทาง REST — `GET /multiplayer-matches/:id`
 * (`docs/api-contract.md` ข้อ 3) · **คนละตารางกับ `MatchDetail` และเลข id ชนกันได้**
 * จึงต้องดู `RoomSnapshot.matchKind` ก่อนว่าจะยิงไปที่ endpoint ไหน (ADR-044 ข้อ 1)
 */
export interface MultiplayerMatchDetailPlayer {
  userId: number;
  username: string;
  nickname: string | null;
  /** เก็บใน DB จริง ไม่ได้คำนวณใหม่แบบ 1v1 */
  rankNo: number;
  /** วินาที — `null` = DNF/ยอมแพ้ */
  solveTime: number | null;
  result: SolveStatus;
  moveCount: number;
  /** `null` ทั้งสามช่องในโหมด custom ที่ไม่ปรับคะแนน */
  eloBefore: number | null;
  eloAfter: number | null;
  eloChange: number | null;
}

export interface MultiplayerMatchDetail {
  multiplayerMatchId: number;
  roomMode: 'auto' | 'custom';
  cubeType: CubeType;
  scramble: string;
  roomCode: string | null;
  /** 3 หรือ 4 */
  playerCount: number;
  winnerId: number | null;
  startedAt: string;
  finishedAt: string | null;
  ratingApplied: boolean;
  /** เรียงตาม `rankNo` แล้ว */
  players: MultiplayerMatchDetailPlayer[];
}
