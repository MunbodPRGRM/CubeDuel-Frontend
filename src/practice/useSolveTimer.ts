import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * นาฬิกาจับเวลาของ **ห้องฝึกซ้อม** (ทำงานฝั่ง client ล้วน ไม่มี Socket.IO — game-rules.md ข้อ 12)
 *
 * ⚠️ ห้องแข่งขันในเฟส 4 **ห้ามใช้ตัวนี้ตัดสินผล** — เวลาที่นับจริงต้องมาจาก server เท่านั้น
 * (game-rules.md ข้อ 3) ตัวนี้มีไว้ให้เลขบนจอเดินลื่น ๆ เฉย ๆ
 */

export type TimerPhase = 'idle' | 'inspection' | 'solving' | 'finished';

/** 15 วินาทีตามกติกา — ห้องฝึกซ้อมเปิด/ปิดเองได้ แต่ถ้าเปิดต้องเท่าห้องแข่ง */
export const INSPECTION_SECONDS = 15;

export interface SolveTimer {
  phase: TimerPhase;
  /** วินาทีที่เหลือของ inspection (ปัดขึ้น) — ใช้ตอน `phase === 'inspection'` */
  inspectionLeft: number;
  /** เวลาที่ใช้ หน่วยวินาที ทศนิยม 2 ตำแหน่ง · `null` = DNF — ใช้ตอน `phase === 'finished'` */
  resultSeconds: number | null;
  /** เวลาเริ่มจับ (`performance.now()`) — ให้หน้าจอเอาไปนับเองแบบลื่น ๆ */
  startedAt: number | null;
  start: () => void;
  /**
   * ข้าม inspection แล้วเริ่มจับเวลาทันที — **ห้องฝึกซ้อมเท่านั้น** (ADR-032 ข้อ 3)
   *
   * เรียกจาก move แรกที่ผู้เล่นหมุนระหว่าง inspection · เรียกตอน phase อื่นไม่มีผล
   */
  skipInspection: () => void;
  /** แก้เสร็จแล้ว — คืนเวลาที่ได้ (วินาที) */
  finish: () => number | null;
  /** ยอมแพ้/ยกเลิกกลางคัน → DNF */
  abort: () => void;
  reset: () => void;
}

/** ปัดลง 2 ตำแหน่งตามธรรมเนียม speedcubing (game-rules.md ข้อ 3) */
export function toSolveSeconds(ms: number): number {
  return Math.floor(ms / 10) / 100;
}

export function useSolveTimer(inspectionEnabled: boolean): SolveTimer {
  const [phase, setPhase] = useState<TimerPhase>('idle');
  const [inspectionLeft, setInspectionLeft] = useState(INSPECTION_SECONDS);
  const [resultSeconds, setResultSeconds] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const inspectionEndsAt = useRef<number | null>(null);

  const beginSolving = useCallback(() => {
    inspectionEndsAt.current = null;
    setStartedAt(performance.now());
    setPhase('solving');
  }, []);

  // นับถอยหลัง inspection — หมดเวลาแล้ว **เข้าสู่การจับเวลาอัตโนมัติ** กดข้ามไม่ได้ (ADR-005)
  useEffect(() => {
    if (phase !== 'inspection') return;
    const id = window.setInterval(() => {
      const endsAt = inspectionEndsAt.current;
      if (endsAt === null) return;
      const left = Math.max(0, endsAt - performance.now());
      setInspectionLeft(Math.ceil(left / 1000));
      if (left <= 0) beginSolving();
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, beginSolving]);

  const start = useCallback(() => {
    setResultSeconds(null);
    if (inspectionEnabled) {
      inspectionEndsAt.current = performance.now() + INSPECTION_SECONDS * 1000;
      setInspectionLeft(INSPECTION_SECONDS);
      setStartedAt(null);
      setPhase('inspection');
    } else {
      beginSolving();
    }
  }, [inspectionEnabled, beginSolving]);

  /**
   * ⚠️ **ห้ามเรียกจากห้องแข่งขัน / หลายคน / สร้างเอง ในเฟส 4** — ห้องที่มีการแข่งขัน
   * ข้าม inspection ไม่ได้เด็ดขาด (ADR-005 · game-rules.md ข้อ 2) และ server ต้องตอบ
   * `E_MOVE_DURING_INSPECTION` ให้ move ที่มาช่วงนั้นเหมือนเดิม
   *
   * ที่ยอมให้ข้ามได้เฉพาะห้องฝึกซ้อม เพราะข้อห้ามนั้นมาจาก "ทุกคนใน race ต้องเริ่ม
   * จับเวลาที่จุดเดียวกัน" ซึ่งห้องฝึกซ้อมไม่มีเงื่อนไขนั้นเลย (ADR-032 ข้อ 3)
   *
   * **move ที่ทำให้ข้ามต้องถูกนับเป็น move แรกของรอบ ไม่ใช่ทิ้ง** — ฝั่งที่เรียกเป็นคนนับ
   */
  const skipInspection = useCallback(() => {
    if (phase !== 'inspection') return;
    beginSolving();
  }, [phase, beginSolving]);

  const finish = useCallback((): number | null => {
    if (startedAt === null) return null;
    const seconds = toSolveSeconds(performance.now() - startedAt);
    setResultSeconds(seconds);
    setPhase('finished');
    return seconds;
  }, [startedAt]);

  const abort = useCallback(() => {
    inspectionEndsAt.current = null;
    setResultSeconds(null);
    setPhase('finished');
  }, []);

  const reset = useCallback(() => {
    inspectionEndsAt.current = null;
    setStartedAt(null);
    setResultSeconds(null);
    setInspectionLeft(INSPECTION_SECONDS);
    setPhase('idle');
  }, []);

  return {
    phase,
    inspectionLeft,
    resultSeconds,
    startedAt,
    start,
    skipInspection,
    finish,
    abort,
    reset,
  };
}
