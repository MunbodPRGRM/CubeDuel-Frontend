/**
 * ค่าที่ผู้เล่นตั้งไว้ตอนเล่น — เก็บใน `localStorage` ของ **เครื่องนี้** (ADR-061 ข้อ 6)
 *
 * ⚙️ ไม่ผูกบัญชี ไม่ลง DB: เป็นความชอบของอุปกรณ์ (เมาส์กับจอสัมผัสอาจอยากคนละแบบ)
 * และไม่มีคอลัมน์ให้เก็บ · เป็น object เดียวเพราะก้อนที่ 6 ของเฟส 12 จะเติม
 * center บน/ล่าง กับ layout เข้ามาอีก
 *
 * ทุกคนที่ใช้ `usePlayPrefs()` ได้ค่าใหม่ทันทีที่มีใครเรียก `setPlayPref()` — รวมถึงแท็บอื่น
 * (ผ่าน event `storage`) · อ่าน/เขียนพังได้ (โหมดส่วนตัว/ปิด storage) → ใช้ค่าเริ่มต้น ไม่ล้ม
 */
import { useSyncExternalStore } from 'react';
import type { CameraMode } from '@/cube';

const STORAGE_KEY = 'cubeduel.play-prefs.v1';

export interface PlayPrefs {
  /** โหมดหมุนกล้องของคิวบ์ทุกลูกในแอป */
  cameraMode: CameraMode;
}

const DEFAULTS: PlayPrefs = { cameraMode: 'locked' };

/** อ่านแบบไม่เชื่อของในเครื่อง — ค่าที่ไม่รู้จัก (แก้มือ / เวอร์ชันเก่า) ตกกลับไปค่าเริ่มต้น */
function read(): PlayPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Record<keyof PlayPrefs, unknown>>;
    return { cameraMode: parsed.cameraMode === 'free' ? 'free' : 'locked' };
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
