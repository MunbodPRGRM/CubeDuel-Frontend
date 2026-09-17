import { useSyncExternalStore } from 'react';

/** เส้นแบ่งจอแคบ — ต่ำกว่า `md` ของ Tailwind (48rem = 768px) ตัวเดียวกับที่ `MobileTabBar` ใช้ซ่อน/แสดง */
const NARROW_QUERY = '(max-width: 767.98px)';

const list = typeof window.matchMedia === 'function' ? window.matchMedia(NARROW_QUERY) : null;

function subscribe(listener: () => void): () => void {
  list?.addEventListener('change', listener);
  return () => list?.removeEventListener('change', listener);
}

/**
 * จอแคบกว่า `md` หรือไม่ — **ตามทันทีเมื่อหมุนจอ/ย่อหน้าต่าง** (คู่กับ `useWideScreen` ที่แบ่งที่ `lg`)
 *
 * ใช้เฉพาะหน้าที่จอแคบมี **โครง DOM ต่างจากจอกว้าง** จน CSS สลับเองไม่ได้ (ADR-083 ข้อ 1)
 * — เรนเดอร์ทีละแบบ ไม่ซ่อนด้วย `hidden` สองชุด ไม่งั้น component ที่ยิง API/ฟัง socket ถูก mount ซ้ำ
 * · เบราว์เซอร์ที่ไม่มี `matchMedia` ถือว่าจอกว้าง (หน้าตาเดิมตาม `design/`)
 */
export function useNarrowScreen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => list?.matches ?? false,
    () => false,
  );
}
