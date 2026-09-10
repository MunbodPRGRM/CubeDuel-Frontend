import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { TutorialContext, type TutorialContextValue } from './tutorial-context';
import { TutorialDialog } from './TutorialDialog';
import { hasSeenTutorial, markTutorialSeen, tutorialIdentity } from './tutorial-storage';

/**
 * ตัวคุมโหมดฝึกสอนการใช้งานทั้งแอป (เฟส 10 ก้อนที่ 2 — ADR-053)
 *
 * อยู่ระดับบนสุดเพราะปุ่ม "?" อยู่บนแถบหัวซึ่งโผล่แทบทุกหน้า และการเปิดคู่มือ
 * ต้องไม่พาผู้ใช้ออกจากหน้าที่ค้างอยู่ (เช่น รออยู่ในคิวจับคู่ — ADR-040 ข้อ 1)
 *
 * กติกาการเด้งเอง (ADR-053 ข้อ 2–3):
 *   - เด้งให้ **ผู้ใช้ที่ล็อกอินแล้ว** และยังไม่เคยดูเท่านั้น — คนที่ยังไม่ล็อกอินไม่เด้ง
 *     เพราะเนื้อหาเกือบทั้งหมด (คิว/คะแนน/สถิติ) ต้องมีบัญชีถึงจะทำได้ และหน้าแรกของแขก
 *     ก็ชี้ไปที่ปุ่มสมัครสมาชิกอยู่แล้ว · แขกเปิดเองได้จากปุ่ม ?
 *   - เด้งเฉพาะตอนอยู่ **หน้าแรก** ไม่ให้ไปบังกลางแมตช์
 */
export function TutorialProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const identity = user ? tutorialIdentity(user.userId) : null;

  useEffect(() => {
    if (status !== 'ready' || !identity) return;
    if (location.pathname !== '/') return;
    if (hasSeenTutorial(identity)) return;
    setIsOpen(true);
  }, [status, identity, location.pathname]);

  const open = useCallback(() => setIsOpen(true), []);

  /**
   * ปิดยังไงก็นับว่า "ดูแล้ว" ทั้งนั้น (กดข้าม / กดปิด / กดจนจบ)
   * — ถ้านับเฉพาะตอนกดจนจบ คนที่ตั้งใจข้ามจะโดนเด้งซ้ำทุกครั้งที่กลับหน้าแรก
   * กลับมาเปิดใหม่ได้เสมอจากปุ่ม ? จึงไม่มีใครเสียโอกาสอ่าน
   */
  const close = useCallback(() => {
    if (identity) markTutorialSeen(identity);
    setIsOpen(false);
  }, [identity]);

  const value = useMemo<TutorialContextValue>(() => ({ open, isOpen }), [open, isOpen]);

  return (
    <TutorialContext.Provider value={value}>
      {children}
      {isOpen && <TutorialDialog onClose={close} />}
    </TutorialContext.Provider>
  );
}
