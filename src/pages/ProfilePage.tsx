import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { AppHeader } from '@/components/AppHeader';
import { BottomSheet } from '@/components/BottomSheet';
import { CubeTypePicker } from '@/components/CubeTypePicker';
import { CubeTypeSelect } from '@/components/CubeTypeSelect';
import { ErrorNotice } from '@/components/ErrorScreen';
import { MatchHistoryList } from '@/components/MatchHistoryList';
import { PageSpinner } from '@/components/PageSpinner';
import { ReportPlayerDialog } from '@/components/ReportPlayerDialog';
import { ShareCardDialog } from '@/components/share/ShareCardDialog';
import { buildProfileCard } from '@/components/share/share-card-data';
import { StatCard } from '@/components/StatCard';
import { useApiData } from '@/hooks/useApiData';
import { useNarrowScreen } from '@/hooks/useNarrowScreen';
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
  const narrow = useNarrowScreen();

  const userId = Number(userIdParam);

  // `/profile` (ไม่มี id) = โปรไฟล์ตัวเอง — ต้องรอกู้เซสชันก่อนถึงจะรู้ว่า id อะไร
  if (!userIdParam) {
    if (status === 'loading') return <PageSpinner />;
    if (!user) return <Navigate to="/login" replace />;
    return <Navigate to={`/users/${user.userId}`} replace />;
  }

  if (!Number.isInteger(userId) || userId <= 0) return <Navigate to="/404" replace />;

  const body = (
    <ProfileBody
      userId={userId}
      isOwner={user?.userId === userId}
      cubeType={cubeType}
      onCubeTypeChange={setCubeType}
      narrow={narrow}
    />
  );

  // จอแคบ: หน้าไม่เลื่อน ประวัติเลื่อนในกรอบ (ADR-083 ข้อ 7) · `min-h` ของกรอบประวัติดันให้จอเตี้ยเลื่อนทั้งหน้าแทนการบีบ
  return narrow ? (
    <div className="flex h-app flex-col bg-navy-900">
      <AppHeader />
      <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3 pb-3">{body}</main>
    </div>
  ) : (
    <div className="min-h-app bg-navy-900">
      <AppHeader />
      <main className="page-wide px-4 py-8">{body}</main>
    </div>
  );
}

function ProfileBody({
  userId,
  isOwner,
  cubeType,
  onCubeTypeChange,
  narrow,
}: {
  userId: number;
  isOwner: boolean;
  cubeType: CubeType;
  onCubeTypeChange: (value: CubeType) => void;
  /** จอแคบกว่า `md` — โครงจบในจอเดียว (ADR-083 ข้อ 7) */
  narrow: boolean;
}) {
  const { logout, user: viewer } = useAuth();
  const navigate = useNavigate();
  const [reporting, setReporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  /** จอแคบ: เมนู ⋯ ของเจ้าของ · แผ่นสถิติเพิ่มเติม · กาง bio เต็ม */
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [bioOpen, setBioOpen] = useState(false);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      // ยิง logout ไม่ผ่านก็ล้างเซสชันในเครื่องไปแล้ว (AuthProvider) — พากลับหน้าหลักทุกกรณี
      navigate('/', { replace: true });
    }
  }
  const profile = useApiData<PublicUser>(`/users/${userId}`);
  const ratings = useApiData<UserRating[]>(`/users/${userId}/ratings`);
  const stats = useApiData<UserStats>(`/users/${userId}/stats?cubeType=${cubeType}`);

  const rating = ratings.data?.find((r) => r.cubeType === cubeType) ?? null;

  if (profile.error) {
    // โหลดไม่ได้เพราะเน็ต กับ "ไม่มีผู้ใช้คนนี้จริง ๆ" ต้องพูดคนละอย่าง — ดูที่รหัส ไม่ใช่ข้อความ
    const gone = profile.errorCode === 'E_NOT_FOUND';
    return (
      <ErrorNotice
        message={gone ? `${profile.error} ผู้ใช้รายนี้อาจถูกลบไปแล้ว` : profile.error}
        onRetry={gone ? undefined : profile.reload}
      />
    );
  }

  const name = profile.data ? profile.data.nickname || profile.data.username : '…';

  const dialogs = (
    <>
      {/* การ์ดใช้ตัวเลขของประเภทที่เลือกอยู่ตอนกด — โปรไฟล์หนึ่งหน้ามี 4 ชุดตัวเลข */}
      {sharing && (
        <ShareCardDialog
          data={buildProfileCard({
            userId,
            profile: profile.data,
            rating,
            stats: stats.data,
            cubeType,
          })}
          title={`โปรไฟล์ ${name} บน CubeDuel`}
          onClose={() => setSharing(false)}
        />
      )}

      {reporting && profile.data && (
        <ReportPlayerDialog
          reportedUserId={userId}
          reportedName={name}
          onClose={() => setReporting(false)}
        />
      )}
    </>
  );

  const history = (limit: number) => (
    <MatchHistoryList
      userId={userId}
      cubeType={cubeType}
      limit={limit}
      emptyHint={`ยังไม่มีแมตช์ประเภท ${CUBE_TYPE_LABEL[cubeType]} ที่บันทึกไว้ (ห้องฝึกซ้อมไม่นับ)`}
    />
  );

  if (narrow) {
    const played = rating !== null && rating.matchesPlayed > 0;
    const best = stats.data?.best ?? rating?.bestTime;
    const menuItem =
      'flex w-full items-center justify-between border-b border-line-soft py-3 text-left text-sm text-slate-200 last:border-b-0';

    return (
      <>
        <section className="flex shrink-0 items-center gap-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 border-brand-400/70 bg-navy-800 text-2xl font-semibold text-slate-200">
            {name.trim().charAt(0).toUpperCase() || '?'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-baseline gap-2">
              <span className="truncate text-lg font-bold text-white">{name}</span>
              <span className="tabular shrink-0 text-xs text-brand-400">
                {rating ? `${rating.eloRating} ELO` : '— ELO'}
              </span>
            </p>
            {profile.data && (
              <p className="truncate text-xs text-slate-500">@{profile.data.username}</p>
            )}
          </div>
          {/* แชร์ได้ทั้งโปรไฟล์ตัวเองและของคนอื่น (ADR-074) */}
          <button
            type="button"
            onClick={() => setSharing(true)}
            aria-label="แชร์โปรไฟล์"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-navy-850 text-base transition hover:bg-navy-800"
          >
            🖼
          </button>
          {/* รายงานได้เฉพาะโปรไฟล์คนอื่น และต้องล็อกอินก่อน (ADR-051 ข้อ 4) */}
          {!isOwner && viewer && (
            <button
              type="button"
              onClick={() => setReporting(true)}
              className="shrink-0 rounded-xl border border-loss/40 px-3 py-2 text-xs font-semibold text-loss transition hover:bg-loss/10"
            >
              รายงาน
            </button>
          )}
          {/* ตั้งค่า · สกิน · แอดมิน · ออกจากระบบ รวมในเมนูเดียว — เมนูบนถูกซ่อนบนจอแคบ (ADR-083 ข้อ 3 + 7) */}
          {isOwner && (
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="เมนูโปรไฟล์"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-navy-850 text-lg leading-none text-slate-300 transition hover:bg-navy-800"
            >
              ⋯
            </button>
          )}
        </section>

        {/* bio ข้อความล้วนเหมือนจอกว้าง (ADR-066 ข้อ 3) · ยาวเกินสองบรรทัดแตะเพื่อกาง */}
        {profile.data?.bio && (
          <button
            type="button"
            onClick={() => setBioOpen((open) => !open)}
            aria-expanded={bioOpen}
            className={`shrink-0 whitespace-pre-line text-left text-sm leading-6 text-slate-300 ${
              bioOpen ? '' : 'line-clamp-2'
            }`}
          >
            {profile.data.bio}
          </button>
        )}

        <div className="flex shrink-0 gap-2">
          <div className="min-w-0 flex-1">
            <CubeTypeSelect value={cubeType} onChange={onCubeTypeChange} />
          </div>
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="shrink-0 rounded-lg border border-line bg-navy-850 px-3 text-sm text-slate-300 transition hover:bg-navy-800"
          >
            สถิติเพิ่มเติม
          </button>
        </div>

        {/* 6 ตัวเลขเดียวกับจอกว้าง ตาราง 3×2 (ADR-083 ข้อ 7) */}
        <dl className="grid shrink-0 grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line-soft">
          <MiniStat
            label="ELO"
            value={rating ? String(rating.eloRating) : '—'}
            note={rating ? `อันดับที่ ${rating.rank}` : undefined}
            accent
          />
          <MiniStat
            label="เล่นไปทั้งหมด"
            value={rating ? String(rating.matchesPlayed) : '—'}
            note={played ? `${rating.wins}W ${rating.losses}L` : undefined}
          />
          <MiniStat label="เวลาที่ดีที่สุด" value={formatSolveTime(best)} />
          <MiniStat label="อัตราชนะ" value={played ? formatWinRate(rating.winRate) : '—'} />
          <MiniStat label="เวลาเฉลี่ย (5)" value={formatSolveTime(stats.data?.ao5)} />
          <MiniStat label="เวลาเฉลี่ย (12)" value={formatSolveTime(stats.data?.ao12)} />
        </dl>

        <div className="min-h-48 flex-1 overflow-y-auto overscroll-contain rounded-2xl">
          {history(10)}
        </div>

        {dialogs}

        {isOwner && (
          <BottomSheet open={menuOpen} onClose={() => setMenuOpen(false)} title="เมนูโปรไฟล์">
            <nav className="-mt-2 flex flex-col">
              <Link to="/settings" className={menuItem}>
                ⚙ การตั้งค่า <span className="text-xs text-slate-500">บัญชีและโปรไฟล์</span>
              </Link>
              {/* สกินไม่มีที่ในแถบล่าง — ทางเข้าอยู่หน้าแรกกับเมนูนี้ (ADR-064 ข้อ 6 · ADR-080 ข้อ 1) */}
              <Link to="/skins" className={menuItem}>
                🎨 สกินคิวบ์
              </Link>
              {/* เมนูแอดมินโผล่เฉพาะบัญชีแอดมิน — ตัวกันจริงอยู่ฝั่ง server (`requireAdmin`) */}
              {viewer?.role === 'admin' && (
                <Link to="/admin" className={menuItem}>
                  ผู้ดูแลระบบ <span className="text-xs text-slate-500">ออกแบบไว้ใช้บนจอคอม</span>
                </Link>
              )}
              <button
                type="button"
                onClick={() => void handleLogout()}
                className={`${menuItem} text-loss`}
              >
                ออกจากระบบ
              </button>
            </nav>
          </BottomSheet>
        )}

        <BottomSheet
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          title={`สถิติเพิ่มเติม · ${CUBE_TYPE_LABEL[cubeType]}`}
          hideTitle
        >
          <ExtraDetails rating={rating} stats={stats.data} createdAt={profile.data?.createdAt} />
        </BottomSheet>
      </>
    );
  }

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
            {/*
              bio เป็น **ข้อความล้วน** — แสดงด้วย `whitespace-pre-line` เท่านั้น
              ห้าม render เป็น HTML และไม่ทำลิงก์ให้กดได้ (ADR-066 ข้อ 3)
              ไม่มี bio = ไม่แสดงอะไรเลย ไม่มีข้อความชวนกรอก (ADR-066 ข้อ 7)
            */}
            {profile.data?.bio && (
              <p className="mt-3 max-w-prose whitespace-pre-line text-sm leading-6 text-slate-300">
                {profile.data.bio}
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-2">
            {/* แชร์ได้ทั้งโปรไฟล์ตัวเองและของคนอื่น — ออกมาเป็นการ์ดรูปภาพ ไม่ใช่ลิงก์เปล่า (ADR-074) */}
            <button
              type="button"
              onClick={() => setSharing(true)}
              className="rounded-xl border border-line bg-navy-800 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-navy-700 hover:text-white"
            >
              🖼 แชร์โปรไฟล์
            </button>
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
                {/* สกินไม่มีที่ในเมนูหลัก (เต็มแล้ว) — ทางเข้าอยู่ที่โปรไฟล์ตัวเองกับหน้าตั้งค่า (ADR-064 ข้อ 6) */}
                <Link
                  to="/skins"
                  className="rounded-xl border border-line bg-navy-800 px-5 py-2.5 text-center text-sm font-semibold text-slate-300 transition hover:bg-navy-700 hover:text-white"
                >
                  🎨 สกินคิวบ์
                </Link>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="rounded-xl border border-loss/40 px-5 py-2.5 text-sm font-semibold text-loss transition hover:bg-loss/10"
                >
                  ออกจากระบบ
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {dialogs}

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
        {history(15)}
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

/** ช่องตัวเลขในตาราง 3×2 ของจอแคบ */
function MiniStat({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: string;
  note?: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0 bg-navy-850 px-2.5 py-2">
      <dt className="truncate text-[10.5px] text-slate-500">{label}</dt>
      <dd
        className={`tabular truncate text-base font-semibold ${accent ? 'text-brand-400' : 'text-slate-100'}`}
      >
        {value}
      </dd>
      {note && <dd className="tabular truncate text-[10px] text-slate-500">{note}</dd>}
    </div>
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
