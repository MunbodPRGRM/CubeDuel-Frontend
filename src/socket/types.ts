/**
 * สัญญาของ Socket.IO ฝั่ง client — **ไฟล์เดียวของทั้ง repo นี้**
 *
 * แหล่งความจริงคือ `docs/socket-events.md` ห้ามเพิ่ม/แก้ event ที่นี่โดยไม่แก้เอกสารก่อน
 * ⚠️ ต้องตรงกับ `backend/src/sockets/types.ts` เป๊ะ ๆ — คนละ repo ไม่มีอะไรเตือนถ้าลืม (ADR-021)
 */
import type { CubeType } from '@/types/cube';

export type { CubeType };

export type RoomKind = 'competitive' | 'multiplayer' | 'custom';
export type RoomMode = 'auto' | 'custom';

export type RoomState =
  | 'WAITING'
  | 'MATCHED'
  | 'LOADING'
  | 'COUNTDOWN'
  | 'INSPECTION'
  | 'SOLVING'
  | 'FINAL_COUNTDOWN'
  | 'FINISHED'
  | 'ABORTED';

/** state ที่ถือว่า "กำลังแข่งอยู่" — ออกจากห้องกลางคันตอนนี้มีผลกับเกม (ADR-034 ข้อ 4) */
export const ACTIVE_STATES: readonly RoomState[] = [
  'MATCHED',
  'LOADING',
  'COUNTDOWN',
  'INSPECTION',
  'SOLVING',
  'FINAL_COUNTDOWN',
];

export function isActiveState(state: RoomState): boolean {
  return ACTIVE_STATES.includes(state);
}

export interface PlayerPublic {
  userId: number;
  username: string;
  nickname: string | null;
  /** Elo ของ cube_type ที่กำลังแข่ง (ไม่ใช่ค่ารวม — Rating แยก 4 แถวต่อคน) */
  eloRating: number;
  isHost: boolean;
  isReady: boolean;
  connected: boolean;
}

export type SolveStatus = 'solving' | 'solved' | 'dnf' | 'surrendered';

export interface PlayerProgress {
  userId: number;
  moveCount: number;
  status: SolveStatus;
  /** null = ยังไม่จบ หรือ DNF */
  solveTimeMs: number | null;
}

export interface RoomSnapshot {
  roomId: number;
  roomKind: RoomKind;
  /** null สำหรับห้องแข่งขัน 1v1 */
  roomMode: RoomMode | null;
  /** มีเฉพาะห้องที่สร้างเอง */
  roomCode: string | null;
  cubeType: CubeType;
  state: RoomState;
  maxPlayers: number;
  players: PlayerPublic[];
  progress: PlayerProgress[];
  spectatorCount: number;
  /** ส่งตอน LOADING เป็นต้นไปเท่านั้น */
  scramble: string | null;
  /** เวลาปัจจุบันของ server ใช้ sync นาฬิกา */
  serverTs: number;
  /** เวลาที่ phase ปัจจุบันจะจบ (countdown / inspection / final countdown) */
  phaseEndsAtTs: number | null;
  /** เวลาที่เริ่มจับเวลา — มีค่าตั้งแต่ SOLVING */
  serverStartTs: number | null;
  /**
   * แถวผลของรอบล่าสุดในห้องนี้ — `null` จนกว่ารอบแรกจะจบและบันทึกสำเร็จ
   * ใช้เปิดผลย้อนหลังตอนไม่ได้รับ `match:finished` (ADR-040 ข้อ 5)
   */
  matchId: number | null;
  /** `matchId` เป็นเลขของตารางไหน — `null` เมื่อ `matchId` เป็น `null` (ADR-044 ข้อ 1) */
  matchKind: MatchKind | null;
  /**
   * server นี้รับ `solve:dev_finish` ไหม — `false` ต้องไม่แสดงปุ่ม "เสร็จทันที" เลย
   * ปุ่มทดสอบ (ADR-060) · ⚠️ ถอดออกก่อน deploy
   */
  devInstantFinish: boolean;
}

/**
 * ตารางที่เก็บผลของรอบนั้น — **`match_id` กับ `multiplayer_match_id` ชนกันได้ตลอด**
 * เพราะเป็น auto-increment คนละตัว · `'1v1'` อ่านที่ `GET /matches/:matchId`
 * `'multiplayer'` อ่านที่ `GET /multiplayer-matches/:multiplayerMatchId` (ADR-044 ข้อ 1)
 *
 * ⚠️ **ห้ามเดาจาก `roomKind` เอง** — ห้องหลายคนที่จบด้วยผู้เล่นไม่ถึง 3 คนไม่ได้บันทึกลง
 * ตารางนั้น เดาผิดแล้วผู้เล่นจะเห็นผลแมตช์ของคนอื่นโดยไม่มีอะไรฟ้อง
 */
export type MatchKind = '1v1' | 'multiplayer';

// ---------------------------------------------------------------- error + ack

/** รหัส error ของฝั่ง socket — คนละชุดกับ `ApiErrorCode` ของ REST (ADR-034 ข้อ 5) */
export type SocketErrorCode =
  | 'E_VALIDATION'
  | 'E_UNAUTHENTICATED'
  | 'E_ROOM_NOT_FOUND'
  | 'E_ROOM_FULL'
  | 'E_NOT_HOST'
  | 'E_INVALID_STATE'
  | 'E_MOVE_DURING_INSPECTION'
  | 'E_INVALID_MOVE'
  | 'E_SEQ_MISMATCH'
  | 'E_NOT_SOLVED'
  | 'E_ALREADY_IN_QUEUE'
  | 'E_ACCOUNT_SUSPENDED'
  | 'E_RATE_LIMITED'
  | 'E_INTERNAL';

export interface AckError {
  code: SocketErrorCode;
  message: string;
}

export type Ack<T> = { ok: true; data: T } | { ok: false; error: AckError };

export type AckFn<T> = (response: Ack<T>) => void;

// ---------------------------------------------------------------- payload

export interface NetPingPayload {
  clientTs: number;
  /** RTT ที่ client วัดได้จาก ping ครั้งก่อน — ครั้งแรกไม่ต้องส่ง */
  lastRttMs?: number;
}
export interface NetPingResult {
  serverTs: number;
  clientTs: number;
}

/**
 * คิวจับคู่อัตโนมัติ — คนละช่องคิวกันโดยสิ้นเชิง (แยกตาม `kind` + `cubeType`)
 *   - `competitive` = 1v1 มีช่วง Elo ขยายตามเวลารอ
 *   - `multiplayer` = 3–4 คน ไม่ใช้ช่วง Elo จับตามลำดับเข้าคิว (game-rules.md ข้อ 8)
 */
export type QueueKind = 'competitive' | 'multiplayer';

export interface QueueJoinPayload {
  cubeType: CubeType;
  kind: QueueKind;
}
export interface QueueJoinResult {
  queuedAtTs: number;
  playersInQueue: number;
}
export interface QueueLeaveResult {
  /** false = ไม่ได้อยู่ในคิวอยู่แล้ว (ไม่ถือว่าผิดพลาด) */
  left: boolean;
}
export interface QueueStatusPayload {
  /**
   * ช่องคิวที่กำลังรออยู่ — **client จำเองไม่ได้** เพราะ server พาเข้าคิวเองได้เมื่อห้องยุบ
   * ก่อนเริ่มจับเวลา (ADR-039 ข้อ 6 · ADR-044 ข้อ 2)
   */
  kind: QueueKind;
  cubeType: CubeType;
  waitedMs: number;
  /**
   * null = ไม่จำกัดช่วงคะแนน — คิว 1v1 ที่รอเกิน 120 วิ (game-rules.md ข้อ 8)
   * และ **คิวห้องผู้เล่นหลายคนเสมอ** เพราะไม่ใช้ช่วง Elo เลย
   */
  eloWindow: number | null;
  /** จำนวนคนในคิวช่องเดียวกัน (kind + cubeType) รวมตัวเอง */
  playersInQueue: number;
}
export interface QueueMatchedPayload {
  roomId: number;
  cubeType: CubeType;
  players: PlayerPublic[];
}
export interface QueueTimeoutPayload {
  waitedMs: number;
}

export interface RoomCreatePayload {
  cubeType: CubeType;
  /** `custom` = 1v1 (2 คน) · `multiplayer` = 3–4 คน · ทั้งคู่เป็นห้องที่มีรหัสห้อง */
  kind: 'custom' | 'multiplayer';
  maxPlayers: 2 | 3 | 4;
}
export interface RoomCreateResult {
  roomId: number;
  roomCode: string;
}

export interface RoomJoinPayload {
  roomCode: string;
  as: 'player' | 'spectator';
}
export interface RoomRejoinPayload {
  roomId: number;
}
export interface RoomSnapshotResult {
  snapshot: RoomSnapshot;
}

export interface RoomReadyPayload {
  ready: boolean;
}

export type LeaveReason = 'left' | 'disconnected' | 'kicked';
export type AbortReason = 'player_left' | 'timeout' | 'host_left';

export interface SolveMovePayload {
  /** เริ่มที่ 1 เพิ่มทีละ 1 — ข้ามหรือซ้ำ = `E_SEQ_MISMATCH` */
  seq: number;
  /** notation ตัวเดียว เช่น `R`, `U'`, `F2` — ห้ามหลาย move ใน string เดียว */
  move: string;
  clientTs: number;
}

export interface SolveSolvedPayload {
  seq: number;
  moveCount: number;
  clientTs: number;
}

export interface SolveSolvedResult {
  solveTimeMs: number;
  rankNo: number;
}

export type DnfReason = 'surrender' | 'timeout' | 'disconnect' | 'invalid';

// ---------------------------------------------------------------- ผลการแข่งขัน

export interface MatchResultEntry {
  userId: number;
  username: string;
  /** null = DNF */
  solveTimeMs: number | null;
  moveCount: number;
  rankNo: number;
  /** null = ห้องที่ไม่ปรับคะแนน */
  eloBefore: number | null;
  eloAfter: number | null;
  eloChange: number | null;
}

export interface MatchResult {
  /** null = ห้องที่ไม่บันทึก DB */
  matchId: number | null;
  /** `matchId` เป็นเลขของตารางไหน — `null` เมื่อ `matchId` เป็น `null` (ADR-044 ข้อ 1) */
  matchKind: MatchKind | null;
  roomKind: RoomKind;
  cubeType: CubeType;
  scramble: string;
  /** true เฉพาะห้องแข่งขัน + ห้องหลายคนโหมด auto */
  ratingApplied: boolean;
  /** เรียงตาม rankNo แล้ว client ไม่ต้องเรียงเอง */
  results: MatchResultEntry[];
  finishedAtTs: number;
}

// ---------------------------------------------------------------- event map

export interface ClientToServerEvents {
  'net:ping': (payload: NetPingPayload, ack?: AckFn<NetPingResult>) => void;
  'queue:join': (payload: QueueJoinPayload, ack?: AckFn<QueueJoinResult>) => void;
  'queue:leave': (payload: Record<string, never>, ack?: AckFn<QueueLeaveResult>) => void;
  'room:create': (payload: RoomCreatePayload, ack?: AckFn<RoomCreateResult>) => void;
  'room:join': (payload: RoomJoinPayload, ack?: AckFn<RoomSnapshotResult>) => void;
  'room:rejoin': (payload: RoomRejoinPayload, ack?: AckFn<RoomSnapshotResult>) => void;
  'room:leave': (payload: Record<string, never>, ack?: AckFn<null>) => void;
  'room:ready': (payload: RoomReadyPayload, ack?: AckFn<null>) => void;
  'room:start': (payload: Record<string, never>, ack?: AckFn<null>) => void;
  'solve:ready': (payload: Record<string, never>, ack?: AckFn<null>) => void;
  /** ไม่มี ack เพื่อความลื่น — server เงียบถ้าผ่าน ผิดเมื่อไรส่ง event `error` */
  'solve:move': (payload: SolveMovePayload) => void;
  'solve:solved': (payload: SolveSolvedPayload, ack?: AckFn<SolveSolvedResult>) => void;
  'solve:surrender': (payload: Record<string, never>, ack?: AckFn<null>) => void;
  /** ปุ่มทดสอบ — server ปฏิเสธเสมอถ้าไม่ได้เปิดสวิตช์ (ADR-060) */
  'solve:dev_finish': (payload: Record<string, never>, ack?: AckFn<SolveSolvedResult>) => void;
}

export interface ServerToClientEvents {
  'queue:status': (payload: QueueStatusPayload) => void;
  'queue:matched': (payload: QueueMatchedPayload) => void;
  'queue:timeout': (payload: QueueTimeoutPayload) => void;

  'room:state': (snapshot: RoomSnapshot) => void;
  'room:player_joined': (payload: { player: PlayerPublic }) => void;
  'room:player_left': (payload: { userId: number; reason: LeaveReason }) => void;
  'room:host_changed': (payload: { newHostUserId: number }) => void;
  'room:ready_changed': (payload: { userId: number; ready: boolean }) => void;
  'room:spectator_count': (payload: { count: number }) => void;
  'room:aborted': (payload: { reason: AbortReason; message: string }) => void;

  'match:loading': (payload: { scramble: string; cubeType: CubeType; deadlineTs: number }) => void;
  'match:countdown': (payload: { startsAtTs: number; durationMs: number }) => void;
  'match:inspection_started': (payload: { endsAtTs: number; durationMs: number }) => void;
  'match:started': (payload: { serverStartTs: number }) => void;
  'match:final_countdown': (payload: {
    firstSolverUserId: number;
    endsAtTs: number;
    durationMs: number;
  }) => void;
  'match:finished': (payload: MatchResult) => void;

  'opponent:move': (payload: {
    userId: number;
    seq: number;
    move: string;
    serverTs: number;
  }) => void;
  'opponent:progress': (payload: { userId: number; moveCount: number; elapsedMs: number }) => void;
  'player:solved': (payload: {
    userId: number;
    solveTimeMs: number;
    moveCount: number;
    rankNo: number;
  }) => void;
  'player:dnf': (payload: { userId: number; reason: DnfReason }) => void;
  'player:disconnected': (payload: { userId: number; graceEndsAtTs: number }) => void;
  'player:reconnected': (payload: { userId: number }) => void;

  error: (payload: AckError) => void;
}

/** ชื่อที่แสดงบนหน้าจอของผู้เล่นในห้อง — ไม่มีชื่อเล่นให้ใช้ username แทน */
export function playerName(player: Pick<PlayerPublic, 'username' | 'nickname'>): string {
  return player.nickname?.trim() || player.username;
}
