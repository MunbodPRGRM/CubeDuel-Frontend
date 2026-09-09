import { useMemo } from 'react';
import { useApiData } from '@/hooks/useApiData';
import type { MatchResult, RoomSnapshot } from '@/socket/types';
import type { MatchDetail } from '@/types/match';

/**
 * ผลรอบล่าสุดของห้อง — เอาจาก `match:finished` ก่อน ไม่มีค่อยขอย้อนหลังทาง REST
 *
 * `match:finished` ส่งครั้งเดียวและขอซ้ำไม่ได้ (ADR-037 ข้อ 2) คนที่ **กด F5 หลังรอบจบ**
 * หรือ **ผู้ชมที่เพิ่งเข้าห้องที่จบไปแล้ว** จึงไม่มีตัวเลข Elo ให้ดูเลย — ซึ่งรับไม่ได้แล้ว
 * ในเฟส 5 ที่ห้องแข่งขันปรับคะแนนจริง จึงดึงจาก `GET /matches/:matchId` แทน โดยใช้
 * `snapshot.matchId` ที่ server แนบมาให้ (ADR-040 ข้อ 5)
 */
export function useMatchResult(
  snapshot: RoomSnapshot | null,
  live: MatchResult | null,
): MatchResult | null {
  // ขอเฉพาะตอนที่จำเป็นจริง ๆ — ยังอยู่ในห้องเดิมและไม่มีผลสด ๆ อยู่ในมือ
  const path =
    live === null && snapshot?.state === 'FINISHED' && snapshot.matchId !== null
      ? `/matches/${snapshot.matchId}`
      : null;

  const { data } = useApiData<MatchDetail>(path);

  return useMemo(() => {
    if (live) return live;
    if (!data) return null;
    return toMatchResult(data);
  }, [live, data]);
}

/** แปลงรูปของ REST ให้เป็นรูปเดียวกับ `match:finished` เพื่อให้หน้าจอมีทางเดินเดียว */
function toMatchResult(detail: MatchDetail): MatchResult {
  return {
    matchId: detail.matchId,
    roomKind: detail.roomType,
    cubeType: detail.cubeType,
    scramble: detail.scramble,
    ratingApplied: detail.ratingApplied,
    results: detail.players.map((player) => ({
      userId: player.userId,
      username: player.username,
      // DB เก็บเป็นวินาทีทศนิยม 2 ตำแหน่ง ส่วนหน้าจอคิดเป็นมิลลิวินาที
      solveTimeMs: player.solveTime === null ? null : Math.round(player.solveTime * 1000),
      moveCount: player.moveCount,
      rankNo: player.rankNo,
      eloBefore: player.eloBefore,
      eloAfter: player.eloAfter,
      eloChange: player.eloChange,
    })),
    finishedAtTs: detail.finishedAt === null ? 0 : Date.parse(detail.finishedAt),
  };
}
