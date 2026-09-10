import { Link } from 'react-router-dom';
import { formatEloChange, formatSolveTime } from '@/lib/format';
import { CUBE_TYPE_LABEL } from '@/types/leaderboard';
import type { MatchDetail, MultiplayerMatchDetail } from '@/types/match';
import type { SolveStatus } from '@/socket/types';

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

export function MatchDetailBody({
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

export function Field({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
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
