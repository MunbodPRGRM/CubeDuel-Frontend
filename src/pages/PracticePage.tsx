import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { CubeCanvas, type CubeCanvasHandle } from '@/components/CubeCanvas';
import { CubeTypeSelect } from '@/components/CubeTypeSelect';
import type { CubeMoveEvent, CubeState } from '@/cube';
import { apiFetch } from '@/lib/api';
import { averageOfN, bestTime, meanTime } from '@/lib/averages';
import { errorMessage } from '@/lib/errors';
import { formatSolveTime } from '@/lib/format';
import {
  appendSolve,
  clearSolves,
  loadSolves,
  type PracticeSolve,
} from '@/practice/practice-storage';
import { TimerDisplay } from '@/practice/TimerDisplay';
import { INSPECTION_SECONDS, useSolveTimer } from '@/practice/useSolveTimer';
import type { CubeType } from '@/types/cube';
import { CUBE_TYPE_LABEL } from '@/types/leaderboard';

interface ScrambleResponse {
  cubeType: CubeType;
  scrambles: string[];
}

/**
 * scramble **ต้องพกประเภทของตัวเองมาด้วยเสมอ**
 *
 * ตอนกดสลับประเภท `cubeType` เปลี่ยนก่อน แต่ scramble ตัวใหม่มาทีหลัง (ต้องรอ REST)
 * ถ้าส่งของเก่าให้คิวบ์ตัวใหม่ เช่น scramble ของ 3x3x3 (`Rw`, `M`) ให้ 2x2x2 โมเดลจะโยน
 * error กลางการ render แล้ว **React ถอดทั้งหน้าทิ้ง — จอขาวจนกว่าจะรีเฟรช**
 */
interface Scramble {
  cubeType: CubeType;
  text: string;
}

/**
 * ห้องฝึกซ้อม — เล่นคนเดียว **ไม่บันทึกอะไรลง DB เลย** (game-rules.md ข้อ 12)
 *
 * ไม่ใช้ Socket.IO ทำงานฝั่ง client ล้วน ยกเว้นการขอ scramble จาก server ผ่าน REST
 * (server เป็นคน generate เสมอ — ห้าม client สุ่มเอง)
 *
 * หน้าตายึดตาม `design/Custom - Train.png` (ADR-024) — ของที่ดีไซน์ไม่มีแต่ต้องมี
 * คือ **ตัวเลือกประเภทรูบิค** กับ **สวิตช์ inspection** เพราะกติกากำหนดไว้ทั้งคู่
 */
export default function PracticePage() {
  const [cubeType, setCubeType] = useState<CubeType>('3x3x3');
  const [scramble, setScramble] = useState<Scramble | null>(null);
  const [scrambleError, setScrambleError] = useState<string | null>(null);
  const [loadingScramble, setLoadingScramble] = useState(false);
  const [inspectionEnabled, setInspectionEnabled] = useState(false);
  /** กำลังหมุน scramble ให้ดูอยู่ — ระหว่างนี้ปุ่มทั้งแผงต้องกดไม่ได้ (ADR-032 ข้อ 1) */
  const [scrambling, setScrambling] = useState(false);
  const [moveCount, setMoveCount] = useState(0);
  const [solves, setSolves] = useState<PracticeSolve[]>([]);
  /** กำลังเล่นอนิเมชัน "แก้ให้ดู" อยู่ — ระหว่างนี้ปุ่มทั้งแผงกดไม่ได้เหมือนตอนหมุน scramble */
  const [replaying, setReplaying] = useState(false);
  /** รอบนี้ใช้ปุ่ม "เสร็จทันที" ไปแล้ว → **ห้ามลงสถิติ** และต้องบอกบนจอ (ADR-032 ข้อ 2) */
  const [assisted, setAssisted] = useState(false);
  /** อนิเมชัน "แก้ให้ดู" จบแล้วแต่คิวบ์ยังไม่ผ่านกติกาข้อ 11 — เป็นบั๊ก ห้ามกลืนเงียบ */
  const [finishNowError, setFinishNowError] = useState<string | null>(null);

  const cubeRef = useRef<CubeCanvasHandle>(null);
  /** จำนวน move ล่าสุดแบบอ่านได้ทันที — state ของ React ตามไม่ทันตอนบันทึกผล */
  const moveCountRef = useRef(0);
  /**
   * รอบนี้ **บันทึกผลไปแล้ว หรือถูกสั่งห้ามบันทึก** — `record()` จะไม่ทำอะไรถ้าเป็น `true`
   *
   * ตั้งเป็น `true` สองกรณี: บันทึกไปแล้วรอบหนึ่ง (กันซ้ำ) และ **กดปุ่ม "เสร็จทันที"**
   * ซึ่งกติกาข้อ 12.2 ห้ามลงสถิติทั้ง attempt ไม่ว่าจะจบยังไง (จบเองหรือกดยกเลิกทีหลัง)
   */
  const recordedRef = useRef(false);
  /**
   * กำลังเล่นอนิเมชัน "แก้ให้ดู" อยู่หรือเปล่า แบบอ่านได้ทันที
   *
   * ระหว่างนี้ **ห้ามให้ `onState` หยุดนาฬิกา** — สถานะจะกลายเป็น "แก้เสร็จ" ตั้งแต่ท่าสุดท้าย
   * ถูกลงบัญชี ซึ่งเกิด*ก่อน*อนิเมชันของท่านั้นเล่นจบ (ADR-033) แต่กติกาข้อ 12.2 บอกว่า
   * นาฬิกาต้องหยุด **หลังอนิเมชันจบ** เท่านั้น
   */
  const replayingRef = useRef(false);
  /**
   * ลำดับของคำขอ scramble ล่าสุด — คำขอที่ตกรุ่นห้ามเขียนผลทับ
   *
   * ถ้าสลับประเภทตอน REST ยังค้างอยู่ ของเก่าจะกลับมาแล้วตั้ง `scrambling = true` ทั้งที่
   * คิวบ์ตัวใหม่ไม่มีอะไรให้เล่น → ไม่มีใครแจ้งว่าจบ ปุ่มทั้งแผงค้าง disabled ตลอดกาล
   */
  const scrambleRequestRef = useRef(0);
  const timer = useSolveTimer(inspectionEnabled);
  const { phase, reset: resetTimer } = timer;
  /** นาฬิกาตัวล่าสุดแบบอ่านได้ทันที — callback ที่ค้างข้ามอนิเมชันต้องไม่ถือของเก่า */
  const timerRef = useRef(timer);
  timerRef.current = timer;

  useEffect(() => setSolves(loadSolves(cubeType)), [cubeType]);

  /** ตั้งตัวนับ move (เก็บลง ref ด้วย เพราะตอนบันทึกผลต้องอ่านค่าล่าสุดให้ทัน) */
  const setMoves = useCallback((count: number) => {
    moveCountRef.current = count;
    setMoveCount(count);
  }, []);

  /** เริ่มนับรอบใหม่ — ตัวนับ move กลับเป็นศูนย์ และยังไม่ได้บันทึกผล */
  const beginAttempt = useCallback(() => {
    setMoves(0);
    recordedRef.current = false;
    setAssisted(false);
    setFinishNowError(null);
  }, [setMoves]);

  const fetchScramble = useCallback(
    async (type: CubeType) => {
      const run = ++scrambleRequestRef.current;
      setLoadingScramble(true);
      setScrambleError(null);
      try {
        const data = await apiFetch<ScrambleResponse>(`/scramble?cubeType=${type}&count=1`);
        if (scrambleRequestRef.current !== run) return;
        const text = data.scrambles[0];
        resetTimer();
        beginAttempt();
        // ตั้ง `scrambling` ตรงนี้เลย ไม่รอ `CubeCanvas` แจ้งกลับ — ระหว่างสองจังหวะนั้น
        // มีเฟรมที่ปุ่มกลับมากดได้ ซึ่งพอให้กด "เริ่มจับเวลา" ทับอนิเมชันที่ยังไม่เริ่มได้
        setScrambling(Boolean(text));
        setScramble(text ? { cubeType: type, text } : null);
      } catch (err) {
        if (scrambleRequestRef.current !== run) return;
        setScrambling(false);
        setScrambleError(errorMessage(err, 'ขอ scramble ไม่สำเร็จ'));
      } finally {
        if (scrambleRequestRef.current === run) setLoadingScramble(false);
      }
    },
    [resetTimer, beginAttempt],
  );

  /**
   * เข้าห้อง (และทุกครั้งที่สลับประเภท) = **คิวบ์แก้เสร็จครบทุกหน้า ยังไม่มี scramble**
   * (game-rules.md ข้อ 12.1) — scramble จะมาตอนกดปุ่มสุ่มเท่านั้น แล้วหมุนให้ดูทีละท่า
   */
  useEffect(() => {
    scrambleRequestRef.current += 1; // ทิ้งคำขอของประเภทเก่าที่ยังค้างอยู่
    setScramble(null);
    setScrambleError(null);
    setScrambling(false);
    setLoadingScramble(false);
    resetTimer();
    beginAttempt();
  }, [cubeType, resetTimer, beginAttempt]);

  /** เก็บผลลง localStorage — ที่เดียวที่ห้องฝึกซ้อมบันทึกอะไรได้ (รอบละครั้งเท่านั้น) */
  const record = useCallback(
    (seconds: number | null) => {
      if (!scramble || recordedRef.current) return;
      recordedRef.current = true;
      setSolves(
        appendSolve(cubeType, {
          seconds,
          scramble: scramble.text,
          moveCount: moveCountRef.current,
          at: Date.now(),
        }),
      );
    },
    [cubeType, scramble],
  );

  /** นับเฉพาะ move ที่ผู้เล่นหมุนเอง — ท่าที่โปรแกรมเล่นให้ดูตอนกด "เสร็จทันที" ไม่นับ */
  const handleMove = useCallback(
    (event: CubeMoveEvent) => {
      if (event.source !== 'player') return;
      // หมุนหน้าคิวบ์ระหว่าง inspection = **ข้ามเข้าจับเวลาทันที** และท่านี้นับเป็นท่าแรก
      // ของรอบ ไม่ใช่ทิ้ง (ห้องฝึกซ้อมเท่านั้น — ADR-032 ข้อ 3) · หมุนกล้องไม่ยิง event นี้
      // จึงไม่ถือว่าข้าม · นอกช่วง inspection ตัวนี้ไม่ทำอะไรเลย
      timerRef.current.skipInspection();
      setMoves(moveCountRef.current + 1);
    },
    [setMoves],
  );

  /** แก้ครบทุกหน้าระหว่างจับเวลา = หยุดนาฬิกาทันที ไม่ต้องกดอะไรเลย */
  const handleState = useCallback(
    (state: CubeState) => {
      // ระหว่างเล่น "แก้ให้ดู" ต้องรอให้อนิเมชันจบก่อนเสมอ — ดู `replayingRef`
      if (state.solved && phase === 'solving' && !recordedRef.current && !replayingRef.current) {
        record(timer.finish());
      }
    },
    [phase, timer, record],
  );

  const handleAbort = useCallback(() => {
    timer.abort();
    record(null);
  }, [timer, record]);

  const handleReset = useCallback(() => {
    cubeRef.current?.reset();
    resetTimer();
    beginAttempt();
  }, [resetTimer, beginAttempt]);

  /**
   * เริ่มจับเวลา — **รีเซ็ตคิวบ์กลับไปที่ scramble ให้อัตโนมัติเสมอ**
   *
   * ก่อนเริ่มจับเวลาผู้เล่นหมุนเล่นได้ (จะได้ลองจับลูกก่อน) แต่พอเริ่มจริงต้องออกตัวจาก
   * scramble เดียวกันกับที่ server ส่งมา ไม่งั้นเวลาที่ได้เทียบกับใครไม่ได้เลย
   */
  const handleStart = useCallback(() => {
    if (!scramble) return;
    cubeRef.current?.reset();
    beginAttempt();
    timer.start();
  }, [timer, beginAttempt, scramble]);

  /**
   * "เสร็จทันที (แก้ให้ดู)" — **เล่นอนิเมชันย้อน move จนจบก่อน แล้วค่อยหยุดเวลา**
   * (game-rules.md ข้อ 12.2 · ADR-032 ข้อ 2 ซึ่งกลับข้อ 3 ของ ADR-029 ที่เคยหยุด ณ วินาทีที่กด)
   *
   * เงื่อนไขการหยุดนาฬิกามีสองข้อและต้องครบทั้งคู่: **อนิเมชันเล่นจบ** และ
   * **สถานะคิวบ์ผ่านกติกา "แก้เสร็จ" ของข้อ 11 จริง** — ถ้าจบแล้วยังไม่ผ่านคือโมเดล
   * กับกติกาหลุดกัน ต้องฟ้องบนจอและ **ห้ามหยุดเวลา** (เป็นบั๊กที่ต้องเห็น ไม่ใช่กลืน)
   *
   * เวลาที่ได้รวมช่วงอนิเมชันไปด้วย (~6 วินาทีที่ 20 ท่า) จึงไม่ใช่ฝีมือผู้เล่น →
   * attempt นี้ **ไม่ลงสถิติ `localStorage`** และมีข้อความบอกบนจอ
   */
  const handleFinishNow = useCallback(() => {
    const cube = cubeRef.current;
    if (!cube || replayingRef.current) return;
    replayingRef.current = true;
    // ปิดบัญชีทั้ง attempt ตั้งแต่วินาทีที่กด — ไม่ว่ารอบนี้จะจบยังไง (แก้จบ / กดยกเลิก
    // ทีหลัง) ก็ห้ามลงสถิติ `localStorage` ทั้งนั้น (game-rules.md ข้อ 12.2)
    recordedRef.current = true;
    setReplaying(true);
    setAssisted(true);
    setFinishNowError(null);

    void cube
      .solve()
      .then(() => {
        const state = cubeRef.current?.getState();
        // view ถูกทิ้งกลางอนิเมชัน (สลับประเภทรูบิค) → รอบนี้ไม่มีอะไรให้ตัดสินแล้ว
        if (!state) return;
        if (!state.solved) {
          setFinishNowError(
            'อนิเมชันแก้จบแล้วแต่คิวบ์ยังไม่ผ่านกติกา "แก้เสร็จ" — ไม่หยุดเวลา (โมเดลกับกติกาหลุดกัน)',
          );
          return;
        }
        // นับเป็นแก้เสร็จ ไม่ใช่ DNF (แต่ไม่ลงสถิติ — ปิดบัญชีไว้ตั้งแต่ตอนกดแล้ว)
        if (timerRef.current.phase === 'solving') timerRef.current.finish();
      })
      .finally(() => {
        replayingRef.current = false;
        setReplaying(false);
      });
  }, []);

  /** กำลังรอ scramble หรือกำลังหมุนให้ดูอยู่ (scramble / "แก้ให้ดู") = ห้ามกดอะไรทั้งแผง */
  const busy = loadingScramble || scrambling || replaying;

  // เว้นวรรค = เริ่มจับเวลา ตามธรรมเนียมโปรแกรมจับเวลาของ speedcuber
  // (ยังไม่มี scramble ก็ให้เว้นวรรคสั่งสุ่มได้ ไม่งั้นเข้าห้องมาแล้วปุ่มเดียวที่กดได้อยู่ห่างจากมือ)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'BUTTON'].includes(target.tagName)) return;
      event.preventDefault();
      if (busy) return;
      if (phase === 'idle' && scramble) handleStart();
      else if (phase === 'idle' || phase === 'finished') void fetchScramble(cubeType);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, scramble, handleStart, fetchScramble, cubeType, busy]);

  const times = useMemo(() => solves.map((s) => s.seconds), [solves]);
  const statusText = scrambling
    ? 'กำลังหมุน scramble ให้ดู'
    : replaying
      ? 'กำลังแก้ให้ดู'
      : {
          idle: scramble ? 'พร้อมเริ่ม' : 'ยังไม่มี scramble',
          inspection: 'กำลังตรวจสอบคิวบ์',
          solving: 'กำลังจับเวลา',
          finished: timer.resultSeconds === null ? 'ยกเลิก (DNF)' : 'แก้เสร็จแล้ว',
        }[phase];

  return (
    // จอ `lg` ขึ้นไปล็อกความสูงเท่าจอ หน้าไม่เลื่อน — แผงควบคุมเลื่อนในตัวเองแทน (ADR-059 ข้อ 3)
    <div className="min-h-screen bg-navy-900 lg:flex lg:h-[calc(100dvh-var(--offline-banner-h,0px))] lg:min-h-0 lg:flex-col lg:overflow-hidden">
      <AppHeader />

      <main className="page-wide grid gap-4 px-4 py-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[1fr_22rem]">
        {/* ---------------- ฝั่งซ้าย: คิวบ์ 3 มิติ ---------------- */}
        <section className="relative h-[62vh] min-h-[22rem] overflow-hidden rounded-2xl border border-line bg-navy-850 lg:h-full lg:min-h-0">
          {/* `null` จนกว่า scramble **ของประเภทนี้** จะมาถึง — ห้ามเอาของประเภทเก่ามาใส่เด็ดขาด
              (`null` = คิวบ์ครบทุกหน้า ซึ่งเป็นภาพที่ต้องเห็นตอนเข้าห้องพอดี) */}
          <CubeCanvas
            ref={cubeRef}
            cubeType={cubeType}
            scramble={scramble?.cubeType === cubeType ? scramble.text : null}
            // ปิดเฉพาะช่วงที่โปรแกรมหมุนให้ดูอยู่ (scramble / "แก้ให้ดู") เท่านั้น
            // **ช่วง inspection ของห้องฝึกซ้อมเปิดไว้** เพราะหมุนหน้าคิวบ์ = ข้ามเข้าจับเวลา
            // (ADR-032 ข้อ 3) — ห้องแข่งในเฟส 4 ต้องปิดตอน inspection เหมือนเดิม
            turnsEnabled={!replaying && !scrambling}
            // ห้องฝึกซ้อมเท่านั้น — ห้องแข่งในเฟส 4 ห้ามส่ง flag นี้ (ADR-032 ข้อ 1)
            animateScramble
            onScrambleAnimatingChange={setScrambling}
            onState={handleState}
            onMove={handleMove}
          />

          <div className="pointer-events-none absolute bottom-4 left-4 flex gap-6 rounded-xl border border-line bg-navy-900/80 px-5 py-3 backdrop-blur">
            <div>
              <p className="text-[11px] tracking-widest text-slate-500">MOVES</p>
              <p className="tabular text-xl font-semibold text-slate-100">{moveCount}</p>
            </div>
            <div>
              <p className="text-[11px] tracking-widest text-slate-500">สถานะ</p>
              <p className="text-sm font-medium text-brand-400">{statusText}</p>
            </div>
          </div>

          {(phase !== 'solving' || replaying) && (
            <p className="pointer-events-none absolute right-4 top-4 max-w-[16rem] rounded-lg border border-line bg-navy-900/80 px-3 py-1.5 text-xs text-slate-400 backdrop-blur">
              {scrambling
                ? 'กำลังหมุน scramble ให้ดูทีละท่า · ระหว่างนี้หมุนเองไม่ได้'
                : replaying
                  ? 'กำลังย้อนท่าให้ดูทีละท่า · นาฬิกาจะหยุดเมื่อหมุนครบและคิวบ์ครบทุกหน้า'
                  : phase === 'inspection'
                    ? 'ลากดูรอบ ๆ ได้ · หมุนหน้าคิวบ์เมื่อไหร่ = เริ่มจับเวลาทันที (ท่านั้นนับเป็นท่าแรก)'
                    : scramble === null
                      ? 'คิวบ์ครบทุกหน้าแล้ว · กด "สุ่ม scramble" แล้วระบบจะหมุนให้ดูทีละท่า'
                      : 'หมุนเล่นได้ตามใจ · กดเริ่มแล้วคิวบ์จะกลับไปที่ scramble ให้เอง'}
            </p>
          )}
        </section>

        {/* ---------------- ฝั่งขวา: แผงควบคุม ---------------- */}
        <aside className="flex flex-col gap-4 self-start lg:max-h-full lg:min-h-0 lg:overflow-y-auto">
          <section className="rounded-2xl border border-line bg-navy-850/80 px-5 py-4">
            <p className="text-center text-xs text-slate-400">สถานะการเล่น</p>
            <h1 className="text-center text-2xl font-bold text-brand-400">ห้องฝึกซ้อม</h1>
            <p className="mt-1 text-center text-xs text-slate-500">
              ไม่บันทึกผลลงระบบ ไม่มีผลต่อคะแนน
            </p>

            {/* dropdown แทนแท็บ 4 ปุ่ม — แผงกว้าง 22rem แท็บตกบรรทัด (ADR-059 ข้อ 6) */}
            <div className="mt-4">
              <CubeTypeSelect value={cubeType} onChange={setCubeType} />
            </div>

            <div className="mt-5">
              <TimerDisplay
                phase={phase}
                startedAt={timer.startedAt}
                resultSeconds={timer.resultSeconds}
                inspectionLeft={timer.inspectionLeft}
              />
              {/* เวลาที่ได้รวมช่วงอนิเมชันไปด้วย จึงไม่ใช่ฝีมือผู้เล่น — ต้องบอกให้ชัด
                  ว่าไม่ลงสถิติ (game-rules.md ข้อ 12.2) */}
              {assisted && (
                <p className="mt-2 text-center text-xs text-gold-400">
                  รอบนี้ใช้ปุ่ม "เสร็จทันที (แก้ให้ดู)" · เวลารวมช่วงอนิเมชันด้วย{' '}
                  <span className="font-semibold">จึงไม่บันทึกลงสถิติ</span>
                </p>
              )}
              {finishNowError && (
                <p className="mt-2 rounded-lg border border-loss/40 px-3 py-2 text-center text-xs text-loss">
                  {finishNowError}
                </p>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-line bg-navy-900/70 px-4 py-3">
              <p className="text-[11px] tracking-widest text-slate-500">SCRAMBLE</p>
              <p className="tabular mt-1 break-words text-sm leading-6 text-slate-200">
                {scrambleError ??
                  (loadingScramble
                    ? 'กำลังขอ scramble…'
                    : (scramble?.text ?? 'ยังไม่มี — กดสุ่มเพื่อให้ระบบหมุนให้ดู'))}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void fetchScramble(cubeType)}
                disabled={busy || phase === 'solving' || phase === 'inspection'}
                className="rounded-lg bg-navy-700 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                สุ่มใหม่
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={!scramble || busy}
                className="rounded-lg border border-line bg-navy-800 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                รีเซ็ตคิวบ์
              </button>

              <button
                type="button"
                onClick={handleFinishNow}
                // ช่วง inspection ยังไม่มีนาฬิกาให้หยุด — ปล่อยให้กดได้จะได้คิวบ์ครบสี
                // ตั้งแต่ยังไม่เริ่มจับเวลา ซึ่งไม่มีความหมายอะไร
                disabled={!scramble || busy || phase === 'inspection'}
                className="col-span-2 rounded-lg border border-line bg-navy-800 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {replaying ? 'กำลังแก้ให้ดู…' : 'เสร็จทันที (แก้ให้ดู)'}
              </button>

              {phase === 'idle' || phase === 'finished' ? (
                <button
                  type="button"
                  onClick={() =>
                    phase === 'idle' && scramble ? handleStart() : void fetchScramble(cubeType)
                  }
                  disabled={busy}
                  className="col-span-2 rounded-lg bg-brand-500 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {/* จบด้วย "เสร็จทันที" = คิวบ์ครบสีแล้ว ไม่มีอะไรให้ "เล่นอีกครั้ง" ·
                      กดแล้วทำงานเหมือนกันทั้งสองป้าย คือขอ scramble ใหม่ (ADR-059 ข้อ 6) */}
                  {scrambling
                    ? 'กำลังหมุน scramble ให้ดู…'
                    : phase === 'finished'
                      ? assisted
                        ? 'สุ่มใหม่ (เว้นวรรค)'
                        : 'เล่นอีกครั้ง (เว้นวรรค)'
                      : scramble
                        ? 'เริ่มจับเวลา (เว้นวรรค)'
                        : 'สุ่ม scramble (เว้นวรรค)'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAbort}
                  disabled={busy}
                  className="col-span-2 rounded-lg border border-loss/40 px-3 py-2.5 text-sm font-semibold text-loss transition hover:bg-loss/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ยกเลิกรอบนี้ (DNF)
                </button>
              )}
            </div>

            <label className="mt-4 flex items-center justify-between rounded-lg border border-line-soft px-3 py-2">
              <span className="text-sm text-slate-300">
                ช่วงตรวจสอบคิวบ์ {INSPECTION_SECONDS} วินาที
              </span>
              <input
                type="checkbox"
                checked={inspectionEnabled}
                onChange={(e) => setInspectionEnabled(e.target.checked)}
                disabled={busy || phase === 'solving' || phase === 'inspection'}
                className="h-4 w-4 accent-[var(--color-brand-500)]"
              />
            </label>

            <Link
              to="/"
              className="mt-3 block rounded-lg bg-brand-600/80 px-3 py-2 text-center text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              ออกจากห้อง
            </Link>
          </section>

          <PracticeStats
            cubeType={cubeType}
            solves={solves}
            times={times}
            onClear={() => {
              clearSolves(cubeType);
              setSolves([]);
            }}
          />
        </aside>
      </main>
    </div>
  );
}

function PracticeStats({
  cubeType,
  solves,
  times,
  onClear,
}: {
  cubeType: CubeType;
  solves: PracticeSolve[];
  times: (number | null)[];
  onClear: () => void;
}) {
  const recent = [...solves].reverse().slice(0, 8);

  return (
    <section className="rounded-2xl border border-line bg-navy-850/80 px-5 py-4">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">
          สถิติ {CUBE_TYPE_LABEL[cubeType]} ({solves.length} รอบ)
        </h2>
        {solves.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-slate-500 transition hover:text-loss"
          >
            ล้างสถิติ
          </button>
        )}
      </header>
      <p className="mt-0.5 text-xs text-slate-600">
        เก็บในเครื่องนี้เท่านั้น ไม่นับรวมกับสถิติในโปรไฟล์
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <MiniStat label="ดีที่สุด" value={formatSolveTime(bestTime(times))} />
        <MiniStat label="เฉลี่ยรวม" value={formatSolveTime(meanTime(times))} />
        <MiniStat label="Ao5" value={formatSolveTime(averageOfN(times, 5))} />
        <MiniStat label="Ao12" value={formatSolveTime(averageOfN(times, 12))} />
        <MiniStat label="Ao100" value={formatSolveTime(averageOfN(times, 100))} />
        <MiniStat label="DNF" value={String(times.filter((t) => t === null).length)} />
      </div>

      {recent.length > 0 && (
        <ol className="mt-4 space-y-1 text-sm">
          {recent.map((solve, index) => (
            <li
              key={solve.at}
              className="flex items-center justify-between border-b border-line-soft/60 pb-1 last:border-0"
            >
              <span className="text-xs text-slate-500">#{solves.length - index}</span>
              <span
                className={`tabular ${solve.seconds === null ? 'text-loss' : 'text-slate-200'}`}
              >
                {solve.seconds === null ? 'DNF' : formatSolveTime(solve.seconds)}
              </span>
              <span className="text-xs text-slate-600">{solve.moveCount} moves</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line-soft bg-navy-900/50 px-3 py-2">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="tabular text-lg font-semibold text-slate-100">{value}</p>
    </div>
  );
}
