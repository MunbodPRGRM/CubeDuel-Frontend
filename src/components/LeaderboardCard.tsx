import { Link } from 'react-router-dom';
import { Avatar } from './Avatar';
import { useApiData } from '@/hooks/useApiData';
import { CUBE_TYPE_LABEL, type LeaderboardRow } from '@/types/leaderboard';
import type { CubeType } from '@/types/cube';

interface LeaderboardCardProps {
  cubeType: CubeType;
  limit?: number;
  /** ลิงก์ "ดูทั้งหมด" มุมขวาบน — ไปหน้ากระดานอันดับเต็มของประเภทที่กำลังดูอยู่ */
  showViewAll?: boolean;
}

/** การ์ด "กระดานอันดับ" — ใช้ทั้งบนหน้า login/register และหน้าแรก */
export function LeaderboardCard({ cubeType, limit = 5, showViewAll }: LeaderboardCardProps) {
  const { data, loading, error } = useApiData<LeaderboardRow[]>(
    `/leaderboard?cubeType=${encodeURIComponent(cubeType)}&limit=${limit}`,
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-navy-850/80">
      <header className="flex items-start justify-between px-5 py-4">
        <div>
          <h2 className="font-semibold text-slate-100">กระดานอันดับ</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            ผู้เล่น {limit} อันดับแรก · {CUBE_TYPE_LABEL[cubeType]}
          </p>
        </div>
        {showViewAll && (
          <Link
            to={`/leaderboard?cubeType=${encodeURIComponent(cubeType)}`}
            className="text-xs text-brand-400 transition hover:text-brand-300"
          >
            ดูทั้งหมด →
          </Link>
        )}
      </header>

      {loading && <SkeletonRows count={limit} />}

      {error && <p className="px-5 pb-5 text-xs text-loss">{error}</p>}

      {data && data.length === 0 && (
        <p className="px-5 pb-5 text-xs text-slate-500">ยังไม่มีผู้เล่นบนกระดานอันดับ</p>
      )}

      {data && data.length > 0 && (
        <ul>
          {data.map((row) => (
            <li
              key={row.userId}
              className="flex items-center gap-3 border-t border-line-soft px-5 py-1.5 odd:bg-navy-800/40"
            >
              <span
                className={`tabular w-8 text-sm font-medium ${
                  row.rank === 1 ? 'text-gold-400' : 'text-slate-400'
                }`}
              >
                #{row.rank}
              </span>
              <Avatar name={row.nickname || row.username} size="sm" highlight={row.rank === 1} />
              <Link
                to={`/users/${row.userId}`}
                className="min-w-0 flex-1 truncate text-sm font-medium text-slate-200 transition hover:text-white"
              >
                {row.nickname || row.username}
              </Link>
              <span className="text-right">
                <span className="tabular block text-[13px] font-semibold leading-tight text-brand-400">
                  {row.eloRating}
                </span>
                <span className="tabular block text-[10px] leading-tight text-slate-500">
                  {row.matchesPlayed === 0 ? 'ยังไม่ลงแข่ง' : `${row.wins}W ${row.losses}L`}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <ul>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex items-center gap-3 border-t border-line-soft px-5 py-2.5">
          <span className="h-3 w-6 animate-pulse rounded bg-navy-700" />
          <span className="h-6 w-6 animate-pulse rounded-full bg-navy-700" />
          <span className="h-3 flex-1 animate-pulse rounded bg-navy-700" />
        </li>
      ))}
    </ul>
  );
}
