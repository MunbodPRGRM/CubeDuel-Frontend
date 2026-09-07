import { useEffect, useRef } from 'react';
import { formatSolveTime, toSolveSeconds } from '@/lib/format';
import { useSocket } from '@/socket/useSocket';

/**
 * ตัวเลขเวลาที่เดินเองบนหน้าจอห้องแข่ง
 *
 * สองเรื่องที่ต้องทำให้ถูก:
 *
 * 1. **ใช้ `clock.now()` ไม่ใช่ `Date.now()`** — server ส่งมาแต่ "เวลาสิ้นสุด/เวลาเริ่ม" ของ
 *    นาฬิกาตัวเอง (socket-events.md ข้อ 6) เครื่องที่ตั้งเวลาเพี้ยนจะนับผิดทันทีถ้าลบตรง ๆ
 * 2. **เขียนลง DOM ผ่าน ref ไม่ใช่ `setState` ทุกเฟรม** — หน้านี้มี WebGL สองตัววาดอยู่
 *    ถ้า re-render ทั้งหน้า 60 ครั้ง/วินาทีเฟรมจะตก (เหตุผลเดียวกับ `practice/TimerDisplay`)
 *
 * ⚠️ เลขที่เห็นตรงนี้เป็นแค่ภาพ — เวลาที่ตัดสินผลจริงมาจาก server เสมอ (game-rules.md ข้อ 3)
 * พอรอบจบจึงต้องสลับมาโหมด `frozen` ด้วยค่าที่ server ส่งมา ห้ามใช้ค่าที่นับเองบนจอ
 */

export type LiveTimeMode =
  /** นับถอยหลังเป็น "วินาทีเต็ม" ถึง `ts` (countdown 3-2-1 · inspection 15 วิ) */
  | 'countdown'
  /** นับขึ้นจาก `ts` (= `serverStartTs`) */
  | 'elapsed'
  /** ค่าที่ล็อกแล้ว — `frozenMs === null` คือ DNF */
  | 'frozen'
  /** ยังไม่เริ่มอะไร */
  | 'idle';

interface LiveTimeProps {
  mode: LiveTimeMode;
  /** เวลาของ **server**: ปลายทางของ `countdown` หรือจุดเริ่มของ `elapsed` */
  ts?: number | null;
  frozenMs?: number | null;
  className?: string;
}

export function LiveTime({ mode, ts = null, frozenMs = null, className }: LiveTimeProps) {
  const { clock } = useSocket();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (mode === 'frozen') {
      node.textContent = frozenMs === null ? 'DNF' : formatSolveTime(toSolveSeconds(frozenMs));
      return;
    }
    if (mode === 'idle' || ts === null) {
      node.textContent = mode === 'countdown' ? '—' : formatSolveTime(0);
      return;
    }

    let frame = 0;
    const tick = () => {
      node.textContent =
        mode === 'countdown'
          ? String(Math.ceil(clock.remainingMs(ts) / 1000))
          : formatSolveTime(toSolveSeconds(Math.max(0, clock.now() - ts)));
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [mode, ts, frozenMs, clock]);

  return <span ref={ref} className={className} />;
}
