import { Avatar } from '@/components/Avatar';
import { useQueue } from '@/socket/useQueue';
import { CUBE_TYPE_LABEL } from '@/types/leaderboard';
import { ReadyCheckCountdown } from './ReadyCheckCountdown';

/**
 * หน้ายืนยันก่อนเข้าห้อง — เด้งทับทุกหน้าเมื่อคิวจับกลุ่มได้ (ADR-077)
 *
 * เหตุผลที่เป็น modal ระดับแอปเหมือน `QueueBanner` ไม่ใช่ของหน้าแรก: ผู้ใช้เข้าคิวแล้ว
 * เดินไปดูอันดับ/ข่าวต่อได้ และ server พาเข้าคิวเองได้ด้วย (`game-rules.md` ข้อ 6)
 * ถ้าหน้ายืนยันอยู่แค่หน้าแรก คนที่อยู่หน้าอื่นจะปล่อยหมดเวลาโดยไม่รู้ตัวทุกครั้ง
 *
 * **ไม่มีปุ่มปิด และกดพื้นหลังไม่ปิด** — ทางออกมีสองทางคือ "เล่นเลย" กับ "ยกเลิก" เท่านั้น
 * (กดพลาดแล้วหลุดออกไป = ถูกนับเป็นปฏิเสธโดยไม่ได้ตั้งใจ)
 */

/** ช่วงยืนยัน 12 วินาทีตาม `game-rules.md` ข้อ 8 — ใช้วาดสัดส่วนวงแหวนเท่านั้น ตัวตัดสินอยู่ที่ server */
const READY_CHECK_SECONDS = 12;

export function ReadyCheckModal() {
  const queue = useQueue();
  const ready = queue.readyCheck;

  if (queue.phase !== 'ready_check' || !ready) return null;

  const multi = queue.kind === 'multiplayer';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="เจอคู่แข่งแล้ว"
      className="fixed inset-0 z-50 grid place-items-center bg-navy-950/85 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl border border-brand-500/40 bg-navy-850 p-6 text-center shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-400">
          {multi ? 'รวมกลุ่มได้แล้ว' : 'เจอคู่แข่งแล้ว'}
        </p>
        <h2 className="mt-1 text-xl font-semibold text-slate-100">พร้อมเริ่มหรือยัง?</h2>
        <p className="mt-1 text-sm text-slate-500">
          {queue.cubeType ? CUBE_TYPE_LABEL[queue.cubeType] : ''}
          {multi ? ` · ${ready.groupSize} คน` : ' · 1 ต่อ 1'}
        </p>

        <div className="mt-5 flex items-center justify-center gap-5">
          <ReadyCheckCountdown
            expiresAtTs={ready.expiresAtTs}
            totalMs={READY_CHECK_SECONDS * 1000}
          />
          <ul className="min-w-0 flex-1 space-y-2 text-left">
            {ready.rivals.map((rival) => (
              <li
                key={rival.userId}
                className="flex items-center gap-3 rounded-xl border border-line bg-navy-800/60 px-3 py-2"
              >
                <Avatar name={rival.nickname ?? rival.username} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-100">
                    {rival.nickname ?? rival.username}
                  </span>
                  {rival.nickname && (
                    <span className="block truncate text-[11px] text-slate-500">
                      @{rival.username}
                    </span>
                  )}
                </span>
                {/* Elo ของประเภทที่กำลังจะแข่ง ไม่ใช่ค่ารวม (Rating แยก 4 แถวต่อคน) */}
                <span className="tabular shrink-0 text-sm font-semibold text-gold-400">
                  {rival.eloRating}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* ห้องหลายคนต้องรู้ว่ารออีกกี่คน — 1v1 มีคนเดียวให้รอ บอกเป็นข้อความตรง ๆ ชัดกว่า */}
        <p className="mt-4 text-sm text-slate-400" role="status">
          {ready.youAccepted
            ? multi
              ? `ยืนยันแล้ว ${ready.acceptedCount}/${ready.groupSize} คน — รออีกฝ่ายอยู่`
              : 'ยืนยันแล้ว — รออีกฝ่ายกดยืนยัน'
            : 'กด “เล่นเลย” เพื่อเริ่ม · ปล่อยจนหมดเวลาถือว่ายกเลิก'}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={queue.busy}
            onClick={() => void queue.decline()}
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-navy-700 disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={queue.busy || ready.youAccepted}
            onClick={() => void queue.accept()}
            className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-400 disabled:opacity-50"
          >
            {ready.youAccepted ? 'รออีกฝ่าย…' : 'เล่นเลย'}
          </button>
        </div>

        <p className="mt-3 text-xs leading-5 text-slate-600">
          ยกเลิกแล้วออกจากคิวทันที กดจับคู่ใหม่ได้เลยโดยไม่มีบทลงโทษ ·
          รอบนี้ยังไม่มีผลต่อคะแนนหรือสถิติ
        </p>
      </div>
    </div>
  );
}
