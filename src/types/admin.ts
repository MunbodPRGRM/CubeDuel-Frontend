import type { CubeType } from './cube';
import type { UserRole, UserStatus } from './auth';

/**
 * รูปร่างข้อมูลของ endpoint กลุ่มแอดมิน + ระบบรายงาน — ต้องตรงกับ docs/api-contract.md ข้อ 8 และ 9
 *
 * ⚠️ ไม่ได้แชร์กับ backend (ADR-021) — แก้ payload เมื่อไหร่ต้องแก้เอกสารก่อนแล้วไล่แก้สองฝั่ง
 */

export interface AdminDashboard {
  /** มาจาก memory ของ Socket.IO ไม่ใช่ DB (ADR-050 ข้อ 6) */
  activeRooms: number;
  onlineUsers: number;
  totalUsers: number;
  matchesToday: number;
  /** เรียงเก่า → ใหม่ · ตัวสุดท้ายคือวันนี้ */
  matchesLast7Days: number[];
  pendingReports: number;
  /** เฉพาะ flag ที่ยังไม่ได้ตรวจ — เป็นคิวงาน ไม่ใช่ยอดสะสม */
  flaggedMatches: number;
  byCubeType: Record<CubeType, number>;
}

export interface AdminUser {
  userId: number;
  username: string;
  nickname: string | null;
  /** endpoint ของแอดมินเท่านั้นที่ได้ email มาด้วย */
  email: string;
  role: UserRole;
  status: UserStatus;
  suspendedUntil: string | null;
  deletedAt: string | null;
  createdAt: string;
  reportCount: number;
  flagCount: number;
}

export type ReportAction = 'none' | 'warning' | 'suspend' | 'reset_rating';

export const REPORT_ACTION_LABEL: Record<ReportAction, string> = {
  none: 'ไม่ผิด (ปิดเรื่อง)',
  warning: 'ตักเตือน',
  suspend: 'ระงับบัญชี',
  reset_rating: 'รีเซ็ตคะแนนทั้ง 4 ประเภท',
};

export interface AdminReport {
  reportId: number;
  reason: string;
  reportStatus: 'pending' | 'resolved';
  createdAt: string;
  reporter: { userId: number; username: string; nickname: string | null };
  reported: {
    userId: number;
    username: string;
    nickname: string | null;
    status: UserStatus;
    /** เคยถูกแจ้งมาแล้วกี่ครั้ง — ดูก่อนตัดสินว่าเป็นครั้งแรกหรือครั้งที่ 12 */
    reportCount: number;
  };
  matchId: number | null;
  multiplayerMatchId: number | null;
  reviewedBy: number | null;
  reviewedAt: string | null;
  actionTaken: ReportAction | null;
  adminNote: string | null;
}

export type FlagReason =
  'impossible_time' | 'low_move_count' | 'high_tps' | 'move_gap' | 'win_streak';

export const FLAG_REASON_LABEL: Record<FlagReason, string> = {
  impossible_time: 'เวลาต่ำผิดปกติ',
  low_move_count: 'จำนวน move น้อยผิดปกติ',
  high_tps: 'หมุนเร็วเกินมนุษย์',
  move_gap: 'ระยะห่างระหว่าง move สั้นผิดปกติ',
  win_streak: 'ชนะรวดผิดปกติ',
};

export type FlagVerdict = 'clean' | 'cheating' | 'inconclusive';

export const FLAG_VERDICT_LABEL: Record<FlagVerdict, string> = {
  clean: 'ไม่พบการโกง',
  cheating: 'พบการโกง',
  inconclusive: 'สรุปไม่ได้',
};

export interface MatchFlag {
  flagId: number;
  flagReason: FlagReason;
  /** รูปไม่ตายตัว — ต่างกันตามเกณฑ์ที่ทำให้ถูก flag (database-schema.md ตารางที่ 11) */
  detail: Record<string, unknown>;
  user: { userId: number; username: string; nickname: string | null };
  matchId: number | null;
  multiplayerMatchId: number | null;
  hasMoveLog: boolean;
  moveLogLength: number;
  verdict: FlagVerdict | null;
  reviewedBy: number | null;
  reviewedAt: string | null;
  createdAt: string;
}

/** ได้เฉพาะตอนเปิดทีละใบ (`GET /admin/matches/flagged/:flagId`) — ADR-050 ข้อ 5 */
export interface MatchFlagDetail extends MatchFlag {
  moveLog: Array<{ seq: number; move: string; ms: number }> | null;
}

/** วันที่แบบสั้นสำหรับตารางของแอดมิน */
export function formatAdminDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
