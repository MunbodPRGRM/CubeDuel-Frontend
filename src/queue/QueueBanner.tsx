import { Link, useLocation } from 'react-router-dom';
import { useQueue } from '@/socket/useQueue';
import { CUBE_TYPE_LABEL } from '@/types/leaderboard';
import { QueueWaitTime } from './QueueWaitTime';

/**
 * แถบลอยบอกว่า "ยังอยู่ในคิวอยู่นะ" สำหรับหน้าที่ไม่ใช่หน้าแรก
 *
 * จำเป็นเพราะมีทางที่ **server พาเข้าคิวเองโดยที่ผู้ใช้ไม่ได้กด** — ห้องแข่งขันที่ยุบ
 * ก่อนเริ่มจับเวลาจะส่งคนที่ยังต่ออยู่กลับเข้าคิวให้ (`game-rules.md` ข้อ 6 · ADR-039 ข้อ 6)
 * ตอนนั้นผู้ใช้ยังค้างอยู่ที่หน้าห้อง ถ้าไม่มีแถบนี้เขาจะไม่รู้เลยว่ากำลังรอคู่ใหม่อยู่
 *
 * หน้าแรกไม่แสดง เพราะการ์ดหลักของหน้านั้นบอกสถานะละเอียดกว่าอยู่แล้ว (`QueuePanel`)
 */
export function QueueBanner() {
  const queue = useQueue();
  const { pathname } = useLocation();

  if (queue.phase !== 'queued' || pathname === '/') return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4"
      // ให้คลิกทะลุไปโดนของข้างหลังได้ ยกเว้นตัวการ์ดเอง
      style={{ pointerEvents: 'none' }}
    >
      <div
        style={{ pointerEvents: 'auto' }}
        className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-brand-500/40 bg-navy-850/95 px-4 py-2.5 text-sm shadow-lg shadow-navy-950/40 backdrop-blur"
      >
        <span className="flex items-center gap-2 text-brand-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500/30 border-t-brand-400" />
          กำลังหาคู่แข่ง
          {queue.cubeType && (
            <span className="text-slate-400">({CUBE_TYPE_LABEL[queue.cubeType]})</span>
          )}
        </span>
        <span className="tabular text-slate-300">
          <QueueWaitTime queuedAtTs={queue.queuedAtTs} /> วินาที
        </span>
        <Link
          to="/"
          className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-200"
        >
          ดูรายละเอียด
        </Link>
        <button
          type="button"
          disabled={queue.busy}
          onClick={() => void queue.leave()}
          className="rounded-lg border border-line px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-navy-700 disabled:opacity-50"
        >
          ยกเลิก
        </button>
      </div>
    </div>
  );
}
