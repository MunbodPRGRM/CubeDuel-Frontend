import { useState } from 'react';
import { useSocket } from '@/socket/useSocket';
import { OnlineUsersPanel } from './OnlineUsersPanel';

/**
 * ป้าย "● N ออนไลน์" บนแถบบนสุด — กดแล้วเปิดรายชื่อ (ADR-086 ข้อ 4)
 *
 * ตัวเลขมาจาก `presence:count` ที่ `SocketProvider` เก็บไว้ · ยังไม่ได้ต่อ socket (รวมถึงยังไม่ล็อกอิน)
 * = **ไม่แสดงป้ายเลย** แทนที่จะโชว์ตัวเลขที่อาจค้าง
 * จอแคบเหลือแค่ "● N" เพราะแถบบนมีที่น้อย — คำว่า "ออนไลน์" อยู่ใน `aria-label` และหัวแผง
 */
export function OnlineBadge() {
  const { onlineCount } = useSocket();
  const [open, setOpen] = useState(false);

  if (onlineCount === null) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`สมาชิกออนไลน์ ${onlineCount} คน — ดูรายชื่อ`}
        title="ดูว่าใครออนไลน์อยู่"
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line bg-navy-850 px-3 text-xs text-slate-300 transition hover:text-slate-100"
      >
        <span aria-hidden className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-win opacity-60 motion-safe:animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-win" />
        </span>
        <span className="tabular font-semibold text-slate-100">{onlineCount}</span>
        <span className="hidden sm:inline">ออนไลน์</span>
      </button>
      {open && <OnlineUsersPanel onClose={() => setOpen(false)} />}
    </>
  );
}
