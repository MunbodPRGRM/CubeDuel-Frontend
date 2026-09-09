import { useEffect, useRef } from 'react';
import { useSocket } from '@/socket/useSocket';

/**
 * ตัวเลข "รอมาแล้วกี่วินาที" ที่เดินเอง — `7.6` ตามภาพ `design/HomePage - Matching.png`
 *
 * เขียนลง DOM ผ่าน ref + `requestAnimationFrame` ด้วยเหตุผลเดียวกับ `room/LiveTime`
 * (ADR-037 ข้อ 6) และใช้ `clock.now()` เพราะ `queuedAtTs` เป็นเวลาของ **server**
 */
export function QueueWaitTime({
  queuedAtTs,
  className,
}: {
  queuedAtTs: number | null;
  className?: string;
}) {
  const { clock } = useSocket();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (queuedAtTs === null) {
      node.textContent = '0.0';
      return;
    }

    let frame = 0;
    const tick = () => {
      const waitedMs = Math.max(0, clock.now() - queuedAtTs);
      node.textContent = (waitedMs / 1000).toFixed(1);
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [queuedAtTs, clock]);

  return <span ref={ref} className={className} />;
}
