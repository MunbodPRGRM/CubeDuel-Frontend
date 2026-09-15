import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ALLOWED_MOVES, createCubeView, type CubeView } from '@/cube';
import { checkServerHealth } from '@/lib/api';
import { CubeLogo } from './CubeLogo';

/**
 * หน้ารอเซิร์ฟเวอร์ตื่น — **บังทั้งเว็บ** จนกว่า `GET /health` ตอบ 200 (ADR-072)
 *
 * ต้องวางไว้ **นอก `AuthProvider`** เสมอ: auth ห้ามยิงใส่ server ที่ยังไม่ตื่น ไม่งั้น Render ตอบ 502/503
 * แล้ว `doRefresh()` เข้าใจว่าเซสชันตาย ผู้ใช้ที่ล็อกอินค้างไว้ถูกเด้งออกผิด ๆ (ADR-072 บริบท)
 *
 * เช็กครั้งเดียวต่อการโหลดหน้า — ผ่านแล้วไม่กลับมาหน้านี้อีก server ล่มกลางทางเป็นหน้าที่ของ
 * `OfflineBanner` / socket reconnect / `ErrorNotice` ของแต่ละหน้า (ADR-072 ข้อ 4)
 */

// ตัวเลขทั้งหมดมาจาก ADR-072 ข้อ 2 — แก้ที่นี่ต้องแก้ ADR ด้วย
const POLL_INTERVAL_MS = 2_500;
const REQUEST_TIMEOUT_MS = 10_000;
const SHOW_DELAY_MS = 500;
const SLOW_AFTER_MS = 90_000;
const FADE_MS = 400;
const TIP_INTERVAL_MS = 5_000;
const TURN_INTERVAL_MS = 900;

type GateStatus = 'waking' | 'db' | 'ready';

const STATUS_TEXT: Record<GateStatus, string> = {
  waking: 'กำลังปลุกเซิร์ฟเวอร์…',
  db: 'กำลังเชื่อมต่อฐานข้อมูล…',
  ready: 'พร้อมแล้ว',
};

const TIPS = [
  'ช่วง Inspection 15 วินาที พลิกดูคิวบ์ได้ แต่ยังหมุนหน้าไม่ได้',
  'คะแนน Elo แยกกันอิสระทั้ง 4 ประเภทรูบิค',
  'Pyramorphix คือ 2x2x2 ที่ถูกตัดให้เป็นทรงพีระมิด',
  '3x3x3 มีรูปแบบที่เป็นไปได้ราว 43 ล้านล้านล้านแบบ',
  'ทุกรูปแบบของ 3x3x3 แก้ได้ภายใน 20 ท่าเสมอ',
  'กระดานอันดับรายสัปดาห์เริ่มนับใหม่ทุกวันจันทร์ 00:00',
  'ห้องฝึกซ้อมไม่บันทึกผลลงสถิติ ซ้อมได้เต็มที่',
  'สร้างห้องเองแล้วแชร์รหัสห้องให้เพื่อนเข้ามาแข่งหรือดูได้',
];

export function ServerGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<GateStatus>('waking');
  /** หน้าโหลดถูกโชว์แล้วหรือยัง — server ตอบทันใน `SHOW_DELAY_MS` = ไม่เคยโชว์ ไม่ต้องเฟด */
  const [shown, setShown] = useState(false);
  const [fadedOut, setFadedOut] = useState(false);
  /** ผู้ใช้กด "ลองอีกครั้ง" แล้วรอคำตอบอยู่ — การถามเองเบื้องหลังไม่แตะค่านี้ ปุ่มจะได้ไม่กระพริบ */
  const [retrying, setRetrying] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const pollNowRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    const showTimer = setTimeout(() => setShown(true), SHOW_DELAY_MS);

    const poll = async () => {
      // กดปุ่มระหว่างมีคำถามค้างอยู่ = รอคำตอบของตัวที่ค้าง ไม่ยิงซ้อน
      if (inFlight) return;
      inFlight = true;
      clearTimeout(pollTimer);
      const health = await checkServerHealth(REQUEST_TIMEOUT_MS);
      inFlight = false;
      // StrictMode เรียก effect สองรอบตอน dev — คำตอบของรอบที่ถูกยกเลิกต้องทิ้ง
      if (cancelled) return;
      setRetrying(false);

      if (health === 'ok') {
        clearTimeout(showTimer);
        setStatus('ready');
        return;
      }
      setStatus(health === 'db_down' ? 'db' : 'waking');
      // นับจากตอนคำตอบกลับ ไม่ใช่ setInterval — request ที่ค้างนานจะได้ไม่ซ้อนกัน
      pollTimer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
    };

    pollNowRef.current = () => {
      setRetrying(true);
      void poll();
    };
    void poll();

    return () => {
      cancelled = true;
      clearTimeout(showTimer);
      clearTimeout(pollTimer);
    };
  }, []);

  useEffect(() => {
    if (status !== 'ready' || !shown) return;
    const timer = setTimeout(() => setFadedOut(true), FADE_MS);
    return () => clearTimeout(timer);
  }, [status, shown]);

  const ready = status === 'ready';

  return (
    <>
      {/* แอป mount ทันทีที่พร้อม แม้หน้าโหลดยังเฟดอยู่ข้างบน — ผู้ใช้จะเห็นหน้าเว็บโผล่ขึ้นมาใต้ม่าน */}
      {ready && children}
      {shown && !fadedOut && (
        <LoadingScreen
          status={status}
          startedAt={startedAt}
          retrying={retrying}
          onRetry={() => pollNowRef.current()}
        />
      )}
    </>
  );
}

function LoadingScreen({
  status,
  startedAt,
  retrying,
  onRetry,
}: {
  status: GateStatus;
  startedAt: number;
  retrying: boolean;
  onRetry: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * TIPS.length));
  const ready = status === 'ready';

  useEffect(() => {
    if (ready) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [ready]);

  useEffect(() => {
    const timer = setInterval(() => setTipIndex((i) => (i + 1) % TIPS.length), TIP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  const elapsedMs = Math.max(0, now - startedAt);
  const seconds = Math.floor(elapsedMs / 1_000);
  // ไม่รู้เวลาตื่นจริง → โค้งที่ช้าลงเรื่อย ๆ และไม่ถึง 100 จนกว่าจะพร้อมจริง (ADR-072 ข้อ 5)
  const progress = ready ? 100 : 95 * (1 - Math.exp(-elapsedMs / 25_000));
  const slow = !ready && elapsedMs >= SLOW_AFTER_MS;

  return (
    <div
      className={`fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-y-auto bg-navy-900 px-4 py-10 transition-opacity ${
        ready ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      {/* แสงจาง ๆ หลังคิวบ์ — ให้หน้าไม่แบนเกินไประหว่างรอนาน */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[36rem] w-[36rem] max-w-[120vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/10 blur-3xl"
      />

      <div className="relative flex w-full max-w-md flex-col items-center text-center">
        <div className="flex items-center gap-2.5">
          <CubeLogo size={30} />
          <span className="text-lg font-bold tracking-tight text-white">CubeDuel</span>
        </div>

        <div className="mt-4 h-56 w-56 sm:h-64 sm:w-64">
          <LoadingCube />
        </div>

        <p role="status" aria-live="polite" className="mt-2 text-lg font-semibold text-white">
          {STATUS_TEXT[status]}
        </p>
        <p className="mt-1 text-sm text-slate-400">
          {ready
            ? 'กำลังเข้าสู่เว็บไซต์'
            : 'เซิร์ฟเวอร์เพิ่งตื่นจากการพัก อาจใช้เวลาประมาณหนึ่งนาที'}
        </p>

        <div className="mt-6 w-full max-w-xs">
          <div className="h-1.5 overflow-hidden rounded-full bg-navy-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400 transition-[width] duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="tabular mt-2 text-xs text-slate-500">รอมาแล้ว {seconds} วินาที</p>
        </div>

        {slow && (
          <div className="mt-6 w-full rounded-2xl border border-gold-400/30 bg-gold-400/5 px-5 py-4">
            <p className="text-sm text-gold-400">
              เซิร์ฟเวอร์ตอบช้ากว่าปกติ ระบบยังลองเชื่อมต่อให้อยู่เรื่อย ๆ
            </p>
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="mt-3 rounded-xl bg-brand-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-wait disabled:opacity-60"
            >
              {retrying ? 'กำลังลองใหม่…' : 'ลองอีกครั้ง'}
            </button>
          </div>
        )}

        <p className="mt-8 min-h-[2.5rem] text-sm leading-relaxed text-slate-400">
          <span className="font-semibold text-brand-300">รู้หรือไม่ · </span>
          {TIPS[tipIndex]}
        </p>
      </div>
    </div>
  );
}

/** ท่าที่ใช้หมุนเล่น — หมุนหน้าเดียวล้วน ดูง่ายกว่า wide/slice */
const FACE_TURNS = ALLOWED_MOVES['3x3x3'].filter((move) => /^[UDLRFB]['2]?$/.test(move));

/**
 * คิวบ์ 3x3x3 หมุนหน้าสุ่มเองเรื่อย ๆ — ภาพประกอบล้วน **ไม่ใช่ scramble** (ADR-072 ข้อ 5)
 *
 * เรียก `createCubeView` ตรง ๆ ไม่ผ่าน `CubeCanvas` เพราะตัวนั้นเรียก `useAuth()`
 * ซึ่งยังไม่มี provider ตอนนี้ · สร้างไม่ได้ (ไม่มี WebGL) → โลโก้ SVG แทน
 */
function LoadingCube() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let view: CubeView | null = null;
    let turnTimer: ReturnType<typeof setInterval> | undefined;
    let lastFace = '';
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const turn = () => {
      // `applyMove` คืนทันทีแล้วเข้าคิวอนิเมชัน — แท็บที่ถูกซ่อนไม่วาด คิวจะพอกแล้วหมุนรัวตอนกลับมา
      if (!view || document.hidden) return;
      const candidates = FACE_TURNS.filter((move) => move[0] !== lastFace);
      const move = candidates[Math.floor(Math.random() * candidates.length)];
      lastFace = move[0];
      void view.applyMove(move);
    };

    createCubeView('3x3x3', container)
      .then((created) => {
        if (disposed) {
          created.dispose();
          return;
        }
        view = created;
        created.setTurnsEnabled(false);
        setState('ready');
        if (!reduceMotion) turnTimer = setInterval(turn, TURN_INTERVAL_MS);
      })
      .catch(() => {
        if (!disposed) setState('failed');
      });

    return () => {
      disposed = true;
      clearInterval(turnTimer);
      view?.dispose();
      view = null;
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {state !== 'ready' && (
        <div className="absolute inset-0 grid place-items-center">
          <CubeLogo size={96} className={state === 'loading' ? 'animate-pulse' : undefined} />
        </div>
      )}
    </div>
  );
}
