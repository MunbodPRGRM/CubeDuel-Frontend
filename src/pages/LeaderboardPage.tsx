import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/Avatar';
import { CubeTypePicker } from '@/components/CubeTypePicker';
import { CubeTypeSelect } from '@/components/CubeTypeSelect';
import { ErrorNotice } from '@/components/ErrorScreen';
import { Pagination } from '@/components/Pagination';
import { useApiData } from '@/hooks/useApiData';
import { useApiPage } from '@/hooks/useApiPage';
import { useNarrowScreen } from '@/hooks/useNarrowScreen';
import { formatEloChange, formatSolveTime, formatWinRate } from '@/lib/format';
import { isCubeType, type CubeType } from '@/types/cube';
import {
  type AnyLeaderboardRow,
  type LeaderboardMeta,
  type LeaderboardScope,
  type LeaderboardSort,
  type UserRating,
} from '@/types/leaderboard';

const PAGE_SIZE = 25;

/**
 * หน้ากระดานจัดอันดับ (`design/Leaderborad.png`)
 *
 * ต่างจากภาพดีไซน์ 3 จุด ตามที่ตัดสินไว้ใน **ADR-047**:
 *   ข้อ 2 — ไม่มีคอลัมน์ "เวลาเฉลี่ย (5)/(10)" เพราะ ao ของทุกคนบนกระดานต้องอ่านประวัติทั้งเส้น
 *           ของทุกคน (หน้าละ 50 คน) ทั้งที่กระดานปกติอ่านจากตาราง `Rating` ตารางเดียวจบ
 *   ข้อ 3 — ช่องค้นหากรองเฉพาะแถวใน**หน้านี้** (API ไม่มีพารามิเตอร์ค้นหา) จึงเขียนกำกับไว้ให้ตรง
 *   ข้อ 4 — แถวของตัวเองปักท้ายตารางได้เฉพาะ `scope=all` + เรียงตาม Elo
 *
 * ที่ดีไซน์ไม่ได้เผื่อไว้แต่ต้องมี: ตัวเลือก**ประเภทรูบิค** (คะแนนแยก 4 ประเภท — ADR-024)
 * กับตัวสลับ **ทั้งหมด / สัปดาห์นี้** ซึ่งเป็นฟีเจอร์ในเล่ม (`game-rules.md` ข้อ 14)
 */
export default function LeaderboardPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();

  const cubeType: CubeType = isCubeType(params.get('cubeType'))
    ? (params.get('cubeType') as CubeType)
    : '3x3x3';
  const scope: LeaderboardScope = params.get('scope') === 'weekly' ? 'weekly' : 'all';
  const sortBy: LeaderboardSort = params.get('sortBy') === 'bestTime' ? 'bestTime' : 'elo';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [search, setSearch] = useState('');
  const narrow = useNarrowScreen();

  /** เก็บตัวเลือกไว้ใน URL — แชร์ลิงก์กระดานของประเภท/สัปดาห์ที่กำลังดูอยู่ได้ */
  function update(
    next: Partial<{ cubeType: CubeType; scope: string; sortBy: string; page: number }>,
  ) {
    const merged = { cubeType, scope, sortBy, page, ...next };
    // เปลี่ยนตัวกรองใด ๆ ต้องกลับไปหน้า 1 ไม่งั้นค้างอยู่หน้า 9 ของกระดานที่มี 2 หน้า
    if (next.page === undefined) merged.page = 1;
    setParams(
      {
        cubeType: merged.cubeType,
        scope: merged.scope,
        sortBy: merged.sortBy,
        page: String(merged.page),
      },
      { replace: true },
    );
  }

  const board = useApiPage<AnyLeaderboardRow, LeaderboardMeta>(
    `/leaderboard?cubeType=${encodeURIComponent(cubeType)}&scope=${scope}&sortBy=${sortBy}&page=${page}&limit=${PAGE_SIZE}`,
  );

  // อันดับของตัวเองสำหรับแถวที่ปักท้ายตาราง — `rank` ที่นี่คืออันดับตาม Elo (ADR-047 ข้อ 4)
  const myRatings = useApiData<UserRating[]>(user ? `/users/${user.userId}/ratings` : null);
  const myRating = myRatings.data?.find((r) => r.cubeType === cubeType) ?? null;

  const rows = board.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.username.toLowerCase().includes(q) || (row.nickname ?? '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  const meIsOnPage = user ? rows.some((row) => row.userId === user.userId) : false;
  const showMyRow =
    user !== null && !meIsOnPage && scope === 'all' && sortBy === 'elo' && myRating !== null;

  // ปีนหน้าเกินจำนวนหน้าที่มีจริง (เช่น สลับจากกระดานใหญ่ไปกระดานเล็ก) → ดึงกลับหน้าสุดท้าย
  useEffect(() => {
    if (board.meta && page > board.meta.totalPages) update({ page: board.meta.totalPages });
  }, [board.meta?.totalPages]);

  const myRow: AnyLeaderboardRow | null =
    showMyRow && user && myRating
      ? {
          rank: myRating.rank,
          userId: user.userId,
          username: user.username,
          nickname: user.nickname,
          eloRating: myRating.eloRating,
          matchesPlayed: myRating.matchesPlayed,
          wins: myRating.wins,
          losses: myRating.losses,
          winRate: myRating.winRate,
          bestTime: myRating.bestTime,
        }
      : null;

  const scopeToggle = (
    <ToggleGroup
      options={[
        { value: 'all', label: 'ทั้งหมด' },
        { value: 'weekly', label: 'สัปดาห์นี้' },
      ]}
      value={scope}
      onChange={(v) => update({ scope: v })}
      ariaLabel="ช่วงเวลาของกระดาน"
    />
  );

  const emptyMessages = (
    <>
      {!board.loading && rows.length === 0 && (
        <p className="px-5 py-10 text-center text-sm text-slate-500">
          {scope === 'weekly'
            ? 'สัปดาห์นี้ยังไม่มีใครลงแข่งในประเภทนี้'
            : 'ยังไม่มีผู้เล่นบนกระดานอันดับของประเภทนี้'}
        </p>
      )}

      {rows.length > 0 && filtered.length === 0 && (
        <p className="px-5 py-10 text-center text-sm text-slate-500">
          ไม่พบผู้เล่นชื่อนี้ในหน้านี้ (ค้นหาได้เฉพาะ {rows.length} แถวที่แสดงอยู่ — ลองเปลี่ยนหน้า)
        </p>
      )}
    </>
  );

  const pagination = board.meta && (
    <Pagination
      page={board.meta.page}
      totalPages={board.meta.totalPages}
      total={board.meta.total}
      unitLabel="คน"
      disabled={board.loading}
      onChange={(next) => update({ page: next })}
    />
  );

  if (narrow) {
    return (
      // จอแคบ: หน้าไม่เลื่อน รายชื่อเลื่อนในกรอบ แถวของฉันปักไว้ล่าง (ADR-083 ข้อ 6)
      // ไม่มีแท่นสามอันดับแรก — กินครึ่งจอ · อันดับ 1–3 ใช้สีเลขอันดับแทน
      <div className="flex h-app flex-col bg-navy-900">
        <AppHeader />

        <main className="flex min-h-0 flex-1 flex-col gap-2.5 px-4 pt-3 pb-3">
          <h1 className="shrink-0 text-xl font-extrabold text-white">กระดานจัดอันดับ</h1>

          {/* dropdown แบบเดียวกับหน้าแรกจอแคบ (เจ้าของเลือก · ADR-083 ข้อ 4.2) */}
          <div className="shrink-0">
            <CubeTypeSelect value={cubeType} onChange={(v) => update({ cubeType: v })} />
          </div>

          <div className="flex shrink-0 items-center justify-between gap-2">
            {scopeToggle}
            <ToggleGroup
              options={[
                { value: 'elo', label: 'ELO' },
                { value: 'bestTime', label: 'เวลา' },
              ]}
              value={sortBy}
              onChange={(v) => update({ sortBy: v })}
              ariaLabel="เกณฑ์การเรียง"
            />
          </div>

          {scope === 'weekly' && board.meta?.weekStart && (
            <p className="line-clamp-2 shrink-0 text-[11px] leading-4 text-slate-500">
              นับตั้งแต่ {formatWeekStart(board.meta.weekStart)} (จันทร์ 00:00 เวลาไทย) ·
              จัดอันดับจากผลรวมแต้มที่ได้ในสัปดาห์นี้
            </p>
          )}

          <input
            type="search"
            aria-label="ค้นหาผู้เล่นในหน้านี้"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาผู้เล่นในหน้านี้"
            className="w-full shrink-0 rounded-xl border border-line bg-navy-850/80 px-4 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-brand-500 focus:outline-none"
          />

          {board.error && <ErrorNotice message={board.error} onRetry={board.reload} />}

          <section
            aria-label="รายชื่ออันดับ"
            className={`min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl border border-line bg-navy-850/80 ${
              board.loading ? 'opacity-50 transition-opacity' : ''
            }`}
          >
            <ol>
              {filtered.map((row) => (
                <li key={row.userId} className="border-b border-line-soft last:border-b-0">
                  <MobileRow
                    row={row}
                    scope={scope}
                    sortBy={sortBy}
                    isMe={user?.userId === row.userId}
                  />
                </li>
              ))}
            </ol>
            {emptyMessages}
            {pagination}
          </section>

          {/* อันดับของตัวเองมีเฉพาะ "ทั้งหมด + ELO" — โหมดอื่น API ไม่บอก ห้ามคำนวณเอง (ADR-047 ข้อ 4 · ADR-083 ข้อ 6) */}
          {myRow && (
            <div className="shrink-0 overflow-hidden rounded-2xl border border-brand-500/60">
              <MobileRow row={myRow} scope={scope} sortBy={sortBy} isMe />
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-app bg-navy-900">
      <AppHeader />

      <main className="page-wide px-4 py-8">
        <h1 className="text-3xl font-extrabold text-white">กระดานจัดอันดับ</h1>
        <p className="mt-2 text-sm text-slate-400">
          นี่คือระดับสูงสุดของผู้เล่นทั้งหมด คุณอยู่ระดับไหนล่ะ?
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <CubeTypePicker value={cubeType} onChange={(v) => update({ cubeType: v })} />
          {scopeToggle}
          <ToggleGroup
            options={[
              { value: 'elo', label: 'เรียงตาม ELO' },
              { value: 'bestTime', label: 'เรียงตามเวลา' },
            ]}
            value={sortBy}
            onChange={(v) => update({ sortBy: v })}
            ariaLabel="เกณฑ์การเรียง"
          />
        </div>

        {scope === 'weekly' && board.meta?.weekStart && (
          <p className="mt-3 text-xs text-slate-500">
            นับเฉพาะแมตช์ที่ปรับคะแนนตั้งแต่ {formatWeekStart(board.meta.weekStart)} (จันทร์ 00:00
            เวลาไทย) · จัดอันดับจากผลรวมแต้มที่ได้ในสัปดาห์นี้ ไม่ใช่คะแนนสะสม
          </p>
        )}

        {board.error && (
          <ErrorNotice message={board.error} onRetry={board.reload} className="mt-6" />
        )}

        {/* แท่นสามอันดับแรกมีเฉพาะหน้าแรก — หน้าถัด ๆ ไปไม่มี "อันดับ 1" ให้ยกขึ้นแท่น */}
        {page === 1 && rows.length > 0 && <Podium rows={rows.slice(0, 3)} scope={scope} />}

        <div className="mt-6">
          <label className="relative block max-w-md">
            <span className="sr-only">ค้นหาผู้เล่นในหน้านี้</span>
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              fill="none"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            >
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="m13.5 13.5 3 3"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาผู้เล่นในหน้านี้"
              className="w-full rounded-xl border border-line bg-navy-850/80 py-2.5 pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-600 focus:border-brand-500 focus:outline-none"
            />
          </label>
        </div>

        <section className="mt-4 overflow-hidden rounded-2xl border border-line bg-navy-850/80">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-slate-500">
                  <Th className="w-20">อันดับ</Th>
                  <Th>ผู้เล่น</Th>
                  <Th className="text-right">เวลาที่ดีที่สุด</Th>
                  <Th className="text-right">ผลการเล่น</Th>
                  <Th className="text-right">อัตราชนะ</Th>
                  {scope === 'weekly' && <Th className="text-right">แต้มสัปดาห์นี้</Th>}
                  <Th className="text-right">ELO</Th>
                </tr>
              </thead>
              <tbody className={board.loading ? 'opacity-50 transition-opacity' : undefined}>
                {filtered.map((row) => (
                  <Row
                    key={row.userId}
                    row={row}
                    scope={scope}
                    isMe={user?.userId === row.userId}
                  />
                ))}

                {myRow && (
                  <>
                    <tr>
                      {/* แถวนี้มีเฉพาะ `scope=all` ซึ่งไม่มีคอลัมน์ "แต้มสัปดาห์นี้" → 6 คอลัมน์เสมอ */}
                      <td colSpan={6} className="px-5 py-2 text-slate-600">
                        · · ·
                      </td>
                    </tr>
                    <Row row={myRow} scope={scope} isMe />
                  </>
                )}
              </tbody>
            </table>
          </div>

          {emptyMessages}

          {pagination}
        </section>

        {scope === 'weekly' && user && !meIsOnPage && (
          <p className="mt-3 text-xs text-slate-600">
            กระดานรายสัปดาห์ไม่มีอันดับของคุณให้ปักไว้ท้ายตาราง —
            ต้องมีแมตช์ที่ปรับคะแนนในสัปดาห์นี้ จึงจะมีชื่ออยู่บนกระดาน
          </p>
        )}
      </main>
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-5 py-3 font-medium ${className}`}>{children}</th>;
}

function Row({
  row,
  scope,
  isMe,
}: {
  row: AnyLeaderboardRow;
  scope: LeaderboardScope;
  isMe: boolean;
}) {
  const rankColor =
    row.rank === 1 ? 'text-gold-400' : row.rank <= 3 ? 'text-slate-300' : 'text-slate-500';

  return (
    <tr
      className={`border-b border-line-soft last:border-b-0 ${
        isMe ? 'bg-brand-500/10' : 'odd:bg-navy-800/30'
      }`}
    >
      <td className={`tabular px-5 py-3 font-medium ${rankColor}`}>#{row.rank}</td>
      <td className="px-5 py-3">
        <Link
          to={`/users/${row.userId}`}
          className="flex items-center gap-3 text-slate-200 transition hover:text-white"
        >
          <Avatar name={row.nickname || row.username} size="sm" highlight={row.rank === 1} />
          <span className="truncate font-medium">{row.nickname || row.username}</span>
          {isMe && <span className="shrink-0 text-[10px] text-brand-400">(คุณ)</span>}
        </Link>
      </td>
      <td className="tabular px-5 py-3 text-right text-slate-300">
        {formatSolveTime(row.bestTime)}
      </td>
      <td className="tabular px-5 py-3 text-right text-slate-400">
        {row.matchesPlayed === 0 ? '—' : `${row.wins}W ${row.losses}L`}
      </td>
      <td className="tabular px-5 py-3 text-right text-slate-300">
        {row.matchesPlayed === 0 ? '—' : formatWinRate(row.winRate)}
      </td>
      {scope === 'weekly' && (
        <td
          className={`tabular px-5 py-3 text-right font-medium ${
            (row.eloChange ?? 0) > 0
              ? 'text-win'
              : (row.eloChange ?? 0) < 0
                ? 'text-loss'
                : 'text-slate-400'
          }`}
        >
          {row.eloChange === undefined ? '—' : formatEloChange(row.eloChange)}
        </td>
      )}
      <td className="tabular px-5 py-3 text-right font-semibold text-brand-400">{row.eloRating}</td>
    </tr>
  );
}

/**
 * แถวกระดานของจอแคบ (ADR-083 ข้อ 6) — ทั้งแถวกดไปโปรไฟล์
 * ค่าหลักขวามือตามโหมด: ELO · เวลาที่ดีที่สุด · แต้มสัปดาห์นี้ (weekly + เรียงตาม ELO จัดอันดับจากแต้มสัปดาห์)
 * ค่ารองใต้ค่าหลักเป็นตัวที่หายไปจากคอลัมน์ของจอกว้าง
 */
function MobileRow({
  row,
  scope,
  sortBy,
  isMe,
}: {
  row: AnyLeaderboardRow;
  scope: LeaderboardScope;
  sortBy: LeaderboardSort;
  isMe: boolean;
}) {
  const rankColor =
    row.rank === 1 ? 'text-gold-400' : row.rank <= 3 ? 'text-slate-300' : 'text-slate-500';
  const name = row.nickname || row.username;
  const change = row.eloChange;
  const changeText = change === undefined ? '—' : `${formatEloChange(change)} สัปดาห์นี้`;
  const changeColor =
    (change ?? 0) > 0 ? 'text-win' : (change ?? 0) < 0 ? 'text-loss' : 'text-slate-400';

  let main: { text: string; className: string };
  let sub: string;
  if (sortBy === 'bestTime') {
    main = { text: formatSolveTime(row.bestTime), className: 'text-slate-100' };
    sub = scope === 'weekly' ? changeText : `${row.eloRating} ELO`;
  } else if (scope === 'weekly') {
    main = { text: change === undefined ? '—' : formatEloChange(change), className: changeColor };
    sub = `${row.eloRating} ELO`;
  } else {
    main = { text: String(row.eloRating), className: 'text-brand-400' };
    sub = `ดีที่สุด ${formatSolveTime(row.bestTime)}`;
  }

  return (
    <Link
      to={`/users/${row.userId}`}
      className={`flex items-center gap-3 px-3 py-2.5 transition hover:bg-navy-800/60 ${
        isMe ? 'bg-brand-500/10' : ''
      }`}
    >
      <span className={`tabular w-9 shrink-0 text-sm font-semibold ${rankColor}`}>#{row.rank}</span>
      <Avatar name={name} size="sm" highlight={row.rank === 1} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-slate-100">{name}</span>
          {isMe && <span className="shrink-0 text-[10px] text-brand-400">(คุณ)</span>}
        </span>
        <span className="tabular block text-[11px] text-slate-500">
          {row.matchesPlayed === 0
            ? 'ยังไม่เคยลงแข่ง'
            : `${row.wins}W ${row.losses}L · ${formatWinRate(row.winRate)}`}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className={`tabular block text-sm font-semibold ${main.className}`}>{main.text}</span>
        <span className="tabular block text-[11px] text-slate-500">{sub}</span>
      </span>
    </Link>
  );
}

/** แท่นสามอันดับแรกตามดีไซน์ — ที่ 1 อยู่กลางและใหญ่กว่าเพื่อน */
function Podium({ rows, scope }: { rows: AnyLeaderboardRow[]; scope: LeaderboardScope }) {
  // ดีไซน์เรียง 2 – 1 – 3 บนจอกว้าง ส่วนจอแคบเรียง 1 – 2 – 3 ตามลำดับอันดับ
  const order = [rows[1], rows[0], rows[2]];

  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-3">
      {order.map((row, i) =>
        row ? (
          <PodiumCard key={row.userId} row={row} scope={scope} center={i === 1} />
        ) : (
          <div key={`empty-${i}`} className="hidden sm:block" />
        ),
      )}
    </div>
  );
}

function PodiumCard({
  row,
  scope,
  center,
}: {
  row: AnyLeaderboardRow;
  scope: LeaderboardScope;
  center: boolean;
}) {
  const tone =
    row.rank === 1
      ? 'border-gold-400/60 bg-gradient-to-b from-gold-400/25 to-navy-850'
      : row.rank === 2
        ? 'border-slate-400/40 bg-gradient-to-b from-slate-400/15 to-navy-850'
        : 'border-loss/30 bg-gradient-to-b from-loss/10 to-navy-850';

  return (
    <Link
      to={`/users/${row.userId}`}
      className={`relative flex flex-col items-center rounded-2xl border px-5 transition hover:brightness-110 ${tone} ${
        center ? 'py-7 sm:-mt-4' : 'py-6'
      }`}
    >
      <span className="absolute right-3 top-3 rounded-md bg-navy-950/70 px-2 py-0.5 text-[11px] font-medium text-slate-300">
        {row.rank === 1 ? '1st' : row.rank === 2 ? '2nd' : '3rd'}
      </span>
      <Avatar name={row.nickname || row.username} size="lg" highlight={row.rank === 1} />
      <p className="mt-3 truncate text-base font-semibold text-white">
        {row.nickname || row.username}
      </p>
      <p className="mt-1 flex items-baseline gap-1.5">
        <span className="tabular text-3xl font-semibold text-white">{row.eloRating}</span>
        <span className="text-xs text-slate-400">ELO</span>
      </p>
      {scope === 'weekly' && row.eloChange !== undefined && (
        <p
          className={`tabular mt-1 text-xs font-medium ${
            row.eloChange > 0 ? 'text-win' : row.eloChange < 0 ? 'text-loss' : 'text-slate-400'
          }`}
        >
          {formatEloChange(row.eloChange)} สัปดาห์นี้
        </p>
      )}
    </Link>
  );
}

function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex gap-1 rounded-xl border border-line bg-navy-850/80 p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          onClick={() => onChange(option.value)}
          className={`rounded-lg px-3 py-1.5 text-sm transition ${
            option.value === value
              ? 'bg-brand-500 font-semibold text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** `weekStart` เป็น UTC ของ "จันทร์ 00:00 ไทย" — แสดงเป็นวันที่ไทยให้ตรงกับที่ผู้ใช้เข้าใจ */
function formatWeekStart(iso: string): string {
  return new Date(iso).toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Bangkok',
  });
}
