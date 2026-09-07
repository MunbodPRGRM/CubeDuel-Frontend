import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createCubeView, type CubeMoveEvent, type CubeState, type CubeView } from '@/cube';
import type { CubeType } from '@/types/cube';

export interface CubeCanvasHandle {
  /** กลับไปสถานะทันทีหลัง scramble ล่าสุด */
  reset(): void;
  /** เล่นอนิเมชันแก้คิวบ์ให้เสร็จ — resolve เมื่ออนิเมชันจบ */
  solve(): Promise<void>;
  /**
   * หมุนตามคำสั่ง (นับเป็น move ของ **โปรแกรม** ไม่ใช่ของผู้เล่น)
   *
   * ใช้สะท้อนคิวบ์ของคู่แข่งจาก `opponent:move` ในห้องแข่ง (เฟส 4) — คืน `false`
   * เมื่อ move นั้นใช้กับประเภทนี้ไม่ได้ ผู้เรียกจะได้รู้ว่าภาพหลุดจากของจริงแล้ว
   */
  applyMove(move: string): boolean;
  /**
   * สถานะคิวบ์ ณ วินาทีที่ถาม — `null` เมื่อยังสร้าง view ไม่เสร็จ หรือถูกทิ้งไปแล้ว
   *
   * มีไว้ให้ตรวจ "ผ่านกติกาแก้เสร็จหรือยัง" **หลังอนิเมชันเล่นจบ** ซึ่งเป็นเงื่อนไข
   * ของการหยุดเวลาตอนกดปุ่ม "เสร็จทันที" (game-rules.md ข้อ 12.2 · ADR-032 ข้อ 2)
   */
  getState(): CubeState | null;
}

interface CubeCanvasProps {
  cubeType: CubeType;
  /** `null` = ยังไม่ได้ scramble (แสดงคิวบ์ที่แก้เสร็จแล้ว) */
  scramble: string | null;
  /**
   * เปิด/ปิดการหมุนหน้าคิวบ์ของผู้เล่น — **กล้องยังหมุนได้เสมอ**
   *
   * ห้องที่มีการแข่งขันต้องปิดตอน inspection (game-rules.md ข้อ 2) ส่วนห้องฝึกซ้อม
   * เปิดไว้ได้ เพราะหมุนหน้าคิวบ์ช่วง inspection = ข้ามเข้าจับเวลา (ADR-032 ข้อ 3)
   */
  turnsEnabled: boolean;
  /**
   * หมุน scramble ให้ดูทีละท่าแทนที่จะใส่ให้ทันที — **ห้องฝึกซ้อมเท่านั้น** (ADR-032 ข้อ 1)
   * ค่าเริ่มต้นคือพฤติกรรมของห้องแข่ง (ใส่ทันที) ห้ามกลับด้าน
   */
  animateScramble?: boolean;
  /**
   * แจ้งตอนอนิเมชัน scramble เริ่ม/จบ — ระหว่างที่เป็น `true` ผู้เล่นหมุนคิวบ์ไม่ได้
   * และฝั่งเรียกต้อง disable ปุ่มทั้งแผงไว้ ไม่งั้นจะกดเริ่มจับเวลาทับอนิเมชันได้
   */
  onScrambleAnimatingChange?: (animating: boolean) => void;
  onState?: (state: CubeState) => void;
  /** ทีละ move ตอนหมุน — เฟส 4 เอาไปยิง `solve:move` ต่อ */
  onMove?: (event: CubeMoveEvent) => void;
  /**
   * scramble ที่ส่งมาถูกใส่ลงคิวบ์เรียบร้อยแล้ว (โมเดล 3D พร้อมด้วย)
   *
   * นี่คือจังหวะที่ห้องแข่งส่ง `solve:ready` ได้ — ก่อนหน้านี้คิวบ์ยังไม่ใช่ลูกเดียวกับที่
   * server สั่งมา (game-rules.md ข้อ 1: `LOADING` = โหลดโมเดล + apply scramble เสร็จ)
   */
  onScrambleApplied?: (scramble: string | null) => void;
}

/**
 * กล่องคิวบ์ 3 มิติ — ห่อ `CubeView` (โลกนอก React) ให้ใช้แบบ React ได้
 *
 * ตัว view สร้างใหม่เฉพาะตอน **เปลี่ยนประเภทรูบิค** เท่านั้น ไม่ใช่ทุกครั้งที่ re-render
 * (สร้างใหม่ = โหลด KPuzzle + สร้าง WebGL context ใหม่ ซึ่งแพงมาก)
 */
export const CubeCanvas = forwardRef<CubeCanvasHandle, CubeCanvasProps>(function CubeCanvas(
  {
    cubeType,
    scramble,
    turnsEnabled,
    animateScramble = false,
    onScrambleAnimatingChange,
    onState,
    onMove,
    onScrambleApplied,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<CubeView | null>(null);
  const [view, setView] = useState<CubeView | null>(null);
  const [error, setError] = useState<string | null>(null);

  // callback ล่าสุดโดยไม่ต้องสร้าง view ใหม่ตอน parent re-render
  const onStateRef = useRef(onState);
  onStateRef.current = onState;
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const animateScrambleRef = useRef(animateScramble);
  animateScrambleRef.current = animateScramble;
  const onAnimatingRef = useRef(onScrambleAnimatingChange);
  onAnimatingRef.current = onScrambleAnimatingChange;
  const onScrambleAppliedRef = useRef(onScrambleApplied);
  onScrambleAppliedRef.current = onScrambleApplied;
  /** ลำดับของอนิเมชัน scramble ล่าสุด — ตัวที่ตกรุ่นห้ามแจ้งว่า "จบแล้ว" ทับตัวใหม่ */
  const scrambleRunRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    setError(null);

    void createCubeView(cubeType, container)
      .then((created) => {
        // React StrictMode เรียก effect สองรอบตอน dev — รอบแรกถูกยกเลิกไปแล้ว ต้องทิ้งของที่เพิ่งสร้าง
        if (disposed) {
          created.dispose();
          return;
        }
        viewRef.current = created;
        created.subscribe((state) => onStateRef.current?.(state));
        created.subscribeMoves((event) => onMoveRef.current?.(event));
        // ตอน dev เรียกจากคอนโซลได้ เช่น `__cubeView.applyMove('U')` — ใช้ทดสอบมือ ไม่ติดไปกับ build จริง
        if (import.meta.env.DEV)
          (window as unknown as { __cubeView?: CubeView }).__cubeView = created;
        setView(created);
      })
      .catch((err: unknown) => {
        if (!disposed) setError(err instanceof Error ? err.message : 'สร้างคิวบ์ 3 มิติไม่สำเร็จ');
      });

    return () => {
      disposed = true;
      viewRef.current?.dispose();
      viewRef.current = null;
      setView(null);
      // ทิ้ง view ทั้งตัวระหว่างอนิเมชันค้างอยู่ → ต้องปลดล็อกฝั่งเรียก ไม่งั้นปุ่มค้าง disabled
      scrambleRunRef.current += 1;
      onAnimatingRef.current?.(false);
    };
  }, [cubeType]);

  useEffect(() => {
    if (!view) return;
    // `scramble === null` = ยังไม่มี scramble → `''` พาคิวบ์กลับไปครบทุกหน้าแบบไม่มีอนิเมชัน
    // (ห้องฝึกซ้อมเข้าหน้ามาต้องเจอลูกที่แก้เสร็จ — game-rules.md ข้อ 12.1)
    const animate = animateScrambleRef.current && scramble !== null;
    const run = ++scrambleRunRef.current;

    // scramble ที่ใช้กับประเภทนี้ไม่ได้ต้องไม่ทำให้ทั้งหน้าจอตาย — `setScramble` โยน error
    // แบบ synchronous ถ้า move ใช้ไม่ได้ ซึ่งใน effect แปลว่า React ถอด tree ทิ้งทั้งก้อน
    try {
      const done = view.setScramble(scramble ?? '', { animate });
      setError(null);
      if (!animate) {
        // ทางของห้องแข่ง: `setScramble` ใส่สถานะให้เสร็จแบบ synchronous ไปแล้ว
        onScrambleAppliedRef.current?.(scramble);
        return;
      }
      onAnimatingRef.current?.(true);
      void done.finally(() => {
        if (scrambleRunRef.current !== run) return;
        onAnimatingRef.current?.(false);
        onScrambleAppliedRef.current?.(scramble);
      });
    } catch (err) {
      onAnimatingRef.current?.(false);
      setError(err instanceof Error ? err.message : 'ตั้ง scramble ไม่สำเร็จ');
    }
  }, [view, scramble]);

  useEffect(() => {
    view?.setTurnsEnabled(turnsEnabled);
  }, [view, turnsEnabled]);

  useImperativeHandle(
    ref,
    () => ({
      reset: () => void viewRef.current?.reset(),
      solve: () => viewRef.current?.solve() ?? Promise.resolve(),
      applyMove: (move: string) => {
        const view = viewRef.current;
        if (!view) return false;
        try {
          void view.applyMove(move);
          return true;
        } catch {
          // move ที่ใช้กับประเภทนี้ไม่ได้ — ทิ้งไปดีกว่าปล่อยให้ error ทะลุขึ้นไปถอด tree ทิ้ง
          return false;
        }
      },
      getState: () => viewRef.current?.getState() ?? null,
    }),
    [],
  );

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {!view && !error && (
        <div className="absolute inset-0 grid place-items-center text-sm text-slate-500">
          กำลังโหลดคิวบ์…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-loss">
          {error}
        </div>
      )}
    </div>
  );
});
