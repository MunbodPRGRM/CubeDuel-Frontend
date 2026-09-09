import { useMemo } from 'react';
import { useApiData } from '@/hooks/useApiData';
import type { MatchResult, RoomSnapshot } from '@/socket/types';
import type { MatchDetail, MultiplayerMatchDetail } from '@/types/match';

/**
 * ผลรอบล่าสุดของห้อง — เอาจาก `match:finished` ก่อน ไม่มีค่อยขอย้อนหลังทาง REST
 *
 * `match:finished` ส่งครั้งเดียวและขอซ้ำไม่ได้ (ADR-037 ข้อ 2) คนที่ **กด F5 หลังรอบจบ**
 * หรือ **ผู้ชมที่เพิ่งเข้าห้องที่จบไปแล้ว** จึงไม่มีตัวเลข Elo ให้ดูเลย — ซึ่งรับไม่ได้แล้ว
 * ในเฟส 5 ที่ห้องแข่งขันปรับคะแนนจริง จึงดึงจาก REST แทน โดยใช้ `snapshot.matchId`
 * ที่ server แนบมาให้ (ADR-040 ข้อ 5)
 *
 * ⚠️ **`matchKind` เป็นตัวเลือก endpoint ห้ามเดาจาก `roomKind` เอง** — `match_id` กับ
 * `multiplayer_match_id` เป็น auto-increment คนละตัวและชนกันได้ ยิงผิด endpoint แปลว่า
 * ผู้เล่นเห็นผลแมตช์ของคนอื่นโดยไม่มีอะไรฟ้อง (ADR-044 ข้อ 1)
 */
export function useMatchResult(
  snapshot: RoomSnapshot | null,
  live: MatchResult | null,
): MatchResult | null {
  // ขอเฉพาะตอนที่จำเป็นจริง ๆ — ยังอยู่ในห้องเดิมและไม่มีผลสด ๆ อยู่ในมือ
  const wanted = live === null && snapshot?.state === 'FINISHED' && snapshot.matchId !== null;
  const duelPath = wanted && snapshot.matchKind === '1v1' ? `/matches/${snapshot.matchId}` : null;
  const multiPath =
    wanted && snapshot.matchKind === 'multiplayer'
      ? `/multiplayer-matches/${snapshot.matchId}`
      : null;

  const { data: duel } = useApiData<MatchDetail>(duelPath);
  const { data: multi } = useApiData<MultiplayerMatchDetail>(multiPath);

  return useMemo(() => {
    if (live) return live;
    if (duel) return fromDuel(duel);
    if (multi) return fromMultiplayer(multi);
    return null;
  }, [live, duel, multi]);
}

/** DB เก็บเวลาเป็นวินาทีทศนิยม 2 ตำแหน่ง ส่วนหน้าจอคิดเป็นมิลลิวินาที */
function toMs(seconds: number | null): number | null {
  return seconds === null ? null : Math.round(seconds * 1000);
}

/** แปลงรูปของ REST ให้เป็นรูปเดียวกับ `match:finished` เพื่อให้หน้าจอมีทางเดินเดียว */
function fromDuel(detail: MatchDetail): MatchResult {
  return {
    matchId: detail.matchId,
    matchKind: '1v1',
    roomKind: detail.roomType,
    cubeType: detail.cubeType,
    scramble: detail.scramble,
    ratingApplied: detail.ratingApplied,
    results: detail.players.map((player) => ({
      userId: player.userId,
      username: player.username,
      solveTimeMs: toMs(player.solveTime),
      moveCount: player.moveCount,
      rankNo: player.rankNo,
      eloBefore: player.eloBefore,
      eloAfter: player.eloAfter,
      eloChange: player.eloChange,
    })),
    finishedAtTs: detail.finishedAt === null ? 0 : Date.parse(detail.finishedAt),
  };
}

/** เหมือน `fromDuel` แต่มาจากตาราง `MultiplayerMatch` — `roomKind` เป็น `multiplayer` เสมอ */
function fromMultiplayer(detail: MultiplayerMatchDetail): MatchResult {
  return {
    matchId: detail.multiplayerMatchId,
    matchKind: 'multiplayer',
    roomKind: 'multiplayer',
    cubeType: detail.cubeType,
    scramble: detail.scramble,
    ratingApplied: detail.ratingApplied,
    results: detail.players.map((player) => ({
      userId: player.userId,
      username: player.username,
      solveTimeMs: toMs(player.solveTime),
      moveCount: player.moveCount,
      rankNo: player.rankNo,
      eloBefore: player.eloBefore,
      eloAfter: player.eloAfter,
      eloChange: player.eloChange,
    })),
    finishedAtTs: detail.finishedAt === null ? 0 : Date.parse(detail.finishedAt),
  };
}
