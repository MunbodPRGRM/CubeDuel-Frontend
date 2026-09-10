import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApiData } from '@/hooks/useApiData';
import { formatEloChange, formatSolveTime } from '@/lib/format';
import { CUBE_TYPE_LABEL } from '@/types/leaderboard';
import type { MatchDetail, MultiplayerMatchDetail } from '@/types/match';
import type { SolveStatus } from '@/socket/types';

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
 * เนื้อในแยกเป็น component ของตัวเองไว้แล้ว ถ้าเฟส 8 ทำ "แชร์ผลการแข่งขัน" ที่ต้องมี URL
 * ของตัวเอง ให้ยก `<MatchDetailBody>` ไปวางบนหน้าเต็มได้เลย
 */
export function MatchDetailDialog({ kind, id, highlightUserId, onClose }: MatchDetailDialogProps) {
  const duel = useApiData<MatchDetail>(kind === '1v1' ? `/matches/${id}` : null);
  const multi = useApiData<MultiplayerMatchDetail>(
    kind === 'multiplayer' ? `/multiplayer-matches/${id}` : null,
  );

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
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-2.5 py-1 text-sm text-slate-400 transition hover:bg-navy-800 hover:text-slate-200"
          >
            ปิด
          </button>
        </header>

        {loading && <p className="px-5 py-10 text-center text-sm text-slate-500">กำลังโหลด…</p>}
        {error && <p className="px-5 py-10 text-center text-sm text-loss">{error}</p>}

        {duel.data && <MatchDetailBody detail={duel.data} highlightUserId={highlightUserId} />}
        {multi.data && <MatchDetailBody detail={multi.data} highlightUserId={highlightUserId} />}
      </div>
    </div>
  );
}

/** ผู้เล่นหนึ่งคนในผลแมตช์ — รูปเหมือนกันทั้งสองระบบ ต่างแค่ 1v1 มี `seatNo` ที่ไม่ได้ใช้ตรงนี้ */
interface DetailPlayer {
  userId: number;
  username: string;
  nickname: string | null;
  rankNo: number;
  solveTime: number | null;
  result: SolveStatus;
  moveCount: number;
  eloBefore: number | null;
  eloAfter: number | null;
  eloChange: number | null;
}

function MatchDetailBody({
  detail,
  highlightUserId,
}: {
  detail: MatchDetail | MultiplayerMatchDetail;
  highlightUserId: number;
}) {
  const players: DetailPlayer[] = detail.players;
  const roomLabel =
    'roomType' in detail
      ? detail.roomType === 'competitive'
        ? 'ห้องแข่งขัน'
        : 'ห้องสร้างเอง'
      : detail.roomMode === 'auto'
        ? 'ห้องหลายคน (จับคู่อัตโนมัติ)'
        : 'ห้องหลายคน (สร้างเอง)';

  return (
    <div className="px-5 py-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Field label="ประเภท" value={CUBE_TYPE_LABEL[detail.cubeType]} />
        <Field label="ห้อง" value={roomLabel} />
        <Field label="เริ่มเมื่อ" value={formatDateTime(detail.startedAt)} />
        <Field
          label="คะแนน"
          value={detail.ratingApplied ? 'ปรับ ELO' : 'ไม่ปรับ ELO'}
          muted={!detail.ratingApplied}
        />
      </dl>

      <p className="mt-4 text-xs text-slate-500">สูตรกวน</p>
      <p className="tabular mt-1 break-words rounded-xl border border-line bg-navy-900/60 px-3 py-2 text-xs leading-6 text-slate-300">
        {detail.scramble}
      </p>

      <ul className="mt-4 space-y-2">
        {players.map((player) => {
          const isSelf = player.userId === highlightUserId;
          return (
            <li
              key={player.userId}
              className={`rounded-xl border px-4 py-3 ${
                isSelf ? 'border-brand-500/50 bg-brand-500/10' : 'border-line bg-navy-800/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`tabular w-7 shrink-0 text-sm font-semibold ${
                    player.rankNo === 1 && player.result === 'solved'
                      ? 'text-gold-400'
                      : 'text-slate-500'
                  }`}
                >
                  #{player.rankNo}
                </span>
                <Link
                  to={`/users/${player.userId}`}
                  className="min-w-0 flex-1 truncate text-sm font-medium text-slate-200 transition hover:text-white"
                >
                  {player.nickname || player.username}
                </Link>
                <span className="tabular shrink-0 text-sm font-semibold text-slate-100">
                  {player.result === 'solved'
                    ? formatSolveTime(player.solveTime)
                    : SOLVE_LABEL[player.result]}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-3 pl-10 text-xs text-slate-500">
                <span className="tabular">{player.moveCount} mv</span>
                {player.eloBefore !== null && player.eloAfter !== null && (
                  <span className="tabular">
                    {player.eloBefore} → <span className="text-slate-300">{player.eloAfter}</span>
                  </span>
                )}
                {player.eloChange !== null && (
                  <span
                    className={`tabular font-medium ${
                      player.eloChange > 0
                        ? 'text-win'
                        : player.eloChange < 0
                          ? 'text-loss'
                          : 'text-slate-400'
                    }`}
                  >
                    {formatEloChange(player.eloChange)}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const SOLVE_LABEL: Record<SolveStatus, string> = {
  solving: 'ยังไม่จบ',
  solved: 'แก้สำเร็จ',
  dnf: 'DNF',
  surrendered: 'ยอมแพ้',
};

function Field({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-0.5 ${muted ? 'text-slate-500' : 'text-slate-200'}`}>{value}</dd>
    </div>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
