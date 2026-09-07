import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/auth/useAuth';
import { emitAck, socketErrorMessage, type TypedClientSocket } from './socket-client';
import { useSocket } from './useSocket';
import type { PlayerPublic, RoomSnapshot, RoomSnapshotResult } from './types';

/**
 * ผูกหน้าจอหนึ่งหน้าเข้ากับห้องหนึ่งห้อง
 *
 * หลักการ (ADR-036): **ยึด `room:state` เป็นความจริงเสมอ** event ย่อยอย่าง
 * `room:player_joined` / `room:ready_changed` ไม่ต้องเอามาปะ snapshot เอง เพราะ server
 * ส่ง snapshot ตามมาทุกครั้งอยู่แล้ว — ปะเองเมื่อไหร่คือเปิดช่องให้จอสองฝั่งไม่ตรงกัน
 *
 * **ข้อยกเว้นมีสองตัว** คือ event ที่ server ตั้งใจส่งเดี่ยว ๆ ไม่มี snapshot ตามมา:
 *   - `room:spectator_count` ตอนผู้ชมออกจากห้อง
 *   - `opponent:progress` ระหว่างแข่ง (throttle 500 ms — ถ้าส่ง snapshot ตามทุกครั้ง
 *     จะกลายเป็นการ broadcast ห้องทั้งก้อนวินาทีละสองรอบ)
 * ทั้งคู่ปะ**เฉพาะฟิลด์ที่ event นั้นบอก** ไม่แตะอย่างอื่นใน snapshot
 */

export type RoomStatus = 'loading' | 'ready' | 'gone';

export interface UseRoomResult {
  snapshot: RoomSnapshot | null;
  status: RoomStatus;
  /** เหตุผลที่ไม่ได้อยู่ในห้องนี้แล้ว (ห้องยุบ / ถูกพาออก / เข้าไม่ได้) */
  goneMessage: string | null;
  /** ที่นั่งของเราในห้อง — `null` เมื่อเข้ามาในฐานะผู้ชม */
  me: PlayerPublic | null;
  isSpectator: boolean;
  isHost: boolean;
  /** ผู้เล่นคนอื่นในห้อง (ห้อง 1v1 มีได้ตัวเดียว) */
  others: PlayerPublic[];
  busy: boolean;
  actionError: string | null;
  setReady: (ready: boolean) => Promise<void>;
  leave: () => Promise<boolean>;
}

export function useRoom(roomId: number): UseRoomResult {
  const { user } = useAuth();
  const { socket, status: socketStatus } = useSocket();
  const myUserId = user?.userId ?? null;

  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [goneMessage, setGoneMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  /** กันไม่ให้ callback ของ event ที่มาช้าไปเขียนทับสถานะ "ออกจากห้องแล้ว" */
  const goneRef = useRef(false);

  useEffect(() => {
    goneRef.current = false;
    setSnapshot(null);
    setGoneMessage(null);
  }, [roomId]);

  const markGone = useCallback((message: string) => {
    goneRef.current = true;
    setGoneMessage(message);
    setSnapshot(null);
  }, []);

  // ---------------------------------------------------------------- เข้าห้อง + ฟัง event

  useEffect(() => {
    if (!socket || socketStatus !== 'connected' || myUserId === null) return;

    let cancelled = false;

    // ต่อใหม่ทุกครั้ง (รวมตอนเน็ตหลุดแล้วกลับมา) ต้องขอ snapshot ล่าสุดก่อนเสมอ —
    // ที่นั่งยังอยู่เพราะผูกกับ userId ไม่ใช่ socket (ADR-034 ข้อ 3)
    emitAck<RoomSnapshotResult>(socket, 'room:rejoin', { roomId })
      .then((result) => {
        if (!cancelled) setSnapshot(result.snapshot);
      })
      .catch((err: unknown) => {
        if (!cancelled) markGone(socketErrorMessage(err));
      });

    const onState = (next: RoomSnapshot) => {
      if (next.roomId !== roomId || goneRef.current) return;
      setSnapshot(next);
    };

    const onSpectatorCount = ({ count }: { count: number }) => {
      // ผู้ชมออกจากห้อง — server ไม่ได้ส่ง snapshot ตามมา
      setSnapshot((prev) => (prev ? { ...prev, spectatorCount: count } : prev));
    };

    // ตัวนับ move ของผู้เล่นคนอื่นระหว่างแข่ง — มาทาง event นี้ทางเดียว
    const onProgress = ({ userId, moveCount }: { userId: number; moveCount: number }) => {
      setSnapshot((prev) => {
        if (!prev) return prev;
        const current = prev.progress.find((entry) => entry.userId === userId);
        if (!current || current.moveCount === moveCount) return prev;
        return {
          ...prev,
          progress: prev.progress.map((entry) =>
            entry.userId === userId ? { ...entry, moveCount } : entry,
          ),
        };
      });
    };

    const onPlayerLeft = ({ userId, reason }: { userId: number; reason: string }) => {
      if (userId !== myUserId) return;
      markGone(
        reason === 'kicked'
          ? 'คุณถูกนำออกจากห้องนี้'
          : 'คุณออกจากห้องนี้แล้ว (จากอีกหน้าต่างหนึ่ง)',
      );
    };

    const onAborted = ({ message }: { message: string }) => markGone(message);

    socket.on('room:state', onState);
    socket.on('room:spectator_count', onSpectatorCount);
    socket.on('opponent:progress', onProgress);
    socket.on('room:player_left', onPlayerLeft);
    socket.on('room:aborted', onAborted);

    return () => {
      cancelled = true;
      socket.off('room:state', onState);
      socket.off('room:spectator_count', onSpectatorCount);
      socket.off('opponent:progress', onProgress);
      socket.off('room:player_left', onPlayerLeft);
      socket.off('room:aborted', onAborted);
    };
  }, [socket, socketStatus, roomId, myUserId, markGone]);

  // ---------------------------------------------------------------- คำสั่ง

  /** ยิง event ที่ต้องรอ ack แล้วเก็บ error ไว้โชว์ — คืน `true` เมื่อสำเร็จ */
  const run = useCallback(
    async (action: (socket: TypedClientSocket) => Promise<unknown>): Promise<boolean> => {
      if (!socket) {
        setActionError('ยังไม่ได้เชื่อมต่อเซิร์ฟเวอร์ กรุณารอสักครู่แล้วลองใหม่');
        return false;
      }
      setBusy(true);
      setActionError(null);
      try {
        await action(socket);
        return true;
      } catch (err: unknown) {
        setActionError(socketErrorMessage(err));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [socket],
  );

  const setReady = useCallback(
    async (ready: boolean) => {
      await run((s) => emitAck<null>(s, 'room:ready', { ready }));
    },
    [run],
  );

  const leave = useCallback(async () => {
    const ok = await run((s) => emitAck<null>(s, 'room:leave', {}));
    if (ok) markGone('ออกจากห้องแล้ว');
    return ok;
  }, [run, markGone]);

  // ---------------------------------------------------------------- ค่าที่คำนวณจาก snapshot

  const me = useMemo(
    () => snapshot?.players.find((p) => p.userId === myUserId) ?? null,
    [snapshot, myUserId],
  );
  const others = useMemo(
    () => snapshot?.players.filter((p) => p.userId !== myUserId) ?? [],
    [snapshot, myUserId],
  );

  const status: RoomStatus = goneMessage !== null ? 'gone' : snapshot ? 'ready' : 'loading';

  return {
    snapshot,
    status,
    goneMessage,
    me,
    // อยู่ในห้องแล้วแต่ไม่มีที่นั่งผู้เล่น = เข้ามาในฐานะผู้ชม
    isSpectator: snapshot !== null && me === null,
    isHost: me?.isHost ?? false,
    others,
    busy,
    actionError,
    setReady,
    leave,
  };
}
