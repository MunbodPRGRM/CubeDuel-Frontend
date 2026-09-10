import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { AppHeader } from '@/components/AppHeader';
import { CubeTypePicker } from '@/components/CubeTypePicker';
import { MatchHistoryList } from '@/components/MatchHistoryList';
import { PageSpinner } from '@/components/PageSpinner';
import { ReportPlayerDialog } from '@/components/ReportPlayerDialog';
import { ShareButton } from '@/components/ShareButton';
import { StatCard } from '@/components/StatCard';
import { useApiData } from '@/hooks/useApiData';
import { formatSolveTime, formatWinRate } from '@/lib/format';
import type { CubeType } from '@/types/cube';
import { CUBE_TYPE_LABEL, type UserRating } from '@/types/leaderboard';
import type { PublicUser, UserStats } from '@/types/stats';

/**
 * หน้าโปรไฟล์ (`design/Profile - Owner.png` + `Profile - Other.png`)
 *
 * ภาพสองใบต่างกันแค่ปุ่มมุมขวาบน จึงใช้ component เดียวแล้วสลับด้วย `isOwner` (ADR-047 ข้อ 5)
 * ทุกตัวเลขบนหน้านี้เป็นของ **ประเภทรูบิคเดียว** เพราะ Elo กับสถิติแยกกัน 4 ประเภท
 * → มี `CubeTypePicker` คุมทั้งหน้า ซึ่งดีไซน์ไม่ได้เผื่อไว้ (เหตุผลเดียวกับ ADR-024)
 */
export default function ProfilePage() {
  const { userId: userIdParam } = useParams();
  const { user, status } = useAuth();
  const [cubeType, setCubeType] = useState<CubeType>('3x3x3');

  const userId = Number(userIdParam);

  // `/profile` (ไม่มี id) = โปรไฟล์ตัวเอง — ต้องรอกู้เซสชันก่อนถึงจะรู้ว่า id อะไร
  if (!userIdParam) {
    if (status === 'loading') return <PageSpinner />;
    if (!user) return <Navigate to="/login" replace />;
    return <Navigate to={`/users/${user.userId}`} replace />;
  }

  if (!Number.isInteger(userId) || userId <= 0) return <Navigate to="/404" replace />;

  return (
    <div className="min-h-screen bg-navy-900">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <ProfileBody
          userId={userId}
          isOwner={user?.userId === userId}
          cubeType={cubeType}
          onCubeTypeChange={setCubeType}
        />
      </main>
    </div>
  );
}

function ProfileBody({
  userId,
  isOwner,
  cubeType,
  onCubeTypeChange,
}: {
  userId: number;
  isOwner: boolean;
  cubeType: CubeType;
  onCubeTypeChange: (value: CubeType) => void;
}) {
  const { logout, user: viewer } = useAuth();
  const [reporting, setReporting] = useState(false);
  const profile = useApiData<PublicUser>(`/users/${userId}`);
  const ratings = useApiData<UserRating[]>(`/users/${userId}/ratings`);
  const stats = useApiData<UserStats>(`/users/${userId}/stats?cubeType=${cubeType}`);

  const rating = ratings.data?.find((r) => r.cubeType === cubeType) ?? null;

  if (profile.error) {
    return (
      <div className="rounded-2xl border border-line bg-navy-850/80 px-6 py-12 text-center">
        <p className="text-sm text-slate-300">{profile.error}</p>
        <p className="mt-1 text-xs text-slate-600">ผู้ใช้รายนี้อาจถูกลบไปแล้ว</p>
      </div>
    );
  }

  const name = profile.data ? profile.data.nickname || profile.data.username : '…';

  return (
    <>
      {/* ---------------- การ์ดหัวโปรไฟล์ */}
      <section className="rounded-2xl border border-line bg-navy-850/80 px-6 py-7 sm:px-8">
        <div className="flex flex-wrap items-center gap-6">
          <span className="grid h-24 w-24 shrink-0 place-items-center rounded-full border-2 border-brand-400/70 bg-navy-800 text-4xl font-semibold text-slate-200">
            {name.trim().charAt(0).toUpperCase() || '?'}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-500">โปรไฟล์</p>
            <p className="mt-1 flex flex-wrap items-baseline gap-2">
              <span className="text-3xl font-bold text-white">{name}</span>
              <span className="tabular text-sm text-brand-400">
                {rating ? `${rating.eloRating} ELO` : '— ELO'}
              </span>
            </p>
            {profile.data && (
              <p className="mt-1 text-sm text-slate-500">@{profile.data.username}</p>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-2">
            {/* แชร์ได้ทั้งโปรไฟล์ตัวเองและของคนอื่น — เส้นทาง /users/:id เปิดสาธารณะอยู่แล้ว */}
            <ShareButton
              path={`/users/${userId}`}
              title={`โปรไฟล์ ${name} บน CubeDuel`}
              label="แชร์โปรไฟล์"
              className="rounded-xl border border-line bg-navy-800 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-navy-700 hover:text-white"
            />
            {/* รายงานได้เฉพาะโปรไฟล์คนอื่น และต้องล็อกอินก่อน — ไม่แนบแมตช์ (ADR-051 ข้อ 4) */}
            {!isOwner && viewer && (
              <button
                type="button"
                onClick={() => setReporting(true)}
                className="rounded-xl border border-loss/40 px-5 py-2.5 text-sm font-semibold text-loss transition hover:bg-loss/10"
              >
                รายงานผู้เล่น
              </button>
            )}
            {isOwner && (
              <>
                <Link
                  to="/settings"
                  className="rounded-xl border border-line bg-navy-800 px-5 py-2.5 text-center text-sm font-semibold text-slate-300 transition hover:bg-navy-700 hover:text-white"
                >
                  ⚙ ตั้งค่า
                </Link>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="rounded-xl border border-loss/40 px-5 py-2.5 text-sm font-semibold text-loss transition hover:bg-loss/10"
                >
                  ออกจากระบบ
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {reporting && profile.data && (
        <ReportPlayerDialog
          reportedUserId={userId}
          reportedName={name}
          onClose={() => setReporting(false)}
        />
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-300">
          สถิติ · {CUBE_TYPE_LABEL[cubeType]}
        </h2>
        <CubeTypePicker value={cubeType} onChange={onCubeTypeChange} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* ---------------- ซ้าย: ตัวเลขสถิติ */}
        <div className="space-y-4">
          <ExtraDetails rating={rating} stats={stats.data} createdAt={profile.data?.createdAt} />

          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label="ELO"
              value={rating ? String(rating.eloRating) : '—'}
              accent
              note={rating ? `อันดับที่ ${rating.rank}` : undefined}
            />
            <StatCard
              label="เล่นไปทั้งหมด"
              value={rating ? String(rating.matchesPlayed) : '—'}
              suffix={rating && rating.matchesPlayed > 0 ? 'แมตช์' : undefined}
              note={rating?.matchesPlayed === 0 ? 'ยังไม่เคยลงแข่งประเภทนี้' : undefined}
            />
            <StatCard
              label="เวลาที่ดีที่สุด"
              value={formatSolveTime(stats.data?.best ?? rating?.bestTime)}
              note={
                (stats.data?.best ?? rating?.bestTime) == null ? 'ยังไม่เคยแก้สำเร็จ' : undefined
              }
            />
            <StatCard
              label="อัตราชนะ"
              value={rating && rating.matchesPlayed > 0 ? formatWinRate(rating.winRate) : '—'}
              suffix={
                rating && rating.matchesPlayed > 0 ? `${rating.wins}W ${rating.losses}L` : undefined
              }
            />
            <StatCard
              label="เวลาเฉลี่ย (5)"
              value={formatSolveTime(stats.data?.ao5)}
              note={stats.data && stats.data.ao5 === null ? aoHint(stats.data, 5) : undefined}
            />
            {/* ดีไซน์เขียน (10) แต่ API คิด ao12 ตามธรรมเนียม WCA — เขียนเลขจริง (ADR-047 ข้อ 5) */}
            <StatCard
              label="เวลาเฉลี่ย (12)"
              value={formatSolveTime(stats.data?.ao12)}
              note={stats.data && stats.data.ao12 === null ? aoHint(stats.data, 12) : undefined}
            />
          </div>
        </div>

        {/* ---------------- ขวา: ประวัติการเล่นของประเภทนี้ */}
        <MatchHistoryList
          userId={userId}
          cubeType={cubeType}
          limit={15}
          emptyHint={`ยังไม่มีแมตช์ประเภท ${CUBE_TYPE_LABEL[cubeType]} ที่บันทึกไว้ (ห้องฝึกซ้อมไม่นับ)`}
        />
      </div>
    </>
  );
}

/**
 * การ์ด "รายละเอียดเพิ่มเติม" ของดีไซน์เป็น bio ที่ผู้ใช้พิมพ์เอง แต่ตาราง `User` ไม่มีคอลัมน์นั้น
 * และไม่เพิ่มให้ (ADR-047 ข้อ 5) → ใช้พื้นที่นี้แสดงสถิติที่ดีไซน์ไม่มีที่ให้อยู่แทน
 */
function ExtraDetails({
  rating,
  stats,
  createdAt,
}: {
  rating: UserRating | null;
  stats: UserStats | null;
  createdAt?: string;
}) {
  return (
    <section className="rounded-2xl border border-line bg-navy-850/80 px-5 py-4">
      <h3 className="text-sm font-semibold text-slate-200">รายละเอียดเพิ่มเติม</h3>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
        <Detail label="อันดับ" value={rating ? `#${rating.rank}` : '—'} />
        <Detail label="เวลาเฉลี่ย (100)" value={formatSolveTime(stats?.ao100)} />
        <Detail label="เวลาเฉลี่ยรวม" value={formatSolveTime(stats?.mean)} />
        <Detail label="เวลาที่ช้าที่สุด" value={formatSolveTime(stats?.worst)} />
        <Detail label="DNF" value={stats ? `${stats.dnfCount} ครั้ง` : '—'} />
        <Detail
          label="ชนะติดกัน"
          value={stats ? `${stats.currentStreak} (สูงสุด ${stats.bestStreak})` : '—'}
        />
        <Detail label="สมัครเมื่อ" value={createdAt ? formatDate(createdAt) : '—'} />
        <Detail label="เสมอ" value={rating ? `${rating.draws} ครั้ง` : '—'} />
      </dl>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="tabular mt-0.5 text-slate-200">{value}</dd>
    </div>
  );
}

/** บอกว่าทำไม ao ยังเป็น `—` — ไม่ครบ N ครั้ง หรือ DNF เกิน 1 ครั้งใน N ครั้งล่าสุด */
function aoHint(stats: UserStats, n: number): string {
  return stats.totalSolves < n
    ? `ต้องแก้ครบ ${n} ครั้งก่อน (ตอนนี้ ${stats.totalSolves})`
    : `DNF เกิน 1 ครั้งใน ${n} ครั้งล่าสุด`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
