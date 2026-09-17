/**
 * ปกข่าว 5 แบบที่เว็บวาดให้ (ADR-084) — แทนการอัปโหลดรูปของเดิม
 *
 * ⚠️ รายการคีย์ต้องตรงกับ `NEWS_COVERS` ใน `backend/src/constants.ts` (ADR-021 — ไม่มีอะไรเตือนถ้าลืม)
 * เพิ่มปกใหม่ = เพิ่มคีย์ทั้งสองฝั่ง + ใส่หน้าตาที่นี่ (`Record` ทำให้ TypeScript ฟ้องถ้าลืม) · ไม่ต้อง migrate
 */

export const NEWS_COVERS = ['general', 'update', 'maintenance', 'penalty', 'event'] as const;
export type NewsCover = (typeof NEWS_COVERS)[number];

export interface NewsCoverStyle {
  /** ป้ายบนปก + คำอ่านของ screen reader */
  label: string;
  /** ใช้ตอนแอดมินเลือกปก — บอกว่าปกนี้เหมาะกับข่าวแบบไหน */
  hint: string;
  /**
   * คลาสของพื้นไล่สี + สีไอคอน/ป้าย — **ต้องเป็นสตริงเต็ม** ไม่ต่อสตริงเอง
   * ไม่งั้น Tailwind สแกนไม่เจอคลาสแล้วไม่สร้าง CSS ให้
   */
  surface: string;
  ink: string;
  /** `d` ของ `<path>` ในกรอบ 24×24 แบบเส้น (หน้าตาเดียวกับไอคอนของ `MobileTabBar`) */
  icon: string[];
}

export const NEWS_COVER_STYLES: Record<NewsCover, NewsCoverStyle> = {
  general: {
    label: 'ประกาศ',
    hint: 'เรื่องทั่วไป',
    surface: 'bg-gradient-to-br from-slate-400/20 via-navy-850 to-navy-900',
    ink: 'text-slate-300',
    icon: ['M3 11l18-5v12L3 14z', 'M11.6 16.8a3 3 0 1 1-5.8-1.6'],
  },
  update: {
    label: 'อัปเดต',
    hint: 'บอกว่าอัปเดตอะไรมาบ้าง',
    surface: 'bg-gradient-to-br from-brand-500/35 via-navy-850 to-navy-900',
    ink: 'text-brand-300',
    icon: [
      'M12 15l-3-3a18 18 0 0 1 2.5-4.5A11 11 0 0 1 21 3c0 2.7-.8 7-5.5 10.5A18 18 0 0 1 12 15z',
      'M9 12H5l2.5-3.5H11',
      'M12 15v4l3.5-2.5V13',
      'M6 16c-1.5.8-2 3-2 4 1 0 3.2-.5 4-2',
    ],
  },
  maintenance: {
    label: 'ปรับปรุงระบบ',
    hint: 'ปิดปรับปรุงเซิร์ฟเวอร์',
    surface: 'bg-gradient-to-br from-gold-400/30 via-navy-850 to-navy-900',
    ink: 'text-gold-400',
    icon: [
      'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.4-3.4a6 6 0 0 1-7.9 7.9l-6.5 6.5a2.1 2.1 0 0 1-3-3l6.5-6.5a6 6 0 0 1 7.9-7.9z',
    ],
  },
  penalty: {
    label: 'ลงโทษผู้เล่น',
    hint: 'ประกาศแบน / ลงโทษผู้เล่น',
    surface: 'bg-gradient-to-br from-loss/30 via-navy-850 to-navy-900',
    ink: 'text-loss',
    icon: [
      'M12 21s7.5-3.5 7.5-9.5V5.5L12 3 4.5 5.5v6C4.5 17.5 12 21 12 21z',
      'M9.5 9.5l5 5',
      'M14.5 9.5l-5 5',
    ],
  },
  event: {
    label: 'กิจกรรม',
    hint: 'กิจกรรม / การแข่งพิเศษ',
    surface: 'bg-gradient-to-br from-win/25 via-navy-850 to-navy-900',
    ink: 'text-win',
    icon: [
      'M8 21h8',
      'M12 17v4',
      'M7 4h10v5a5 5 0 0 1-10 0z',
      'M7 6H4a3 3 0 0 0 3 4',
      'M17 6h3a3 3 0 0 1-3 4',
    ],
  },
};

/** คีย์ที่ frontend ไม่รู้จัก (backend ออกรุ่นใหม่ก่อน) → วาดเป็น `general` ห้ามพัง (ADR-084 ข้อ 3) */
export function newsCoverStyle(cover: string): NewsCoverStyle {
  return (NEWS_COVERS as readonly string[]).includes(cover)
    ? NEWS_COVER_STYLES[cover as NewsCover]
    : NEWS_COVER_STYLES.general;
}
