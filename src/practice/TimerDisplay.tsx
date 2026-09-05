import { useEffect, useRef } from 'react';
import { formatSolveTime } from '@/lib/format';
import { toSolveSeconds, type TimerPhase } from './useSolveTimer';

interface TimerDisplayProps {
  phase: TimerPhase;
  startedAt: number | null;
  resultSeconds: number | null;
  inspectionLeft: number;
}

/**
 * ตัวเลขเวลาบนหน้าจอ
 *
 * เขียนค่าลง DOM ตรง ๆ ผ่าน ref แทนการ `setState` ทุกเฟรม — ถ้า re-render ทั้งหน้า 60 ครั้ง/วินาที
 * ขณะที่ WebGL ก็วาดคิวบ์อยู่ด้วย เฟรมจะตกทันที (roadmap เฟส 3 ต้องได้ 60 fps บนมือถือ)
 */
export function TimerDisplay({
  phase,
  startedAt,
  resultSeconds,
  inspectionLeft,
}: TimerDisplayProps) {
  const valueRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const node = valueRef.current;
    if (!node) return;

    if (phase === 'solving' && startedAt !== null) {
      let frame = 0;
      const tick = () => {
        node.textContent = formatSolveTime(toSolveSeconds(performance.now() - startedAt));
        frame = requestAnimationFrame(tick);
      };
      tick();
      return () => cancelAnimationFrame(frame);
    }

    if (phase === 'inspection') node.textContent = String(inspectionLeft);
    else if (phase === 'finished')
      node.textContent = resultSeconds === null ? 'DNF' : formatSolveTime(resultSeconds);
    else node.textContent = formatSolveTime(0);
    return;
  }, [phase, startedAt, resultSeconds, inspectionLeft]);

  const label =
    phase === 'inspection'
      ? 'เวลาตรวจสอบ (วินาที)'
      : phase === 'finished'
        ? 'เวลาที่ทำได้'
        : 'เวลา';

  return (
    <div className="text-center">
      <p className="text-xs tracking-wide text-slate-400">{label}</p>
      <p
        ref={valueRef}
        className={`tabular text-5xl font-bold ${
          phase === 'inspection'
            ? 'text-gold-400'
            : phase === 'finished' && resultSeconds === null
              ? 'text-loss'
              : 'text-white'
        }`}
      >
        {formatSolveTime(0)}
      </p>
    </div>
  );
}
