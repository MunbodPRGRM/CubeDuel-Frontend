import { useState } from 'react';
import { useApiPage } from '@/hooks/useApiPage';
import { formatEloChange, formatSolveTime } from '@/lib/format';
import { matchRefOf, type MatchHistoryRow } from '@/types/stats';
import type { CubeType } from '@/types/cube';
import { MatchDetailDialog } from './MatchDetailDialog';
import { Pagination } from './Pagination';

interface MatchHistoryListProps {
  userId: number;
  /** ไม่ใส่ = ทุกประเภทรูบิค */
  cubeType?: CubeType;
  limit?: number;
  /** ปิดแถบเปลี่ยนหน้า — ใช้ตอนเอาไปวางเป็นการ์ด "5 รอบล่าสุด" บนหน้าแรก */
  paginated?: boolean;
  /** ข้อความตอนยังไม่มีประวัติ */
  emptyHint?: string;
}

/**
 * รายการประวัติการแข่ง — **1v1 กับห้องหลายคนอยู่รายการเดียวกัน** เรียงใหม่ไปเก่า
 * (`GET /users/:userId/matches` รวมสองตารางมาให้แล้ว — ADR-045 ข้อ 1)
 *
 * กดแถวไหนก็เปิดผลเต็มของแมตช์นั้นเป็น modal โดยเลือก endpoint จาก `kind` ของแถว
 * **ห้ามเดาจากอย่างอื่น** เพราะเลข id ของสองตารางชนกันได้ (ADR-044 ข้อ 1 · ADR-047 ข้อ 6)
 */
export function MatchHistoryList({
  userId,
  cubeType,
  limit = 20,
  paginated = true,
  emptyHint,
}: MatchHistoryListProps) {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<{ kind: '1v1' | 'multiplayer'; id: number } | null>(null);

  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (cubeType) query.set('cubeType', cubeType);

  const history = useApiPage<MatchHistoryRow>(`/users/${userId}/matches?${query.toString()}`);
  const rows = history.data ?? [];

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-navy-850/80">
      <header className="flex items-baseline justify-between gap-3 px-5 py-4">
        <h2 className="font-semibold text-slate-100">ประวัติการเล่น</h2>
        {history.meta && history.meta.total > 0 && (
          <p className="tabular text-xs text-slate-500">{history.meta.total} แมตช์</p>
        )}
      </header>

      {history.error && <p className="px-5 pb-5 text-xs text-loss">{history.error}</p>}

      {history.loading && rows.length === 0 && <SkeletonRows count={5} />}

      {!history.loading && rows.length === 0 && !history.error && (
        <div className="border-t border-line-soft px-5 py-10 text-center">
          <p className="text-sm text-slate-500">ยังไม่มีประวัติการเล่น</p>
          {emptyHint && <p className="mt-1 text-xs text-slate-600">{emptyHint}</p>}
        </div>
      )}

      {rows.length > 0 && (
        <ul className={history.loading ? 'opacity-50 transition-opacity' : undefined}>
          {rows.map((row) => (
            <HistoryRow
              key={`${row.kind}-${row.kind === '1v1' ? row.matchId : row.multiplayerMatchId}`}
              row={row}
              onOpen={() => setOpen(matchRefOf(row))}
            />
          ))}
        </ul>
      )}

      {paginated && history.meta && (
        <Pagination
          page={history.meta.page}
          totalPages={history.meta.totalPages}
          total={history.meta.total}
          unitLabel="แมตช์"
          disabled={history.loading}
          onChange={setPage}
        />
      )}

      {open && (
        <MatchDetailDialog
          kind={open.kind}
          id={open.id}
          highlightUserId={userId}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}

function HistoryRow({ row, onOpen }: { row: MatchHistoryRow; onOpen: () => void }) {
  const outcome = OUTCOME[row.result];

  return (
    <li className="border-t border-line-soft">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition hover:bg-navy-800/60"
      >
        <span
          className={`grid h-6 w-7 shrink-0 place-items-center rounded-md border text-[11px] font-bold ${outcome.badge}`}
          title={outcome.label}
        >
          {outcome.short}
        </span>

        <span className="min-w-0 flex-1 truncate text-sm text-slate-300">
          {row.kind === '1v1' ? (
            <>vs {row.opponent.nickname || row.opponent.username}</>
          ) : (
            <>
              ห้อง {row.playerCount} คน · อันดับ {row.rankNo}
            </>
          )}
          {/* ห้องที่ไม่ปรับคะแนนต้องมองออกทันที ไม่งั้นจะงงว่าทำไมบางแถวไม่มีแต้ม */}
          {row.eloChange === null && (
            <span className="ml-2 rounded bg-navy-800 px-1.5 py-0.5 text-[10px] text-slate-500">
              ไม่ปรับคะแนน
            </span>
          )}
        </span>

        {/* ไอคอนคิวบ์ในดีไซน์ = ดูสูตรกวนของรอบนั้น (hover แล้วเห็นเต็ม ๆ) */}
        <span
          className="hidden shrink-0 text-slate-500 sm:block"
          title={`สูตรกวน: ${row.scramble}`}
          aria-label={`สูตรกวน ${row.scramble}`}
        >
          <ScrambleIcon />
        </span>

        <span className="tabular w-20 shrink-0 text-right text-sm font-medium text-slate-200">
          {formatSolveTime(row.myTime)}
        </span>
        <span className="tabular hidden w-16 shrink-0 text-right text-xs text-slate-500 sm:block">
          {row.moveCount === null ? '—' : `${row.moveCount} mv`}
        </span>
        <span
          className={`tabular w-12 shrink-0 text-right text-sm ${
            row.eloChange === null
              ? 'text-slate-600'
              : row.eloChange > 0
                ? 'text-win'
                : row.eloChange < 0
                  ? 'text-loss'
                  : 'text-slate-400'
          }`}
        >
          {row.eloChange === null ? '—' : formatEloChange(row.eloChange)}
        </span>
      </button>
    </li>
  );
}

const OUTCOME = {
  win: { short: 'W', label: 'ชนะ', badge: 'border-win/40 bg-win/15 text-win' },
  loss: { short: 'L', label: 'แพ้', badge: 'border-loss/40 bg-loss/15 text-loss' },
  draw: { short: 'D', label: 'เสมอ', badge: 'border-line bg-navy-800 text-slate-400' },
} as const;

function ScrambleIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <rect x="2.5" y="2.5" width="15" height="15" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M7.5 2.5v15M12.5 2.5v15M2.5 7.5h15M2.5 12.5h15"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <ul>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex items-center gap-3 border-t border-line-soft px-5 py-3">
          <span className="h-5 w-7 animate-pulse rounded bg-navy-700" />
          <span className="h-3 flex-1 animate-pulse rounded bg-navy-700" />
          <span className="h-3 w-16 animate-pulse rounded bg-navy-700" />
        </li>
      ))}
    </ul>
  );
}
