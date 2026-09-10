import { createContext } from 'react';

export interface TutorialContextValue {
  /** เปิดคู่มือด้วยตัวเอง (ปุ่ม ? บนแถบบน) — เปิดได้เสมอ ไม่สนว่าเคยดูจบไปแล้วหรือยัง */
  open: () => void;
  /** กำลังเปิดอยู่หรือไม่ — ใช้ทำสถานะ active ของปุ่ม */
  isOpen: boolean;
}

export const TutorialContext = createContext<TutorialContextValue | null>(null);
