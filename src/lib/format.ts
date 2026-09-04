/**
 * รูปแบบตัวเลขบนหน้าจอ — ให้ตรงกับดีไซน์ในโฟลเดอร์ `ตัวอย่างเว็บไซต์/`
 * API ส่งเวลาเป็น "วินาที ทศนิยม 2 ตำแหน่ง" (api-contract.md ข้อ 1) · `null` = DNF
 */

/** 74.21 → "1:14.21" · 9.87 → "0:09.87" · null → "—" */
export function formatSolveTime(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest.toFixed(2).padStart(5, '0')}`;
}

/** 0.6423 → "64%" */
export function formatWinRate(rate: number | null | undefined): string {
  if (rate == null) return '—';
  return `${Math.round(rate * 100)}%`;
}

/** +24 / -11 พร้อมเครื่องหมายเสมอ */
export function formatEloChange(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}
