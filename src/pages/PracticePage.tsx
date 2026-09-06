import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { CubeCanvas, type CubeCanvasHandle } from '@/components/CubeCanvas';
import { CubeTypePicker } from '@/components/CubeTypePicker';
import type { CubeMoveEvent, CubeState } from '@/cube';
import { ApiError, apiFetch } from '@/lib/api';
import { averageOfN, bestTime, meanTime } from '@/lib/averages';
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
  const [moveCount, setMoveCount] = useState(0);
  const [solves, setSolves] = useState<PracticeSolve[]>([]);
  const [replaying, setReplaying] = useState(false);

  const cubeRef = useRef<CubeCanvasHandle>(null);
  /** จำนวน move ล่าสุดแบบอ่านได้ทันที — state ของ React ตามไม่ทันตอนบันทึกผล */
  const moveCountRef = useRef(0);
  /** รอบนี้บันทึกผลไปแล้วหรือยัง — กันบันทึกซ้ำตอนกด "เสร็จทันที" แล้วอนิเมชันแก้จบ */
  const recordedRef = useRef(false);
  const timer = useSolveTimer(inspectionEnabled);
  const { phase, reset: resetTimer } = timer;

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
  }, [setMoves]);

  const fetchScramble = useCallback(
    async (type: CubeType) => {
      setLoadingScramble(true);
      setScrambleError(null);
      try {
        const data = await apiFetch<ScrambleResponse>(`/scramble?cubeType=${type}&count=1`);
        const text = data.scrambles[0];
        setScramble(text ? { cubeType: type, text } : null);
        resetTimer();
        beginAttempt();
      } catch (err) {
        setScrambleError(err instanceof ApiError ? err.message : 'ขอ scramble ไม่สำเร็จ');
      } finally {
        setLoadingScramble(false);
      }
    },
    [resetTimer, beginAttempt],
  );

  useEffect(() => {
    void fetchScramble(cubeType);
  }, [cubeType, fetchScramble]);

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
      if (event.source === 'player') setMoves(moveCountRef.current + 1);
    },
    [setMoves],
  );

  /** แก้ครบทุกหน้าระหว่างจับเวลา = หยุดนาฬิกาทันที ไม่ต้องกดอะไรเลย */
  const handleState = useCallback(
    (state: CubeState) => {
      if (state.solved && phase === 'solving' && !recordedRef.current) {
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
    cubeRef.current?.reset();
    beginAttempt();
    timer.start();
  }, [timer, beginAttempt]);

  /**
   * "เสร็จทันที" — หยุดเวลา ณ วินาทีที่กด **แล้วนับเป็นแก้เสร็จ ไม่ใช่ DNF**
   * จากนั้นค่อยเล่นอนิเมชันย้อน move ให้ดูว่าแก้ยังไง (เวลาที่บันทึกไม่รวมช่วงอนิเมชัน)
   */
  const handleFinishNow = useCallback(() => {
    const cube = cubeRef.current;
    if (!cube) return;
    if (phase === 'solving') record(timer.finish());
    setReplaying(true);
    void cube.solve().finally(() => setReplaying(false));
  }, [phase, timer, record]);

  // เว้นวรรค = เริ่มจับเวลา ตามธรรมเนียมโปรแกรมจับเวลาของ speedcuber
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'BUTTON'].includes(target.tagName)) return;
      event.preventDefault();
      if (phase === 'idle' && scramble) handleStart();
      else if (phase === 'finished') void fetchScramble(cubeType);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, scramble, handleStart, fetchScramble, cubeType]);

  const times = useMemo(() => solves.map((s) => s.seconds), [solves]);
  const statusText = {
    idle: 'พร้อมเริ่ม',
    inspection: 'กำลังตรวจสอบคิวบ์',
    solving: 'กำลังจับเวลา',
    finished: timer.resultSeconds === null ? 'ยกเลิก (DNF)' : 'แก้เสร็จแล้ว',
  }[phase];

  return (
    <div className="min-h-screen bg-navy-900">
      <AppHeader />

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-6 lg:grid-cols-[1fr_22rem]">
        {/* ---------------- ฝั่งซ้าย: คิวบ์ 3 มิติ ---------------- */}
        <section className="relative h-[62vh] min-h-[22rem] overflow-hidden rounded-2xl border border-line bg-navy-850 lg:h-[calc(100vh-7rem)]">
          {/* รอจน scramble ของประเภทนี้มาถึงก่อนค่อยวาด — ห้ามเอาของประเภทเก่ามาใส่เด็ดขาด */}
          {scramble?.cubeType === cubeType && (
            <CubeCanvas
              ref={cubeRef}
              cubeType={cubeType}
              scramble={scramble.text}
              // ห้ามหมุนเฉพาะช่วง inspection ที่กติกาให้พลิกดูได้อย่างเดียว (game-rules.md ข้อ 2)
              // นอกช่วงจับเวลาหมุนเล่นได้ — กดเริ่มแล้วคิวบ์จะถูกรีเซ็ตกลับไปที่ scramble ให้เอง
              turnsEnabled={phase !== 'inspection' && !replaying}
              onState={handleState}
              onMove={handleMove}
            />
          )}

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

          {phase !== 'solving' && scramble !== null && (
            <p className="pointer-events-none absolute right-4 top-4 rounded-lg border border-line bg-navy-900/80 px-3 py-1.5 text-xs text-slate-400 backdrop-blur">
              {phase === 'inspection'
                ? 'ช่วงนี้หมุนคิวบ์ไม่ได้ ลากเพื่อดูรอบ ๆ ได้'
                : 'หมุนเล่นได้ตามใจ · กดเริ่มแล้วคิวบ์จะกลับไปที่ scramble ให้เอง'}
            </p>
          )}
        </section>

        {/* ---------------- ฝั่งขวา: แผงควบคุม ---------------- */}
        <aside className="flex flex-col gap-4 self-start">
          <section className="rounded-2xl border border-line bg-navy-850/80 px-5 py-4">
            <p className="text-center text-xs text-slate-400">สถานะการเล่น</p>
            <h1 className="text-center text-2xl font-bold text-brand-400">ห้องฝึกซ้อม</h1>
            <p className="mt-1 text-center text-xs text-slate-500">
              ไม่บันทึกผลลงระบบ ไม่มีผลต่อคะแนน
            </p>

            <div className="mt-4 flex justify-center">
              <CubeTypePicker value={cubeType} onChange={setCubeType} />
            </div>

            <div className="mt-5">
              <TimerDisplay
                phase={phase}
                startedAt={timer.startedAt}
                resultSeconds={timer.resultSeconds}
                inspectionLeft={timer.inspectionLeft}
              />
            </div>

            <div className="mt-4 rounded-xl border border-line bg-navy-900/70 px-4 py-3">
              <p className="text-[11px] tracking-widest text-slate-500">SCRAMBLE</p>
              <p className="tabular mt-1 break-words text-sm leading-6 text-slate-200">
                {scrambleError ??
                  (loadingScramble ? 'กำลังขอ scramble…' : (scramble?.text ?? '—'))}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void fetchScramble(cubeType)}
                disabled={loadingScramble || phase === 'solving' || phase === 'inspection'}
                className="rounded-lg bg-navy-700 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                สุ่มใหม่
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={!scramble}
                className="rounded-lg border border-line bg-navy-800 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                รีเซ็ตคิวบ์
              </button>

              <button
                type="button"
                onClick={handleFinishNow}
                disabled={!scramble || phase === 'inspection' || replaying}
                className="col-span-2 rounded-lg border border-line bg-navy-800 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {replaying ? 'กำลังแก้ให้ดู…' : 'เสร็จทันที (แก้ให้ดู)'}
              </button>

              {phase === 'idle' || phase === 'finished' ? (
                <button
                  type="button"
                  onClick={() =>
                    phase === 'finished' ? void fetchScramble(cubeType) : handleStart()
                  }
                  disabled={!scramble}
                  className="col-span-2 rounded-lg bg-brand-500 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {phase === 'finished' ? 'เล่นอีกครั้ง (เว้นวรรค)' : 'เริ่มจับเวลา (เว้นวรรค)'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAbort}
                  className="col-span-2 rounded-lg border border-loss/40 px-3 py-2.5 text-sm font-semibold text-loss transition hover:bg-loss/10"
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
                disabled={phase === 'solving' || phase === 'inspection'}
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
