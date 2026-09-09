import { FormAlert } from '@/components/FormAlert';
import { useQueue } from '@/socket/useQueue';
import { CUBE_TYPE_LABEL } from '@/types/leaderboard';
import { QueueWaitTime } from './QueueWaitTime';

/**
 * แถบสถานะคิวใต้ปุ่ม "จับคู่" ในการ์ดหลักของหน้าแรก
 * (ภาพ `design/HomePage - Matching.png` — บรรทัด "กำลังค้นหาผู้เล่น 7.6 วินาที")
 *
 * ตัวเลขที่ดีไซน์ไม่ได้เผื่อไว้แต่ผู้เล่นต้องเห็น (ช่วง Elo · จำนวนคนในคิว · เวลาที่เหลือ
 * ก่อนหมดคิว) วางเป็นบรรทัดรองด้านล่าง เพราะถ้าไม่บอก การรอ 180 วินาทีจะดูเหมือนจอค้าง
 */

/** หมดเวลารอที่ 180 วิ (`game-rules.md` ข้อ 8) — ใช้บอกผู้ใช้เฉย ๆ ตัวตัดสินจริงอยู่ที่ server */
const QUEUE_TIMEOUT_SECONDS = 180;

export function QueuePanel() {
  const queue = useQueue();

  if (queue.phase === 'timeout') {
    return (
      <div className="mt-5 rounded-xl border border-gold-400/40 bg-gold-400/10 px-4 py-3 text-sm text-gold-400">
        <p className="font-semibold">
          รอครบ {Math.round((queue.timedOutAfterMs ?? 0) / 1000)} วินาทีแล้วยังไม่เจอคู่
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          ตอนนี้ยังไม่มีผู้เล่นคนอื่นรออยู่
          {queue.cubeType ? ` ในประเภท ${CUBE_TYPE_LABEL[queue.cubeType]}` : ''} · กด “จับคู่”
          อีกครั้งเพื่อรอต่อ หรือชวนเพื่อนเล่นในห้องสร้างเองไปก่อน
        </p>
        <button
          type="button"
          onClick={queue.dismiss}
          className="mt-2 text-xs text-slate-400 underline underline-offset-2 transition hover:text-slate-200"
        >
          ปิดข้อความนี้
        </button>
      </div>
    );
  }

  if (queue.phase !== 'queued') {
    return queue.error ? (
      <div className="mt-5">
        <FormAlert message={queue.error} />
      </div>
    ) : null;
  }

  return (
    <div className="mt-5">
      <p className="flex flex-wrap items-center gap-2 text-sm text-brand-400">
        <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-brand-500/30 border-t-brand-400" />
        กำลังค้นหาผู้เล่น
        <QueueWaitTime queuedAtTs={queue.queuedAtTs} className="tabular font-semibold" />
        <span className="text-slate-500">วินาที</span>
      </p>

      <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
        {queue.cubeType && (
          <div className="flex gap-1.5">
            <dt>ประเภท</dt>
            <dd className="text-slate-300">{CUBE_TYPE_LABEL[queue.cubeType]}</dd>
          </div>
        )}
        <div className="flex gap-1.5">
          <dt>ช่วงคะแนนที่รับ</dt>
          <dd className="tabular text-slate-300">
            {queue.eloWindow === null ? 'ไม่จำกัดแล้ว' : `±${queue.eloWindow}`}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt>คนในคิวประเภทนี้</dt>
          <dd className="tabular text-slate-300">{queue.playersInQueue} คน</dd>
        </div>
        <div className="flex gap-1.5">
          <dt>หมดเวลารอที่</dt>
          <dd className="tabular text-slate-300">{QUEUE_TIMEOUT_SECONDS} วินาที</dd>
        </div>
      </dl>

      <p className="mt-2 text-xs leading-5 text-slate-600">
        ยิ่งรอนาน ระบบยิ่งขยายช่วงคะแนนให้กว้างขึ้นเอง · ปิดหน้านี้หรือหลุดการเชื่อมต่อเมื่อไหร่ =
        ออกจากคิวทันที
      </p>
    </div>
  );
}
