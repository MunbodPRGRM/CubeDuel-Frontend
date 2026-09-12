import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/auth/useAuth';
import type { CameraPose } from '@/cube';
import { hasSeenTutorial, markTutorialSeen, practiceTutorialIdentity } from './tutorial-storage';

/** ท่าที่ต้องทำให้ได้หนึ่งอย่างต่อหนึ่งขั้น (ADR-065 ข้อ 3) */
export type CoachSignal = 'orbit' | 'turn' | 'zoom' | 'timer';

export interface CoachStep {
  signal: CoachSignal;
  title: string;
  /** สิ่งที่ต้องทำ — เขียนเป็นคำสั่งตรง ๆ ทั้งเมาส์และจอสัมผัส */
  body: string;
  /** ป้ายสั้นในรายการเช็กลิสต์ */
  label: string;
}

/**
 * 4 ขั้นตามที่ roadmap กำหนด (เฟส 12 ก้อนที่ 8) เรียงจากท่าที่ปลอดภัยที่สุดไปหาท่าที่มีผลจริง
 * — หมุนดูก่อน แล้วค่อยบิด แล้วค่อยจับเวลา
 */
export const COACH_STEPS: readonly CoachStep[] = [
  {
    signal: 'orbit',
    label: 'หมุนมุมมอง',
    title: 'ลองหมุนดูรอบ ๆ ก่อน',
    body: 'ลากที่ **พื้นที่ว่างรอบคิวบ์** (หรือใช้นิ้วลากบนจอสัมผัส) เพื่อหมุนมุมกล้อง — คิวบ์ยังไม่ถูกบิด มองได้ทุกด้าน',
  },
  {
    signal: 'turn',
    label: 'บิดหน้าคิวบ์',
    title: 'บิดหน้าคิวบ์',
    body: 'ลากที่ **ตัวคิวบ์** ไปตามแนวที่อยากหมุน — ชั้นนั้นจะหมุนตามนิ้ว ปล่อยแล้วดีดเข้าที่เอง',
  },
  {
    signal: 'zoom',
    label: 'ซูมเข้า-ออก',
    title: 'ซูมเข้า-ออก',
    body: 'หมุนล้อเมาส์ หรือใช้ **สองนิ้วบีบ/ถ่าง** บนจอสัมผัส เพื่อให้คิวบ์ใหญ่หรือเล็กลงตามถนัด',
  },
  {
    signal: 'timer',
    label: 'จับเวลา',
    title: 'เริ่มจับเวลา',
    body: 'กดปุ่ม "สุ่ม scramble" แล้วกด **เว้นวรรค** หรือปุ่มเริ่มจับเวลา — แก้ครบทุกหน้าเมื่อไหร่ นาฬิกาหยุดให้เอง',
  },
];

/** มุมระหว่างควอเทอร์เนียนสองตัว (เรเดียน) — ใช้แยก "หมุนกล้อง" ออกจาก "ซูม" */
function angleBetween(a: CameraPose['quaternion'], b: CameraPose['quaternion']): number {
  const dot = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  return 2 * Math.acos(Math.min(1, dot));
}

/** ขยับน้อยกว่านี้ถือว่าเป็นการสั่นของ damping ไม่ใช่ความตั้งใจ */
const ROTATE_EPSILON = 0.02;
const ZOOM_EPSILON = 0.05;

export interface PracticeCoach {
  /** กำลังสอนอยู่หรือไม่ */
  active: boolean;
  /** ขั้นที่กำลังสอน — `null` ตอนไม่ได้สอน หรือตอนทำครบทุกขั้นแล้ว */
  step: CoachStep | null;
  /** ทำท่าไหนสำเร็จไปแล้วบ้าง (ใช้ทำเช็กลิสต์) */
  done: ReadonlySet<CoachSignal>;
  /** ทำครบทุกขั้นแล้ว รอผู้ใช้กดปิด */
  finished: boolean;
  /** เปิดเอง (ปุ่ม "Tutorial") — เริ่มนับใหม่ตั้งแต่ขั้นแรกเสมอ */
  start: () => void;
  /** ปิด/ข้าม — นับว่า "ดูแล้ว" ทุกกรณี (ADR-065 ข้อ 6) */
  dismiss: () => void;
  /** แจ้งว่าผู้ใช้ทำท่านี้ได้แล้ว */
  report: (signal: CoachSignal) => void;
  /** แจ้งท่ากล้องล่าสุด — แยกเองว่าเป็นการหมุนหรือการซูม */
  reportCamera: (pose: CameraPose) => void;
}

/**
 * ตัวคุมโหมดสอนเล่นในห้องฝึกซ้อม (ADR-065) — **เก็บแต่ตรรกะ ไม่มี JSX**
 *
 * เด้งเองครั้งแรกที่เข้าห้องฝึกซ้อม แล้วรอจนผู้ใช้ทำแต่ละท่าได้จริงถึงจะไปขั้นต่อไป
 * · สัญญาณทั้งหมดมาจากของที่หน้าห้องฝึกซ้อมรับอยู่แล้ว — ไม่มีอะไรใน `src/cube/` ต้องแก้
 */
export function usePracticeCoach(): PracticeCoach {
  const { user } = useAuth();
  const [active, setActive] = useState(false);
  const [done, setDone] = useState<ReadonlySet<CoachSignal>>(new Set());
  /** ท่ากล้องของเฟรมก่อน — เทียบเพื่อดูว่าผู้ใช้หมุนหรือซูม */
  const lastPose = useRef<CameraPose | null>(null);

  const identity = user ? practiceTutorialIdentity(user.userId) : null;

  // เข้าห้องครั้งแรกของบัญชีนี้บนเครื่องนี้ = เริ่มสอนเอง · เคยดูแล้วเงียบไว้
  useEffect(() => {
    if (!identity || hasSeenTutorial(identity)) return;
    setActive(true);
    setDone(new Set());
  }, [identity]);

  const start = useCallback(() => {
    lastPose.current = null;
    setDone(new Set());
    setActive(true);
  }, []);

  const dismiss = useCallback(() => {
    if (identity) markTutorialSeen(identity);
    setActive(false);
  }, [identity]);

  const report = useCallback((signal: CoachSignal) => {
    // นอกช่วงสอนก็ไม่ต้องจำอะไร — เปิดใหม่ทีหลังต้องเริ่มนับจากศูนย์ (ข้อ 4 ว่าด้วยข้ามลำดับ
    // หมายถึงข้ามภายในรอบเดียวกัน ไม่ใช่จำข้ามรอบ)
    setDone((current) => {
      if (current.has(signal)) return current;
      const next = new Set(current);
      next.add(signal);
      return next;
    });
  }, []);

  const reportCamera = useCallback(
    (pose: CameraPose) => {
      const previous = lastPose.current;
      lastPose.current = pose;
      if (!previous) return;

      // ลากทีเดียวได้ทั้งสองอย่างในโหมดอิสระ — ให้ผ่านทั้งคู่ ดีกว่าบังคับให้ทำซ้ำ (ADR-065 ข้อ 3)
      if (Math.abs(pose.distance - previous.distance) > ZOOM_EPSILON) report('zoom');
      if (angleBetween(pose.quaternion, previous.quaternion) > ROTATE_EPSILON) report('orbit');
    },
    [report],
  );

  const step = useMemo(
    () => (active ? (COACH_STEPS.find((entry) => !done.has(entry.signal)) ?? null) : null),
    [active, done],
  );

  // ทำครบแล้ว = จบคอร์ส · นับว่าดูแล้วทันที (การ์ดยังค้างให้กดปิดเอง)
  const finished = active && step === null;
  useEffect(() => {
    if (finished && identity) markTutorialSeen(identity);
  }, [finished, identity]);

  // ผู้เรียกเอา object นี้ไปใส่ dependency ของ `useCallback` — ต้องนิ่งเท่าที่สถานะยังไม่เปลี่ยน
  return useMemo(
    () => ({ active, step, done, finished, start, dismiss, report, reportCamera }),
    [active, step, done, finished, start, dismiss, report, reportCamera],
  );
}
