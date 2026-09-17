import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { TutorialContext, type TutorialContextValue } from './tutorial-context';
import { TutorialDialog } from './TutorialDialog';
import { hasSeenTutorial, markTutorialSeen, tutorialIdentity } from './tutorial-storage';

/** บัญชีอายุเท่านี้ถือว่า "เพิ่งสมัคร" — เผื่อคนที่สมัครแล้วยังไม่ได้เข้าหน้าแรกทันที (ADR-085 ข้อ 1) */
const NEW_ACCOUNT_WINDOW_MS = 24 * 60 * 60 * 1000;

function isNewAccount(createdAt: string): boolean {
  const created = Date.parse(createdAt);
  // วันที่อ่านไม่ออก = ไม่เด้ง · ข้อความผิดรูปจาก server ต้องไม่ทำให้คู่มือโผล่ให้ทุกคน
  return Number.isFinite(created) && Date.now() - created <= NEW_ACCOUNT_WINDOW_MS;
}

/**
 * ตัวคุมโหมดฝึกสอนการใช้งานทั้งแอป (เฟส 10 ก้อนที่ 2 — ADR-053)
 *
 * อยู่ระดับบนสุดเพราะปุ่ม "?" อยู่บนแถบหัวซึ่งโผล่แทบทุกหน้า และการเปิดคู่มือ
 * ต้องไม่พาผู้ใช้ออกจากหน้าที่ค้างอยู่ (เช่น รออยู่ในคิวจับคู่ — ADR-040 ข้อ 1)
 *
 * กติกาการเด้งเอง (ADR-085 ข้อ 1 · ADR-053 ข้อ 3):
 *   - เด้งให้ **บัญชีที่สมัครมาไม่เกิน 24 ชั่วโมง** (`user.createdAt`) และยังไม่เคยดูบนเครื่องนี้เท่านั้น
 *     ครอบทั้งสมัครด้วยรหัสผ่านและ Google/Facebook โดยไม่ต้องแก้ API · บัญชีเก่าเปิดจากเครื่องใหม่ไม่โดนเด้ง
 *   - เด้งเฉพาะตอนอยู่ **หน้าแรก** ไม่ให้ไปบังกลางแมตช์
 *   - เปิดเองได้ทุกเมื่อจากปุ่ม ? (ADR-053 ข้อ 4)
 */
export function TutorialProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const identity = user ? tutorialIdentity(user.userId) : null;
  const newAccount = user ? isNewAccount(user.createdAt) : false;

  useEffect(() => {
    if (status !== 'ready' || !identity || !newAccount) return;
    if (location.pathname !== '/') return;
    if (hasSeenTutorial(identity)) return;
    setIsOpen(true);
  }, [status, identity, newAccount, location.pathname]);

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
