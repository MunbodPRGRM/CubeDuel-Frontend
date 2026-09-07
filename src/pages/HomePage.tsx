import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { useApiData } from '@/hooks/useApiData';
import { AppHeader } from '@/components/AppHeader';
import { CubeLogo } from '@/components/CubeLogo';
import { CubeTypePicker } from '@/components/CubeTypePicker';
import { LeaderboardCard } from '@/components/LeaderboardCard';
import { StatCard } from '@/components/StatCard';
import { formatSolveTime, formatWinRate } from '@/lib/format';
import type { CubeType } from '@/types/cube';
import type { UserRating } from '@/types/leaderboard';

export default function HomePage() {
  const { user } = useAuth();
  const [cubeType, setCubeType] = useState<CubeType>('3x3x3');

  const ratings = useApiData<UserRating[]>(user ? `/users/${user.userId}/ratings` : null);
  const rating = ratings.data?.find((r) => r.cubeType === cubeType);

  return (
    <div className="min-h-screen bg-navy-900">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <HeroCard isLoggedIn={Boolean(user)} />

        {user && (
          <>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-300">สถิติของฉัน</h2>
              <CubeTypePicker value={cubeType} onChange={setCubeType} />
            </div>

            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="ELO"
                value={rating ? String(rating.eloRating) : '—'}
                accent
                note={rating ? `อันดับที่ ${rating.rank}` : undefined}
              />
              <StatCard
                label="สถิติเวลาที่ดีที่สุด"
                value={formatSolveTime(rating?.bestTime)}
                note={rating?.bestTime == null ? 'ยังไม่มีเวลาที่บันทึกไว้' : undefined}
              />
              <StatCard
                label="เวลาเฉลี่ย 5 รอบ"
                value="—"
                note="จะคำนวณได้เมื่อมีผลแข่งจริง (เฟส 7)"
              />
              <StatCard
                label="อัตราการชนะ"
                value={rating && rating.matchesPlayed > 0 ? formatWinRate(rating.winRate) : '—'}
                suffix={
                  rating && rating.matchesPlayed > 0
                    ? `${rating.wins}W ${rating.losses}L`
                    : undefined
                }
                note={rating && rating.matchesPlayed === 0 ? 'ยังไม่เคยลงแข่ง' : undefined}
              />
            </div>
          </>
        )}

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <MatchHistoryCard />
          <LeaderboardCard cubeType={cubeType} limit={5} showViewAll />
        </div>
      </main>
    </div>
  );
}

function HeroCard({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-line bg-navy-850">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-500/10 blur-3xl"
      />
      <div className="relative flex flex-col gap-8 px-6 py-8 sm:px-10 sm:py-12 lg:flex-row lg:items-center">
        <div className="flex-1">
          <h1 className="text-3xl font-extrabold leading-snug text-white sm:text-4xl">
            บิดล่าเวลา
            <br />
            ท้าชนทุกสถิติ
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-400">
            คุณจะถูกจับคู่กับผู้เล่นที่มีระดับใกล้เคียงกัน
            <br />
            แก้ปัญหาให้เร็วที่สุดเพื่อเก็บสะสมแต้ม และไต่ขึ้นสู่ระดับที่สูงกว่า
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {isLoggedIn ? (
              <>
                <ComingSoonButton primary label="จับคู่" phase="เฟส 5" />
                <Link
                  to="/practice"
                  className="rounded-xl border border-line bg-navy-800 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-navy-700"
                >
                  ฝึกซ้อม
                </Link>
                <Link
                  to="/room/new"
                  className="rounded-xl border border-line bg-navy-800 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-navy-700"
                >
                  สร้างห้อง
                </Link>
                <Link
                  to="/room/join"
                  className="rounded-xl border border-line bg-navy-800 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-navy-700"
                >
                  ใส่เลขห้อง
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/register"
                  className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
                >
                  สมัครสมาชิก
                </Link>
                <Link
                  to="/login"
                  className="rounded-xl border border-line bg-navy-800 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-navy-700"
                >
                  เข้าสู่ระบบ
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="grid shrink-0 place-items-center lg:w-80">
          <CubeLogo size={210} />
        </div>
      </div>
    </section>
  );
}

/** ปุ่มตามดีไซน์ที่หน้าปลายทางยังไม่ถูกสร้าง — กดไม่ได้ แต่บอกชัดว่าจะมาเมื่อไหร่ */
function ComingSoonButton({
  label,
  phase,
  primary,
}: {
  label: string;
  phase: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      disabled
      title={`ยังไม่เปิดใช้งาน — จะมาใน${phase}`}
      className={`cursor-not-allowed rounded-xl px-5 py-2.5 text-sm font-semibold ${
        primary ? 'bg-brand-500/40 text-white/70' : 'border border-line bg-navy-800 text-slate-500'
      }`}
    >
      {label}
    </button>
  );
}

function MatchHistoryCard() {
  return (
    <section className="rounded-2xl border border-line bg-navy-850/80">
      <header className="px-5 py-4">
        <h2 className="font-semibold text-slate-100">ประวัติการเล่น</h2>
        <p className="mt-0.5 text-xs text-slate-500">การเล่น 5 รอบล่าสุดของคุณ</p>
      </header>
      <div className="border-t border-line-soft px-5 py-10 text-center">
        <p className="text-sm text-slate-500">ยังไม่มีประวัติการเล่น</p>
        <p className="mt-1 text-xs text-slate-600">
          ห้องสร้างเองไม่นับเป็นผลแข่ง — ประวัติจะเริ่มมีเมื่อเปิดห้องแข่งขันในเฟส 5
        </p>
      </div>
    </section>
  );
}
