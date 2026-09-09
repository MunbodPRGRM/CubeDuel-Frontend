import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { QueuePanel } from '@/queue/QueuePanel';
import { useQueue } from '@/socket/useQueue';
import { useApiData } from '@/hooks/useApiData';
import { AppHeader } from '@/components/AppHeader';
import { CubeLogo } from '@/components/CubeLogo';
import { CubeTypePicker } from '@/components/CubeTypePicker';
import { LeaderboardCard } from '@/components/LeaderboardCard';
import { StatCard } from '@/components/StatCard';
import { formatSolveTime, formatWinRate } from '@/lib/format';
import type { CubeType } from '@/types/cube';
import { CUBE_TYPE_LABEL, type UserRating } from '@/types/leaderboard';

export default function HomePage() {
  const { user } = useAuth();
  const [cubeType, setCubeType] = useState<CubeType>('3x3x3');

  const ratings = useApiData<UserRating[]>(user ? `/users/${user.userId}/ratings` : null);
  const rating = ratings.data?.find((r) => r.cubeType === cubeType);

  return (
    <div className="min-h-screen bg-navy-900">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <HeroCard isLoggedIn={Boolean(user)} cubeType={cubeType} onCubeTypeChange={setCubeType} />

        {user && (
          <>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-300">
                สถิติของฉัน · {CUBE_TYPE_LABEL[cubeType]}
              </h2>
              {/* ช่องเลือกประเภทมีตัวเดียวอยู่ในการ์ดด้านบน — คุมทั้งคิวจับคู่และตัวเลขชุดนี้ */}
              <p className="text-xs text-slate-500">เปลี่ยนประเภทได้ที่การ์ดด้านบน</p>
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

interface HeroCardProps {
  isLoggedIn: boolean;
  cubeType: CubeType;
  onCubeTypeChange: (value: CubeType) => void;
}

/**
 * การ์ดหลักของหน้าแรก (`design/HomePage.png` + `HomePage - Matching.png`)
 *
 * ปุ่ม “จับคู่” สลับเป็น “ยกเลิกการจับคู่” ระหว่างรอคิว แล้วมี `QueuePanel` บอกสถานะอยู่ใต้ปุ่ม
 * — ไม่ได้แยกเป็นหน้า `/queue` ต่างหาก เพราะดีไซน์วางไว้ในการ์ดนี้ และการเปลี่ยนหน้าไม่ได้
 * ทำให้คิวมั่นคงขึ้นเลย (คิวเป็นของ socket ไม่ใช่ของหน้า — ADR-040 ข้อ 1)
 */
function HeroCard({ isLoggedIn, cubeType, onCubeTypeChange }: HeroCardProps) {
  const queue = useQueue();
  const queuing = queue.phase === 'queued';
  /**
   * อยู่ได้ช่องคิวเดียวเท่านั้น (`E_ALREADY_IN_QUEUE`) — ระหว่างรอจึงเหลือปุ่มเดียวคือ
   * "ยกเลิก" ของช่องที่รออยู่จริง ไม่ใช่ปุ่มที่กดค้างไว้ (server เป็นคนบอกว่าช่องไหน)
   */
  const queuingMulti = queuing && queue.kind === 'multiplayer';

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

          {isLoggedIn ? (
            <>
              <div className="mt-7">
                <p className="text-xs text-slate-500">ประเภทรูบิคที่จะแข่ง</p>
                <div className="mt-2">
                  {/* เปลี่ยนประเภทระหว่างอยู่ในคิวไม่ได้ — server ตอบ `E_ALREADY_IN_QUEUE`
                      ต้อง `queue:leave` ก่อน (socket-events.md ข้อ 4) */}
                  <CubeTypePicker
                    value={cubeType}
                    onChange={onCubeTypeChange}
                    disabled={queuing}
                    disabledHint="ออกจากคิวก่อนจึงจะเปลี่ยนประเภทได้"
                  />
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {queuing ? (
                  <button
                    type="button"
                    disabled={queue.busy}
                    onClick={() => void queue.leave()}
                    className="rounded-xl border border-line bg-navy-800 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {queuingMulti ? '✕ ยกเลิกการรวมกลุ่ม' : '✕ ยกเลิกการจับคู่'}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={queue.busy}
                      onClick={() => void queue.join(cubeType, 'competitive')}
                      className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-500/40"
                    >
                      จับคู่
                    </button>
                    {/* คิวคนละช่องกับ 1v1 โดยสิ้นเชิง — ไม่ใช่ตัวเลือกของปุ่มเดิม (เฟส 6) */}
                    <button
                      type="button"
                      disabled={queue.busy}
                      onClick={() => void queue.join(cubeType, 'multiplayer')}
                      className="rounded-xl border border-brand-500/60 bg-navy-800 px-5 py-2.5 text-sm font-semibold text-brand-300 transition hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      ห้องหลายคน (3–4)
                    </button>
                  </>
                )}
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
              </div>

              <QueuePanel />
            </>
          ) : (
            <div className="mt-8 flex flex-wrap gap-3">
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
            </div>
          )}
        </div>

        <div className="grid shrink-0 place-items-center lg:w-80">
          <CubeLogo size={210} />
        </div>
      </div>
    </section>
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
          ห้องแข่งขันบันทึกผลลง DB แล้ว — หน้ารายการนี้ต่อกับ `GET /users/:id/matches` ในเฟส 7
        </p>
      </div>
    </section>
  );
}
