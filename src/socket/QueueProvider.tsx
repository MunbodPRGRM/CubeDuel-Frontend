import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { emitAck, socketErrorMessage } from './socket-client';
import { QueueContext, type QueueContextValue, type QueueState } from './queue-context';
import { useSocket } from './useSocket';
import type { CubeType, QueueJoinResult, QueueKind, QueueStatusPayload } from './types';

/**
 * ตัวเดียวของทั้งแอปที่ฟัง `queue:*` — ต้องอยู่ใต้ `<SocketProvider>` และใน Router
 * (ต้องใช้ `useNavigate` ตอนจับคู่ได้)
 *
 * หน้าที่มีสามอย่าง:
 *   1. เก็บสถานะคิวไว้ที่เดียว ทุกหน้าอ่านได้ผ่าน `useQueue()`
 *   2. จับคู่ได้ → พาไปหน้าห้องให้เอง ไม่ว่าตอนนั้นผู้ใช้จะอยู่หน้าไหน (ADR-040 ข้อ 2)
 *   3. socket หลุด = ออกจากคิวทันทีตามกติกา (`game-rules.md` ข้อ 6) — จอต้องสะท้อนตามนั้น
 */

/**
 * ช่วง Elo แถวแรกของตารางใน `game-rules.md` ข้อ 8 (0–10 วิ = ±100)
 *
 * ใช้เป็นค่าตั้งต้นระหว่างรอ `queue:status` ตัวแรกซึ่งมาที่วินาทีที่ 5 เท่านั้น —
 * **ไม่ได้ลอกตารางทั้งใบมาไว้ฝั่ง client** ค่าที่แสดงหลังจากนี้มาจาก server ล้วน ๆ
 */
const INITIAL_ELO_WINDOW = 100;

const IDLE: QueueState = {
  phase: 'idle',
  kind: null,
  cubeType: null,
  queuedAtTs: null,
  eloWindow: null,
  playersInQueue: 0,
  timedOutAfterMs: null,
};

export function QueueProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { socket, status: socketStatus, clock } = useSocket();

  const [state, setState] = useState<QueueState>(IDLE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------- ฟัง event

  useEffect(() => {
    if (!socket) return;

    const onStatus = ({
      kind,
      cubeType,
      waitedMs,
      eloWindow,
      playersInQueue,
    }: QueueStatusPayload) => {
      // ห้องที่ยุบก่อนเริ่ม → server ใส่เรากลับเข้าคิวเองแล้วส่งสถานะมาเลย (ADR-039 ข้อ 6)
      // เคสนั้น `prev.phase` ยังเป็น idle อยู่ — ต้องรับเข้ามาเหมือนกัน และ **ยึด `kind`
      // กับ `cubeType` ของ server** เพราะเราไม่ได้เป็นคนกดเข้าคิวรอบนี้ (ADR-044 ข้อ 2)
      setState({
        phase: 'queued',
        kind,
        cubeType,
        // ยึดเวลาของ server เสมอ ด้วยเหตุผลเดียวกัน
        queuedAtTs: clock.now() - waitedMs,
        eloWindow,
        playersInQueue,
        timedOutAfterMs: null,
      });
      setError(null);
    };

    const onMatched = ({ roomId }: { roomId: number }) => {
      // ห้องเป็นความจริงต่อจากนี้ — หน้าห้องจะโชว์ "จับคู่ได้แล้ว" ให้เอง 2 วินาทีก่อนเริ่ม
      setState(IDLE);
      setError(null);
      navigate(`/room/${roomId}`);
    };

    const onTimeout = ({ waitedMs }: { waitedMs: number }) => {
      setState((prev) => ({
        ...IDLE,
        phase: 'timeout',
        kind: prev.kind,
        cubeType: prev.cubeType,
        timedOutAfterMs: waitedMs,
      }));
    };

    socket.on('queue:status', onStatus);
    socket.on('queue:matched', onMatched);
    socket.on('queue:timeout', onTimeout);

    return () => {
      socket.off('queue:status', onStatus);
      socket.off('queue:matched', onMatched);
      socket.off('queue:timeout', onTimeout);
    };
  }, [socket, clock, navigate]);

  /** socket หลุด = server เอาเราออกจากคิวไปแล้ว (ADR-039 ข้อ 1) จอต้องไม่หลอกว่ายังรออยู่ */
  useEffect(() => {
    if (socketStatus === 'connected' || state.phase !== 'queued') return;
    setState(IDLE);
    setError('การเชื่อมต่อหลุด จึงออกจากคิวให้อัตโนมัติ — กดจับคู่อีกครั้งเพื่อรอต่อ');
  }, [socketStatus, state.phase]);

  // ---------------------------------------------------------------- คำสั่ง

  const join = useCallback(
    async (cubeType: CubeType, kind: QueueKind): Promise<boolean> => {
      if (!socket || socketStatus !== 'connected') {
        setError('ยังไม่ได้เชื่อมต่อเซิร์ฟเวอร์ กรุณารอสักครู่แล้วลองใหม่');
        return false;
      }
      setBusy(true);
      setError(null);
      try {
        const result = await emitAck<QueueJoinResult>(socket, 'queue:join', { cubeType, kind });
        setState({
          phase: 'queued',
          kind,
          cubeType,
          queuedAtTs: result.queuedAtTs,
          // คิวหลายคนไม่ใช้ช่วง Elo เลย (game-rules.md ข้อ 8) — `null` = ไม่จำกัด
          eloWindow: kind === 'multiplayer' ? null : INITIAL_ELO_WINDOW,
          playersInQueue: result.playersInQueue,
          timedOutAfterMs: null,
        });
        return true;
      } catch (err: unknown) {
        setError(socketErrorMessage(err));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [socket, socketStatus],
  );

  /** ออกจากคิว — จบที่ `idle` เสมอ เพราะ server ถือว่า "ไม่ได้อยู่ในคิว" ไม่ใช่ข้อผิดพลาด */
  const leave = useCallback(async (): Promise<void> => {
    if (!socket || socketStatus !== 'connected') {
      setState(IDLE);
      return;
    }
    setBusy(true);
    try {
      await emitAck<{ left: boolean }>(socket, 'queue:leave', {});
      setError(null);
    } catch (err: unknown) {
      setError(socketErrorMessage(err));
    } finally {
      setState(IDLE);
      setBusy(false);
    }
  }, [socket, socketStatus]);

  const dismiss = useCallback(() => {
    setError(null);
    setState((prev) => (prev.phase === 'timeout' ? IDLE : prev));
  }, []);

  const value = useMemo<QueueContextValue>(
    () => ({ ...state, busy, error, join, leave, dismiss }),
    [state, busy, error, join, leave, dismiss],
  );

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}
