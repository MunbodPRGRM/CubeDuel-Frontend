import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createCubeView, type CubeMoveEvent, type CubeState, type CubeView } from '@/cube';
import type { CubeType } from '@/types/cube';

export interface CubeCanvasHandle {
  /** กลับไปสถานะทันทีหลัง scramble ล่าสุด */
  reset(): void;
}

interface CubeCanvasProps {
  cubeType: CubeType;
  /** `null` = ยังไม่ได้ scramble (แสดงคิวบ์ที่แก้เสร็จแล้ว) */
  scramble: string | null;
  /** ปิดตอน inspection — กล้องยังหมุนได้ แต่หมุนหน้าคิวบ์ไม่ได้ (game-rules.md ข้อ 2) */
  turnsEnabled: boolean;
  onState?: (state: CubeState) => void;
  /** ทีละ move ตอนหมุน — เฟส 4 เอาไปยิง `solve:move` ต่อ */
  onMove?: (event: CubeMoveEvent) => void;
}

/**
 * กล่องคิวบ์ 3 มิติ — ห่อ `CubeView` (โลกนอก React) ให้ใช้แบบ React ได้
 *
 * ตัว view สร้างใหม่เฉพาะตอน **เปลี่ยนประเภทรูบิค** เท่านั้น ไม่ใช่ทุกครั้งที่ re-render
 * (สร้างใหม่ = โหลด KPuzzle + สร้าง WebGL context ใหม่ ซึ่งแพงมาก)
 */
export const CubeCanvas = forwardRef<CubeCanvasHandle, CubeCanvasProps>(function CubeCanvas(
  { cubeType, scramble, turnsEnabled, onState, onMove },
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
    };
  }, [cubeType]);

  useEffect(() => {
    if (view) void view.setScramble(scramble ?? '');
  }, [view, scramble]);

  useEffect(() => {
    view?.setTurnsEnabled(turnsEnabled);
  }, [view, turnsEnabled]);

  useImperativeHandle(ref, () => ({ reset: () => void viewRef.current?.reset() }), []);

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
