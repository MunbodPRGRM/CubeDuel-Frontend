import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { CubeCanvas, type CubeCanvasHandle } from '@/components/CubeCanvas';
import { CubeTypePicker } from '@/components/CubeTypePicker';
import type { CubeState } from '@/cube';
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
 * ห้องฝึกซ้อม — เล่นคนเดียว **ไม่บันทึกอะไรลง DB เลย** (game-rules.md ข้อ 12)
 *
 * ไม่ใช้ Socket.IO ทำงานฝั่ง client ล้วน ยกเว้นการขอ scramble จาก server ผ่าน REST
 * (server เป็นคน generate เสมอ — ห้าม client สุ่มเอง)
 *
 * หน้าตายึดตาม `ตัวอย่างเว็บไซต์/Custom - Train.png` (ADR-024) — ของที่ดีไซน์ไม่มีแต่ต้องมี
 * คือ **ตัวเลือกประเภทรูบิค** กับ **สวิตช์ inspection** เพราะกติกากำหนดไว้ทั้งคู่
 */
export default function PracticePage() {
  const [cubeType, setCubeType] = useState<CubeType>('3x3x3');
  const [scramble, setScramble] = useState<string | null>(null);
  const [scrambleError, setScrambleError] = useState<string | null>(null);
  const [loadingScramble, setLoadingScramble] = useState(false);
  const [inspectionEnabled, setInspectionEnabled] = useState(false);
  const [moveCount, setMoveCount] = useState(0);
  const [solves, setSolves] = useState<PracticeSolve[]>([]);

  const cubeRef = useRef<CubeCanvasHandle>(null);
  const timer = useSolveTimer(inspectionEnabled);
  const { phase, reset: resetTimer } = timer;

  useEffect(() => setSolves(loadSolves(cubeType)), [cubeType]);

  const fetchScramble = useCallback(
    async (type: CubeType) => {
      setLoadingScramble(true);
      setScrambleError(null);
      try {
        const data = await apiFetch<ScrambleResponse>(`/scramble?cubeType=${type}&count=1`);
        setScramble(data.scrambles[0] ?? null);
        resetTimer();
        setMoveCount(0);
      } catch (err) {
        setScrambleError(err instanceof ApiError ? err.message : 'ขอ scramble ไม่สำเร็จ');
      } finally {
        setLoadingScramble(false);
      }
    },
    [resetTimer],
  );

  useEffect(() => {
    void fetchScramble(cubeType);
  }, [cubeType, fetchScramble]);

  /** เก็บผลลง localStorage — ที่เดียวที่ห้องฝึกซ้อมบันทึกอะไรได้ */
  const record = useCallback(
    (seconds: number | null, moves: number) => {
      if (!scramble) return;
      setSolves(appendSolve(cubeType, { seconds, scramble, moveCount: moves, at: Date.now() }));
    },
    [cubeType, scramble],
  );

  const handleState = useCallback(
    (state: CubeState) => {
      setMoveCount(state.moves.length);
      if (state.solved && phase === 'solving') {
        const seconds = timer.finish();
        record(seconds, state.moves.length);
      }
    },
    [phase, timer, record],
  );

  const handleAbort = useCallback(() => {
    timer.abort();
    record(null, moveCount);
  }, [timer, record, moveCount]);

  const handleReset = useCallback(() => {
    cubeRef.current?.reset();
    resetTimer();
    setMoveCount(0);
  }, [resetTimer]);

  // เว้นวรรค = เริ่มจับเวลา ตามธรรมเนียมโปรแกรมจับเวลาของ speedcuber
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'BUTTON'].includes(target.tagName)) return;
      event.preventDefault();
      if (phase === 'idle' && scramble) timer.start();
      else if (phase === 'finished') void fetchScramble(cubeType);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, scramble, timer, fetchScramble, cubeType]);

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
          {scramble !== null && (
            <CubeCanvas
              ref={cubeRef}
              cubeType={cubeType}
              scramble={scramble}
              // หมุนหน้าคิวบ์ได้เฉพาะตอนจับเวลา — ช่วง inspection พลิกดูได้อย่างเดียว (game-rules.md ข้อ 2)
              turnsEnabled={phase === 'solving'}
              onState={handleState}
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
                : 'ลากบนคิวบ์เพื่อหมุน · ลากพื้นหลังเพื่อหมุนมุมมอง'}
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
                {scrambleError ?? (loadingScramble ? 'กำลังขอ scramble…' : (scramble ?? '—'))}
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

              {phase === 'idle' || phase === 'finished' ? (
                <button
                  type="button"
                  onClick={() =>
                    phase === 'finished' ? void fetchScramble(cubeType) : timer.start()
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
