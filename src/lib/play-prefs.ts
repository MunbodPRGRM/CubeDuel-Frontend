/**
 * ค่าที่ผู้เล่นตั้งไว้ตอนเล่น — เก็บใน `localStorage` ของ **เครื่องนี้** (ADR-061 ข้อ 6 · ADR-063 ข้อ 2)
 *
 * ⚙️ ไม่ผูกบัญชี ไม่ลง DB: เป็นความชอบของอุปกรณ์ (เมาส์กับจอสัมผัสอาจอยากคนละแบบ ·
 * จอ 27 นิ้วกับมือถืออยากได้ layout คนละแบบ) และไม่มีคอลัมน์ให้เก็บ
 *
 * ทุกคนที่ใช้ `usePlayPrefs()` ได้ค่าใหม่ทันทีที่มีใครเรียก `setPlayPref()` — รวมถึงแท็บอื่น
 * (ผ่าน event `storage`) · อ่าน/เขียนพังได้ (โหมดส่วนตัว/ปิด storage) → ใช้ค่าเริ่มต้น ไม่ล้ม
 */
import { useSyncExternalStore } from 'react';
import type { CameraMode, CubeOrientation } from '@/cube';

const STORAGE_KEY = 'cubeduel.play-prefs.v1';

/**
 * การจัดวางหน้าห้องแข่ง (ADR-063 ข้อ 3)
 *   - `auto` (**ค่าเริ่มต้น**) = จอกว้าง (`lg` ขึ้นไป) ใช้ `classic` · จอแคบใช้ `focus`
 *   - `classic` = สามคอลัมน์ "แบบเดิม" ของก้อนที่ 1 (ADR-059 ข้อ 5)
 *   - `sides` = เราซ้าย คู่แข่งขวา · ข้อมูลคอลัมน์ขวา
 *   - `focus` = คิวบ์เราเต็มพื้นที่ คู่แข่งลอยมุมขวาบน (Picture-in-Picture) · ข้อมูลคอลัมน์ขวา
 *   - `stacked` = เราบน คู่แข่งล่าง ข้อมูลคอลัมน์ขวา — **ห้อง 1v1 เท่านั้น**
 *
 * **ช่องข้อมูลเป็นคอลัมน์เสมอทุกแบบ** (ซ้าย/กลาง/ขวา) ห้ามเป็นแถบบนหรือล่าง — เจ้าของสั่ง 2026-09-12
 */
export type RoomLayout = 'auto' | 'classic' | 'sides' | 'focus' | 'stacked';

/** layout ที่เอาไปวาดได้จริง — `auto` ถูกแปลงเป็นหนึ่งในนี้ตามความกว้างจอก่อน render */
export type ResolvedRoomLayout = Exclude<RoomLayout, 'auto'>;

export interface PlayPrefs {
  /** โหมดหมุนกล้องของคิวบ์ทุกลูกในแอป */
  cameraMode: CameraMode;
  /** หน้า U อยู่บนหรือล่าง — **2x2x2 / 3x3x3 เท่านั้น** (ADR-063 ข้อ 5) */
  cubeOrientation: CubeOrientation;
  /** การจัดวางหน้าห้องแข่ง */
  roomLayout: RoomLayout;
}

const DEFAULTS: PlayPrefs = { cameraMode: 'locked', cubeOrientation: 'top', roomLayout: 'auto' };

const ROOM_LAYOUTS: readonly RoomLayout[] = ['auto', 'classic', 'sides', 'focus', 'stacked'];

/**
 * อ่านแบบไม่เชื่อของในเครื่อง — ค่าที่ไม่รู้จัก (แก้มือ / เวอร์ชันเก่า) ตกกลับไปค่าเริ่มต้น
 * **ทีละคีย์** ไม่ใช่ทิ้งทั้ง object เพราะค่าที่ยังอ่านได้ไม่ควรหายไปด้วย (ADR-063 ข้อ 2)
 */
function read(): PlayPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Record<keyof PlayPrefs, unknown>>;
    return {
      cameraMode: parsed.cameraMode === 'free' ? 'free' : 'locked',
      cubeOrientation: parsed.cubeOrientation === 'bottom' ? 'bottom' : 'top',
      roomLayout: ROOM_LAYOUTS.includes(parsed.roomLayout as RoomLayout)
        ? (parsed.roomLayout as RoomLayout)
        : 'auto',
    };
  } catch {
    return DEFAULTS;
  }
}

let current = read();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

// แท็บอื่นเปลี่ยนค่า → แท็บนี้ตามทันที (event นี้ไม่ยิงในแท็บที่เป็นคนเขียนเอง)
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return;
  current = read();
  notify();
});

export function setPlayPref<K extends keyof PlayPrefs>(key: K, value: PlayPrefs[K]): void {
  if (current[key] === value) return;
  current = { ...current, [key]: value };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // เก็บลงเครื่องไม่ได้ก็ยังใช้ได้จนปิดหน้า — ไม่ใช่เรื่องที่ต้องขึ้นให้ผู้ใช้เห็น
  }
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** ค่าปัจจุบัน — re-render เองเมื่อมีการเปลี่ยน */
export function usePlayPrefs(): PlayPrefs {
  return useSyncExternalStore(subscribe, () => current);
}
