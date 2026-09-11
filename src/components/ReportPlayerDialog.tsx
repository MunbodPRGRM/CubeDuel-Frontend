import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

const MIN_REASON = 10;
const MAX_REASON = 1000;

interface ReportPlayerDialogProps {
  reportedUserId: number;
  reportedName: string;
  /** แนบแมตช์ที่เกี่ยวข้อง — **ตั้งได้อย่างมากช่องเดียว** (api-contract.md ข้อ 8) */
  matchId?: number;
  multiplayerMatchId?: number;
  onClose: () => void;
}

/**
 * กล่องแจ้งรายงานผู้เล่น (`POST /reports`)
 *
 * แนบแมตช์มาด้วยเสมอเมื่อเปิดจากผลการแข่งขัน เพราะ server **ปฏิเสธรายงานที่แนบแมตช์ซึ่ง
 * ผู้ถูกรายงานไม่ได้เล่น** (ADR-050 ข้อ 1) และแอดมินจะตรวจอะไรไม่ได้เลยถ้าไม่มีแมตช์ให้ดู
 */
export function ReportPlayerDialog({
  reportedUserId,
  reportedName,
  matchId,
  multiplayerMatchId,
  onClose,
}: ReportPlayerDialogProps) {
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      await apiFetch('/reports', {
        method: 'POST',
        body: { reportedUserId, reason: reason.trim(), matchId, multiplayerMatchId },
      });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err, 'ส่งรายงานไม่สำเร็จ'));
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="รายงานผู้เล่น"
      className="fixed inset-0 z-50 grid place-items-center bg-navy-950/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-line bg-navy-850 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-line px-5 py-4">
          <h2 className="font-semibold text-slate-100">รายงานผู้เล่น</h2>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            ผู้ถูกรายงาน: {reportedName}
            {matchId ? ` · แมตช์ #${matchId}` : ''}
            {multiplayerMatchId ? ` · แมตช์หลายคน #${multiplayerMatchId}` : ''}
          </p>
        </header>

        {sent ? (
          <div className="px-5 py-6 text-center">
            <p className="text-sm text-win">ส่งรายงานเรียบร้อยแล้ว</p>
            <p className="mt-1 text-xs text-slate-500">
              ผู้ดูแลระบบจะตรวจสอบให้ · รายงานคนเดิมซ้ำได้อีกครั้งหลังผ่านไป 24 ชั่วโมง
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 rounded-xl border border-line px-5 py-2.5 text-sm text-slate-300 transition hover:bg-navy-800"
            >
              ปิด
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void submit(e)} className="space-y-3 px-5 py-4">
            <label className="block">
              <span className="text-sm text-slate-300">เกิดอะไรขึ้น</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={5}
                minLength={MIN_REASON}
                maxLength={MAX_REASON}
                required
                placeholder="เล่าให้ละเอียดพอที่ผู้ดูแลจะตรวจสอบได้ เช่น เวลาที่ทำได้ผิดปกติแค่ไหน ในรูบิคประเภทไหน"
                className="mt-1 w-full rounded-xl border border-line bg-navy-950/60 px-4 py-2.5 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand-500"
              />
            </label>
            <p className="text-xs text-slate-500">
              {reason.trim().length} / {MAX_REASON} ตัวอักษร (อย่างน้อย {MIN_REASON})
            </p>

            {error && <p className="text-sm text-loss">{error}</p>}

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-line px-5 py-2.5 text-sm text-slate-300 transition hover:bg-navy-800"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={sending || reason.trim().length < MIN_REASON}
                className="rounded-xl bg-loss px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending ? 'กำลังส่ง…' : 'ส่งรายงาน'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
