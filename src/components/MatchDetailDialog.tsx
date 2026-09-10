import { useEffect } from 'react';
import { useApiData } from '@/hooks/useApiData';
import type { MatchDetail, MultiplayerMatchDetail } from '@/types/match';
import { MatchDetailBody } from './MatchDetailBody';
import { ShareButton } from './ShareButton';

interface MatchDetailDialogProps {
  /** ตัวเลือก endpoint — เลข id ของสองตารางชนกันได้ ห้ามเดาเอง (ADR-044 ข้อ 1) */
  kind: '1v1' | 'multiplayer';
  id: number;
  /** ไฮไลต์แถวของเจ้าของประวัติที่กำลังเปิดดูอยู่ */
  highlightUserId: number;
  onClose: () => void;
}

/**
 * ผลเต็มของแมตช์เก่าหนึ่งแมตช์ — เปิดจากรายการประวัติ (ADR-047 ข้อ 6 ว่าทำไมเป็น modal ไม่ใช่หน้าแยก)
 *
 * เนื้อใน (`<MatchDetailBody>`) ใช้ร่วมกับหน้าเต็ม `/matches/:id` ที่เฟส 8 เพิ่มเข้ามาเพื่อให้
 * "แชร์ผลการแข่งขัน" มีลิงก์ให้แชร์จริง ๆ (ADR-048 ข้อ 4) — modal จึงมีปุ่มแชร์กับปุ่มเปิดหน้าเต็มด้วย
 */
export function MatchDetailDialog({ kind, id, highlightUserId, onClose }: MatchDetailDialogProps) {
  const duel = useApiData<MatchDetail>(kind === '1v1' ? `/matches/${id}` : null);
  const multi = useApiData<MultiplayerMatchDetail>(
    kind === 'multiplayer' ? `/multiplayer-matches/${id}` : null,
  );

  const sharePath = kind === '1v1' ? `/matches/${id}` : `/multiplayer-matches/${id}`;
  const loading = duel.loading || multi.loading;
  const error = duel.error ?? multi.error;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ผลการแข่งขัน"
      className="fixed inset-0 z-50 grid place-items-center bg-navy-950/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-navy-850 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-100">ผลการแข่งขัน</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {kind === '1v1' ? 'ห้อง 1 ต่อ 1' : 'ห้องผู้เล่นหลายคน'} · #{id}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ShareButton
              path={sharePath}
              title="ผลการแข่งขัน CubeDuel"
              className="rounded-lg border border-line px-2.5 py-1 text-sm text-slate-400 transition hover:bg-navy-800 hover:text-slate-200"
            />
            <a
              href={sharePath}
              className="rounded-lg border border-line px-2.5 py-1 text-sm text-slate-400 transition hover:bg-navy-800 hover:text-slate-200"
            >
              เปิดหน้าเต็ม
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-line px-2.5 py-1 text-sm text-slate-400 transition hover:bg-navy-800 hover:text-slate-200"
            >
              ปิด
            </button>
          </div>
        </header>

        {loading && <p className="px-5 py-10 text-center text-sm text-slate-500">กำลังโหลด…</p>}
        {error && <p className="px-5 py-10 text-center text-sm text-loss">{error}</p>}

        {duel.data && <MatchDetailBody detail={duel.data} highlightUserId={highlightUserId} />}
        {multi.data && <MatchDetailBody detail={multi.data} highlightUserId={highlightUserId} />}
      </div>
    </div>
  );
}
