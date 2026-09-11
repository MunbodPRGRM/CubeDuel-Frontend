import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/auth/useAuth';
import type { CubeMoveEvent } from '@/cube';
import { NOT_CONNECTED_MESSAGE } from '@/lib/errors';
import { SocketAckError, emitAck, socketErrorMessage } from './socket-client';
import { useSocket } from './useSocket';
import type { AckError, MatchResult, RoomSnapshot, SolveSolvedResult } from './types';

/**
 * ฝั่ง client ของ **ลำดับการแข่ง** (`room:start` + `solve:*` + `match:finished`)
 *
 * ต่อยอดจาก `useRoom` ที่ดูแลตัวห้อง — ตัวนี้ดูแลเฉพาะรอบการแข่ง
 *
 * หลักการเดียวกับ ADR-036 ข้อ 4: **ยึด `room:state` เป็นความจริง** จึงไม่ต้องฟัง
 * `match:loading` / `match:countdown` / `match:inspection_started` / `match:started` /
 * `match:final_countdown` เลย เพราะทุกอย่างที่ event พวกนั้นบอกอยู่ใน snapshot ครบแล้ว
 * (`state` · `scramble` · `phaseEndsAtTs` · `serverStartTs` · `progress`)
 *
 * event เดียวที่ต้องฟังจริงคือ **`match:finished`** เพราะ `MatchResult` (Elo ที่เปลี่ยน
 * กับ `matchId`) ไม่ได้อยู่ใน snapshot และไม่มีทางอื่นให้ขอย้อนหลัง
 */

export interface UseMatchResult {
  /** ผลของรอบล่าสุด — `null` จนกว่าจะจบรอบ (ล้างทิ้งเมื่อเริ่มรอบใหม่) */
  result: MatchResult | null;
  busy: boolean;
  actionError: string | null;
  /**
   * move ที่เราหมุนกับที่ server รับไว้ **ไม่ตรงกันแล้ว** — กู้เองไม่ได้ (ดู ADR-037 ข้อ 5)
   * ต้องบอกผู้เล่นตรง ๆ ว่ารอบนี้จะยืนยันผลไม่ได้ ให้ยอมแพ้แล้วเริ่มรอบใหม่
   */
  desynced: boolean;
  /** `true` เมื่อ desync เกิดจากการรีเฟรชหน้ากลางรอบ — ข้อความที่ควรบอกต่างกัน */
  reloadedMidSolve: boolean;
  /** `room:start` — เฉพาะหัวห้อง (ทั้งรอบแรกและ "เล่นอีกครั้ง") */
  start: () => Promise<void>;
  /** `solve:surrender` — ยอมแพ้ = DNF */
  surrender: () => Promise<void>;
  /**
   * `solve:dev_finish` — ปุ่ม "เสร็จทันที" สำหรับทดสอบ (ADR-060) · server ปฏิเสธถ้าไม่ได้เปิดสวิตช์
   * ภาพคิวบ์ครบสีตามมาเองจาก `PlayerCubePanel` เมื่อ snapshot บอกว่าเรา `solved`
   */
  devFinish: () => Promise<void>;
  /** คิวบ์ของเราใส่ scramble เสร็จแล้ว → `solve:ready` (ยิงได้ครั้งเดียวต่อรอบ) */
  reportCubeReady: () => void;
  /** ผู้เล่นหมุนหนึ่งท่า → `solve:move` (fire-and-forget) */
  sendMove: (event: CubeMoveEvent) => void;
  /** คิวบ์ของเราครบทุกหน้าแล้ว → `solve:solved` ให้ server replay ตรวจแล้วตัดสิน */
  reportSolved: (moveCount: number) => void;
}

/** state ที่ผู้เล่นหมุนคิวบ์ได้จริง (นอกเหนือจากนี้ server ปฏิเสธทุกท่า) */
function isSolvingState(state: RoomSnapshot['state']): boolean {
  return state === 'SOLVING' || state === 'FINAL_COUNTDOWN';
}

export function useMatch(snapshot: RoomSnapshot | null): UseMatchResult {
  const { user } = useAuth();
  const { socket } = useSocket();
  const myUserId = user?.userId ?? null;

  const [result, setResult] = useState<MatchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [desynced, setDesynced] = useState(false);

  // callback ทุกตัวถูกส่งเข้า `CubeCanvas` ซึ่งเก็บไว้ใน ref — ต้อง**นิ่ง**ตลอดอายุหน้า
  // ไม่งั้นจะต้องสร้าง view 3D ใหม่ทุกครั้งที่ snapshot ขยับ จึงอ่านของล่าสุดผ่าน ref แทน dep
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const socketRef = useRef(socket);
  socketRef.current = socket;
  const myUserIdRef = useRef(myUserId);
  myUserIdRef.current = myUserId;

  /** ยิง `solve:ready` / `solve:solved` ของรอบนี้ไปแล้วหรือยัง — ล้างตอนเข้ารอบใหม่ */
  const readySentRef = useRef(false);
  const solvedSentRef = useRef(false);
  /** `seq` สูงสุดที่เราส่งไปในรอบนี้ — ใช้เทียบว่า server นับ move ของเราล้ำหน้าเราไปหรือยัง */
  const sentSeqRef = useRef(0);
  const [reloadedMidSolve, setReloadedMidSolve] = useState(false);

  /** ที่นั่งของเราในรอบนี้ — ผู้ชมได้ `null` และส่ง `solve:*` ไม่ได้ */
  const myProgress = useCallback(() => {
    const snap = snapshotRef.current;
    const id = myUserIdRef.current;
    if (!snap || id === null) return null;
    return snap.progress.find((entry) => entry.userId === id) ?? null;
  }, []);

  // ---------------------------------------------------------------- รอบใหม่

  // `LOADING` คือจุดเริ่มของทุกรอบเสมอ (ทั้งรอบแรกและ "เล่นอีกครั้ง" — ADR-035 ข้อ 3)
  // dep เป็นค่า state ตรง ๆ จึงทำงานครั้งเดียวต่อรอบ ไม่ใช่ทุก snapshot ที่มาระหว่าง LOADING
  const state = snapshot?.state;
  useEffect(() => {
    if (state !== 'LOADING') return;
    readySentRef.current = false;
    solvedSentRef.current = false;
    sentSeqRef.current = 0;
    setResult(null);
    setDesynced(false);
    setReloadedMidSolve(false);
    setActionError(null);
  }, [state]);

  /**
   * **รีเฟรชหน้ากลางรอบ** (หรือ HMR ตอน dev) — คิวบ์ถูกสร้างใหม่จาก scramble ล้วน
   * บัญชี move ของเราหายไปหมด แต่ของ server ยังอยู่ครบ `seq` จึงเหลื่อมกันตั้งแต่ท่าถัดไป
   *
   * รู้ได้ทันทีโดยไม่ต้องรอให้ move ถูกปฏิเสธ: server นับ move ของเราได้ **มากกว่า**
   * จำนวนที่เราส่งไปไม่ได้เด็ดขาด ถ้าเจอแปลว่าเราคือฝ่ายที่ลืมของเก่าไป
   *
   * กู้คืนไม่ได้เพราะ move stream ของรอบนี้ไม่ได้ถูกเก็บไว้ที่ไหนนอกจากในหน้าเว็บที่เพิ่งหายไป
   * (เน็ตหลุดเฉย ๆ ไม่เข้าเคสนี้ — หน้าไม่ถูก unmount คิวบ์จึงยังจำ move เดิมได้ · ADR-036 ข้อ 5)
   */
  const myServerMoveCount = myProgress()?.moveCount ?? 0;
  useEffect(() => {
    if (!isSolvingState(snapshotRef.current?.state ?? 'WAITING')) return;
    if (myServerMoveCount <= sentSeqRef.current) return;
    setDesynced(true);
    setReloadedMidSolve(true);
  }, [state, myServerMoveCount]);

  // ---------------------------------------------------------------- ฟัง event

  useEffect(() => {
    if (!socket) return;

    const onFinished = (payload: MatchResult) => setResult(payload);

    /**
     * error ที่ไม่ได้ผูกกับ ack — ตัวที่มาถึงที่นี่ได้จริงคือของ `solve:move`
     *
     * ทุกโค้ดในกลุ่มนี้แปลว่า server **ไม่ได้รับ move ที่เราหมุนไป** ตัวนับ `seq` ของสองฝั่ง
     * จึงเหลื่อมกันถาวร (server ไม่ยอมรับ seq ที่ข้าม) รอบนี้จบด้วยการยืนยันผลไม่ได้แน่ ๆ
     */
    const onError = (payload: AckError) => {
      if (
        payload.code === 'E_SEQ_MISMATCH' ||
        payload.code === 'E_INVALID_MOVE' ||
        payload.code === 'E_RATE_LIMITED' ||
        payload.code === 'E_MOVE_DURING_INSPECTION'
      ) {
        if (isSolvingState(snapshotRef.current?.state ?? 'WAITING')) setDesynced(true);
      }
    };

    socket.on('match:finished', onFinished);
    socket.on('error', onError);
    return () => {
      socket.off('match:finished', onFinished);
      socket.off('error', onError);
    };
  }, [socket]);

  // ---------------------------------------------------------------- คำสั่งที่รอ ack

  const run = useCallback(
    async (event: 'room:start' | 'solve:surrender' | 'solve:dev_finish'): Promise<void> => {
      const s = socketRef.current;
      if (!s) {
        setActionError(NOT_CONNECTED_MESSAGE);
        return;
      }
      setBusy(true);
      setActionError(null);
      try {
        // ผลของ ack ไม่ได้ใช้ — ความจริงมาจาก `room:state` ที่ตามมาเสมอ (ADR-036 ข้อ 4)
        await emitAck<unknown>(s, event, {});
      } catch (err: unknown) {
        setActionError(socketErrorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const start = useCallback(() => run('room:start'), [run]);
  const surrender = useCallback(() => run('solve:surrender'), [run]);
  const devFinish = useCallback(() => run('solve:dev_finish'), [run]);

  // ---------------------------------------------------------------- คำสั่งระหว่างแก้

  const reportCubeReady = useCallback(() => {
    const s = socketRef.current;
    const snap = snapshotRef.current;
    if (!s || snap?.state !== 'LOADING' || readySentRef.current || !myProgress()) return;
    readySentRef.current = true;

    // ไม่ครบทุกคนใน 15 วินาที server ก็ไปต่อเอง — มาช้าแล้วเจอ `E_INVALID_STATE`
    // ถือเป็นเรื่องปกติ ไม่ต้องขึ้นให้ผู้ใช้เห็น
    void emitAck<null>(s, 'solve:ready', {}).catch(() => undefined);
  }, [myProgress]);

  const sendMove = useCallback(
    (event: CubeMoveEvent) => {
      // ท่าที่โปรแกรมสั่ง (เช่นตอนสะท้อนคิวบ์คู่แข่ง) ไม่ใช่ move ของผู้เล่น ห้ามส่ง
      if (event.source !== 'player') return;
      const s = socketRef.current;
      const snap = snapshotRef.current;
      if (!s || !snap || !isSolvingState(snap.state)) return;
      if (myProgress()?.status !== 'solving') return;

      sentSeqRef.current = event.seq;
      // ไม่มี ack เพื่อความลื่น — ผิดเมื่อไรได้ event `error` กลับมา (socket-events.md ข้อ 7)
      s.emit('solve:move', { seq: event.seq, move: event.move, clientTs: event.at });
    },
    [myProgress],
  );

  const reportSolved = useCallback(
    (moveCount: number) => {
      const s = socketRef.current;
      const snap = snapshotRef.current;
      if (!s || !snap || !isSolvingState(snap.state)) return;
      if (myProgress()?.status !== 'solving' || solvedSentRef.current) return;
      solvedSentRef.current = true;

      void emitAck<SolveSolvedResult>(s, 'solve:solved', {
        seq: moveCount,
        moveCount,
        // เวลาที่ตัดสินจริงเป็นของ server เสมอ ตัวนี้ส่งไปเพื่อ anti-cheat เท่านั้น
        clientTs: Date.now(),
      }).catch((err: unknown) => {
        // นาฬิกาเดินต่อและผู้เล่นแก้ต่อได้ → เปิดให้ยิงใหม่ได้เมื่อคิวบ์ครบอีกครั้ง
        solvedSentRef.current = false;
        if (!(err instanceof SocketAckError)) {
          setActionError(socketErrorMessage(err));
          return;
        }
        // server ตรวจแล้วยังไม่ครบ = ภาพกับตรรกะสองฝั่งไม่ตรงกัน ต้องเห็น ไม่ใช่กลืนเงียบ
        if (err.code === 'E_NOT_SOLVED') {
          setDesynced(true);
          return;
        }
        if (err.code === 'E_SEQ_MISMATCH') {
          setDesynced(true);
          return;
        }
        // จบไปแล้ว / ยอมแพ้ไปแล้ว — ไม่ใช่เรื่องที่ผู้ใช้ต้องรู้
        if (err.code !== 'E_INVALID_STATE') setActionError(err.message);
      });
    },
    [myProgress],
  );

  return {
    result,
    busy,
    actionError,
    desynced,
    reloadedMidSolve,
    start,
    surrender,
    devFinish,
    reportCubeReady,
    sendMove,
    reportSolved,
  };
}
