import { useEffect, useRef } from 'react';
import { useSocket } from '@/socket/useSocket';

/**
 * วงแหวนนับถอยหลังของหน้ายืนยัน + ตัวเลขวินาทีตรงกลาง
 *
 * `expiresAtTs` เป็นเวลาของ **นาฬิกา server** (ADR-077) จึงต้องอ่านผ่าน `clock.now()`
 * เขียนลง DOM ผ่าน ref + `requestAnimationFrame` ด้วยเหตุผลเดียวกับ `QueueWaitTime`
 * (ADR-037 ข้อ 6 — ไม่ setState ทุกเฟรม ไม่งั้นทั้งแอป re-render 60 ครั้งต่อวินาที)
 *
 * ตัวตัดสินจริงว่าหมดเวลาแล้วคือ server — ตัวนี้แค่วาดให้ดู ถ้านับถึง 0 ก่อน server
 * ก็แค่ค้างที่ 0 รอ `queue:status` ใบใหม่มาปิดหน้านี้เอง
 */

/** รัศมีของวงกลมใน viewBox 0 0 100 100 (เผื่อความหนาเส้น 8 ไว้แล้ว) */
const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ReadyCheckCountdown({
  expiresAtTs,
  totalMs,
}: {
  expiresAtTs: number;
  /** ความยาวเต็มของช่วงยืนยัน ใช้คำนวณสัดส่วนวงแหวน */
  totalMs: number;
}) {
  const { clock } = useSocket();
  const textRef = useRef<SVGTextElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const leftMs = Math.max(0, expiresAtTs - clock.now());
      if (textRef.current) textRef.current.textContent = String(Math.ceil(leftMs / 1000));
      if (ringRef.current) {
        const ratio = totalMs > 0 ? Math.min(1, leftMs / totalMs) : 0;
        ringRef.current.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - ratio));
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [expiresAtTs, totalMs, clock]);

  return (
    <svg viewBox="0 0 100 100" className="h-24 w-24 shrink-0" aria-hidden>
      <circle cx="50" cy="50" r={RADIUS} fill="none" strokeWidth="8" className="stroke-navy-700" />
      <circle
        ref={ringRef}
        cx="50"
        cy="50"
        r={RADIUS}
        fill="none"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        // เริ่มที่เต็มวง แล้วให้ rAF เป็นคนขยับ — ไม่ใส่ transition เพราะวาดทุกเฟรมอยู่แล้ว
        strokeDashoffset={0}
        transform="rotate(-90 50 50)"
        className="stroke-brand-400"
      />
      <text
        ref={textRef}
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        className="tabular fill-slate-100 text-[30px] font-semibold"
      />
    </svg>
  );
}
