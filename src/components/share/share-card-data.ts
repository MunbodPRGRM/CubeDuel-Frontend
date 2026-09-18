/**
 * แปลง payload ที่หน้าจอโหลดไว้อยู่แล้ว → ข้อมูลที่จะไปอยู่บนการ์ดแชร์ (ADR-074 ข้อ 3)
 *
 * แยกจากตัววาด (`draw-share-card.ts`) เพื่อให้ตัววาดไม่ต้องรู้จักรูปของ API เลย
 * **ห้ามใส่อะไรที่ไม่ใช่ข้อมูลสาธารณะลงในนี้** (ไม่มี email · ไม่มี `bio`)
 */

import { formatSolveTime } from '@/lib/format';
import type { CubeType } from '@/types/cube';
import type { UserRating } from '@/types/leaderboard';
import type { MatchDetail, MultiplayerMatchDetail } from '@/types/match';
import type { PublicUser, UserStats } from '@/types/stats';
import type { SolveStatus } from '@/socket/types';

export interface ProfileCardData {
  kind: 'profile';
  name: string;
  username: string;
  cubeType: CubeType;
  elo: number | null;
  wins: number;
  losses: number;
  /** 0–1 · `null` = ยังไม่เคยแข่ง */
  winRate: number | null;
  best: number | null;
  ao5: number | null;
  ao12: number | null;
  /** ISO · `null` = ยังไม่รู้ (โหลดโปรไฟล์ไม่ทัน) */
  since: string | null;
  url: string;
}

export interface MatchCardPlayer {
  name: string;
  /** ข้อความที่จะพิมพ์จริง — เวลา หรือ `DNF` / `ยอมแพ้` (เวลา `null` ห้ามกลายเป็น 0) */
  label: string;
}

export interface MatchCardData {
  kind: 'match';
  outcome: 'win' | 'loss' | 'draw';
  cubeType: CubeType;
  roomLabel: string;
  self: MatchCardPlayer;
  /** คู่แข่งในห้อง 1v1 · `null` = ห้องผู้เล่นหลายคน (ใช้ `rank` แทน) */
  rival: MatchCardPlayer | null;
  rank: { rankNo: number; playerCount: number } | null;
  /** `null` = ห้องที่ไม่ปรับคะแนน — ต้องเขียนว่า "ไม่ปรับคะแนน" ไม่ใช่ +0 */
  eloChange: number | null;
  moveCount: number | null;
  playedAt: string;
  /** `#12` — เลขของ **ตารางนั้น** ไม่ใช่เลขรวม (ADR-044 ข้อ 1) */
  matchNo: string;
  url: string;
}

export type ShareCardData = ProfileCardData | MatchCardData;

const SOLVE_LABEL: Record<SolveStatus, string> = {
  solving: 'ยังไม่จบ',
  solved: 'แก้สำเร็จ',
  dnf: 'DNF',
  surrendered: 'ยอมแพ้',
};

function solveLabel(result: SolveStatus, solveTime: number | null): string {
  return result === 'solved' ? formatSolveTime(solveTime) : SOLVE_LABEL[result];
}

function displayName(player: { username: string; nickname: string | null }): string {
  return player.nickname || player.username;
}

/** เติมโดเมนให้พาธ — การ์ดต้องโชว์ลิงก์เต็มเพราะคนอ่านจากรูป กดไม่ได้ */
export function absoluteUrl(path: string): string {
  return new URL(path, window.location.origin).toString();
}

export function buildProfileCard(input: {
  userId: number;
  profile: PublicUser | null;
  rating: UserRating | null;
  stats: UserStats | null;
  cubeType: CubeType;
}): ProfileCardData {
  const { profile, rating, stats } = input;
  return {
    kind: 'profile',
    name: profile ? displayName(profile) : '—',
    username: profile?.username ?? '',
    cubeType: input.cubeType,
    elo: rating?.eloRating ?? null,
    wins: stats?.wins ?? rating?.wins ?? 0,
    losses: stats?.losses ?? rating?.losses ?? 0,
    winRate: stats?.winRate ?? null,
    best: stats?.best ?? rating?.bestTime ?? null,
    ao5: stats?.ao5 ?? null,
    ao12: stats?.ao12 ?? null,
    since: profile?.createdAt ?? null,
    url: absoluteUrl(`/users/${input.userId}`),
  };
}

/**
 * การ์ดของแมตช์เดียว — มองจาก `subjectUserId` (เจ้าของประวัติที่หน้านั้นไฮไลต์อยู่)
 * ถ้าคนดูไม่ได้อยู่ในแมตช์ ให้มองจากผู้เล่นอันดับ 1 แทน (ADR-074 ข้อ 6)
 */
export function buildMatchCard(
  detail: MatchDetail | MultiplayerMatchDetail,
  subjectUserId: number,
): MatchCardData {
  const players = detail.players;
  const self = players.find((p) => p.userId === subjectUserId) ?? players[0]!;
  const is1v1 = 'matchId' in detail;

  const rival = is1v1 ? (players.find((p) => p.userId !== self.userId) ?? null) : null;

  const outcome: MatchCardData['outcome'] =
    detail.winnerId === null ? 'draw' : detail.winnerId === self.userId ? 'win' : 'loss';

  const roomLabel = is1v1
    ? detail.roomType === 'competitive'
      ? 'ห้องแข่งขัน'
      : 'ห้องสร้างเอง'
    : detail.roomMode === 'auto'
      ? 'ห้องหลายคน'
      : 'ห้องหลายคน (สร้างเอง)';

  return {
    kind: 'match',
    outcome,
    cubeType: detail.cubeType,
    roomLabel,
    self: { name: displayName(self), label: solveLabel(self.result, self.solveTime) },
    rival: rival
      ? { name: displayName(rival), label: solveLabel(rival.result, rival.solveTime) }
      : null,
    rank: is1v1 ? null : { rankNo: self.rankNo, playerCount: detail.playerCount },
    eloChange: self.eloChange,
    moveCount: self.moveCount,
    playedAt: detail.startedAt,
    matchNo: `#${is1v1 ? detail.matchId : detail.multiplayerMatchId}`,
    url: absoluteUrl(
      is1v1 ? `/matches/${detail.matchId}` : `/multiplayer-matches/${detail.multiplayerMatchId}`,
    ),
  };
}

/** ชื่อไฟล์ที่ดาวน์โหลดแล้วรู้เรื่องว่าเป็นอะไร */
export function shareCardFileName(data: ShareCardData): string {
  return data.kind === 'profile'
    ? `cubeduel-profile-${data.username || 'player'}.png`
    : `cubeduel-match-${data.matchNo.replace('#', '')}.png`;
}
