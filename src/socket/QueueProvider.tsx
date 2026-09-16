import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { NOT_CONNECTED_MESSAGE } from '@/lib/errors';
import { emitAck, socketErrorMessage } from './socket-client';
import { QueueContext, type QueueContextValue, type QueueState } from './queue-context';
import { useSocket } from './useSocket';
import type {
  CubeType,
  QueueAcceptResult,
  QueueJoinResult,
  QueueKind,
  QueueMatchFoundPayload,
  QueueStatusPayload,
  QueueTimeoutPayload,
} from './types';

/**
 * ตัวเดียวของทั้งแอปที่ฟัง `queue:*` — ต้องอยู่ใต้ `<SocketProvider>` และใน Router
 * (ต้องใช้ `useNavigate` ตอนจับคู่ได้)
 *
 * หน้าที่มีสี่อย่าง:
 *   1. เก็บสถานะคิวไว้ที่เดียว ทุกหน้าอ่านได้ผ่าน `useQueue()`
 *   2. เจอกลุ่มแล้ว → phase `ready_check` ให้ `ReadyCheckModal` เด้งทับทุกหน้า (ADR-077)
 *   3. ยืนยันครบทุกคน → พาไปหน้าห้องให้เอง ไม่ว่าตอนนั้นผู้ใช้จะอยู่หน้าไหน (ADR-040 ข้อ 2)
 *   4. socket หลุด = ออกจากคิวทันทีตามกติกา (`game-rules.md` ข้อ 6) — จอต้องสะท้อนตามนั้น
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
  timedOutReason: null,
  readyCheck: null,
  notice: null,
};

/** ข้อความตอนกลุ่มถูกยกเลิกเพราะอีกฝ่ายไม่กด — server พากลับเข้าคิวให้แล้วโดยไม่ต้องกดอะไร */
const CANCELLED_NOTICE =
  'อีกฝ่ายไม่ได้กดยืนยัน จึงยกเลิกการจับคู่รอบนี้ — พากลับเข้าคิวให้แล้ว กำลังหาคู่ใหม่อยู่';

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
      setState((prev) => ({
        phase: 'queued',
        kind,
        cubeType,
        // ยึดเวลาของ server เสมอ ด้วยเหตุผลเดียวกัน
        queuedAtTs: clock.now() - waitedMs,
        eloWindow,
        playersInQueue,
        timedOutAfterMs: null,
        timedOutReason: null,
        readyCheck: null,
        // ได้ `queue:status` ทั้งที่กำลังรอยืนยันอยู่ = กลุ่มถูกยกเลิกและ server พากลับเข้าคิว
        // ให้แล้ว — ไม่มี event "ยกเลิก" แยกต่างหาก ตัวนี้คือสัญญาณเดียวที่มี (ADR-077 ข้อ 6)
        notice: prev.phase === 'ready_check' ? CANCELLED_NOTICE : null,
      }));
      setError(null);
    };

    /** เจอกลุ่มแล้วแต่ **ยังไม่มีห้อง** — payload เป็นสถานะทั้งใบ ทับของเดิมได้เลย */
    const onMatchFound = ({
      kind,
      cubeType,
      rivals,
      groupSize,
      acceptedCount,
      youAccepted,
      expiresAtTs,
    }: QueueMatchFoundPayload) => {
      setState((prev) => ({
        ...prev,
        phase: 'ready_check',
        kind,
        cubeType,
        timedOutAfterMs: null,
        timedOutReason: null,
        readyCheck: { rivals, groupSize, acceptedCount, youAccepted, expiresAtTs },
        notice: null,
      }));
      setError(null);
    };

    const onMatched = ({ roomId }: { roomId: number }) => {
      // ยืนยันครบทุกคนแล้ว ห้องเป็นความจริงต่อจากนี้ — เข้า LOADING ทันที (ADR-077 ข้อ 7)
      setState(IDLE);
      setError(null);
      navigate(`/room/${roomId}`);
    };

    /**
     * ออกจากคิวเพราะหมดเวลา — **ปิดหน้ายืนยันด้วย** เพราะ `reason: 'ready_check'` คือทางออก
     * เดียวของ phase `ready_check` ที่ไม่มี ack มาปิดให้ (ADR-077 ข้อ 6)
     */
    const onTimeout = ({ waitedMs, reason }: QueueTimeoutPayload) => {
      setState((prev) => ({
        ...IDLE,
        phase: 'timeout',
        kind: prev.kind,
        cubeType: prev.cubeType,
        timedOutAfterMs: waitedMs,
        timedOutReason: reason,
      }));
    };

    socket.on('queue:status', onStatus);
    socket.on('queue:match_found', onMatchFound);
    socket.on('queue:matched', onMatched);
    socket.on('queue:timeout', onTimeout);

    return () => {
      socket.off('queue:status', onStatus);
      socket.off('queue:match_found', onMatchFound);
      socket.off('queue:matched', onMatched);
      socket.off('queue:timeout', onTimeout);
    };
  }, [socket, clock, navigate]);

  /**
   * socket หลุด = server เอาเราออกจากคิวไปแล้ว (ADR-039 ข้อ 1) จอต้องไม่หลอกว่ายังรออยู่
   * รวมถึงตอนค้างอยู่หน้ายืนยัน — สายขาดแล้ว server ถือว่าเราปฏิเสธ (ADR-077 ข้อ 5)
   */
  useEffect(() => {
    if (socketStatus === 'connected') return;
    if (state.phase !== 'queued' && state.phase !== 'ready_check') return;
    setState(IDLE);
    setError('การเชื่อมต่อหลุด จึงออกจากคิวให้อัตโนมัติ — กดจับคู่อีกครั้งเพื่อรอต่อ');
  }, [socketStatus, state.phase]);

  // ---------------------------------------------------------------- คำสั่ง

  const join = useCallback(
    async (cubeType: CubeType, kind: QueueKind): Promise<boolean> => {
      if (!socket || socketStatus !== 'connected') {
        setError(NOT_CONNECTED_MESSAGE);
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
          timedOutReason: null,
          readyCheck: null,
          notice: null,
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

  /**
   * "เล่นเลย" — ล็อกปุ่มด้วย `busy` กันกดซ้ำ แล้วรอ server เป็นคนบอกว่าเกิดอะไรต่อ
   * (ครบทุกคน → `queue:matched` · ไม่ครบ → `queue:match_found` ใบใหม่ หรือ `queue:status`)
   * **ไม่เดาสถานะเอง** — `youAccepted` มาจาก server เท่านั้น
   */
  const accept = useCallback(async (): Promise<void> => {
    if (!socket || socketStatus !== 'connected') {
      setError(NOT_CONNECTED_MESSAGE);
      return;
    }
    setBusy(true);
    try {
      await emitAck<QueueAcceptResult>(socket, 'queue:accept', {});
      setError(null);
    } catch (err: unknown) {
      // หมดเวลาไปก่อนพอดี server ตอบ E_INVALID_STATE — ปิดหน้ายืนยันทิ้งแล้วบอกไปตรง ๆ
      setState((prev) => (prev.phase === 'ready_check' ? IDLE : prev));
      setError(socketErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [socket, socketStatus]);

  /** "ยกเลิก" ในหน้ายืนยัน — ออกจากคิวไปเลย (ADR-077 ข้อ 5) ไม่มีคูลดาวน์ กดจับคู่ใหม่ได้ทันที */
  const decline = useCallback(async (): Promise<void> => {
    if (!socket || socketStatus !== 'connected') {
      setState(IDLE);
      return;
    }
    setBusy(true);
    try {
      await emitAck<{ left: boolean }>(socket, 'queue:decline', {});
      setError(null);
    } catch {
      // หมดเวลาไปก่อนก็ได้ผลเดียวกันคือออกจากคิว — ไม่ต้องทำให้ผู้ใช้ตกใจด้วยข้อความ error
      setError(null);
    } finally {
      setState(IDLE);
      setBusy(false);
    }
  }, [socket, socketStatus]);

  const dismiss = useCallback(() => {
    setError(null);
    setState((prev) =>
      prev.phase === 'timeout' ? IDLE : prev.notice === null ? prev : { ...prev, notice: null },
    );
  }, []);

  const value = useMemo<QueueContextValue>(
    () => ({ ...state, busy, error, join, leave, accept, decline, dismiss }),
    [state, busy, error, join, leave, accept, decline, dismiss],
  );

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}
