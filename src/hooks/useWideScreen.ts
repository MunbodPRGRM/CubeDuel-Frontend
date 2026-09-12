import { useSyncExternalStore } from 'react';

/** เส้นแบ่งจอกว้าง/แคบ — ต้องเป็นค่าเดียวกับ `lg` ของ Tailwind ที่ทุกหน้าใช้แบ่งอยู่แล้ว */
const WIDE_QUERY = '(min-width: 1024px)';

const list = typeof window.matchMedia === 'function' ? window.matchMedia(WIDE_QUERY) : null;

function subscribe(listener: () => void): () => void {
  list?.addEventListener('change', listener);
  return () => list?.removeEventListener('change', listener);
}

/**
 * จอกว้างระดับ `lg` ขึ้นไปหรือไม่ — **ตามทันทีเมื่อหมุนจอ/ย่อหน้าต่าง**
 *
 * มีไว้ให้ layout `auto` ของหน้าห้องเลือกแบบที่เหมาะกับจอ (ADR-063 ข้อ 3) ซึ่งเป็นการตัดสินใจ
 * ที่ CSS ทำแทนไม่ได้ เพราะ layout สองแบบนั้นต่างกันที่ **โครงของ DOM** (คู่แข่งลอยมุมจอ vs. คอลัมน์)
 * ไม่ใช่แค่คลาส · เบราว์เซอร์ที่ไม่มี `matchMedia` (เทส/สภาพแวดล้อมแปลก ๆ) ถือว่าจอแคบ
 */
export function useWideScreen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => list?.matches ?? false,
    () => false,
  );
}
