import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { displayName } from '@/types/auth';
import { useApiData } from '@/hooks/useApiData';
import type { UserRating } from '@/types/leaderboard';
import { Avatar } from './Avatar';
import { CubeLogo } from './CubeLogo';

/**
 * แถบบนสุดตามดีไซน์ — เมนูหลัก + ชิปผู้ใช้ (ชื่อ + ELO + รูปโปรไฟล์) ที่กดไปหน้าโปรไฟล์ได้
 * ปุ่ม "ออกจากระบบ" ย้ายไปอยู่ในหน้าโปรไฟล์ตามดีไซน์แล้ว (เฟส 7 ก้อนที่ 3)
 */
const NAV_ITEMS = [
  { label: 'หน้าแรก', to: '/' },
  { label: 'ฝึกซ้อม', to: '/practice' },
  { label: 'สร้างห้อง', to: '/room/new' },
  { label: 'กระดานจัดอันดับ', to: '/leaderboard' },
  { label: 'ข่าวสาร', to: '/news' },
  { label: 'โปรไฟล์', to: '/profile' },
] as const;

export function AppHeader() {
  const { status, user } = useAuth();

  // ELO ที่โชว์ข้างชื่อใช้ของ 3x3x3 เป็นตัวแทน (คะแนนแยกกัน 4 ประเภท — ดีไซน์ไม่ได้เผื่อช่องเลือกไว้)
  const ratings = useApiData<UserRating[]>(user ? `/users/${user.userId}/ratings` : null);
  const elo = ratings.data?.find((r) => r.cubeType === '3x3x3')?.eloRating;

  return (
    <header className="border-b border-line bg-navy-950/70 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <CubeLogo size={30} />
          <span className="text-lg font-bold tracking-tight text-white">CubeDuel</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {/* เมนูแอดมินโผล่เฉพาะบัญชีแอดมิน — ตัวกันจริงอยู่ฝั่ง server (`requireAdmin`) */}
          {(user?.role === 'admin'
            ? [...NAV_ITEMS, { label: 'ผู้ดูแลระบบ', to: '/admin' } as const]
            : NAV_ITEMS
          ).map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) =>
                `text-sm transition ${isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {status === 'loading' ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand-500" />
          ) : user ? (
            <>
              <Link to="/profile" className="hidden text-right leading-tight sm:block">
                <p className="text-sm font-medium text-slate-100">{displayName(user)}</p>
                <p className="tabular text-xs text-brand-400">
                  {elo === undefined ? '— ELO' : `${elo} ELO`}
                </p>
              </Link>
              <Link to="/profile" aria-label="ไปหน้าโปรไฟล์ของฉัน">
                <Avatar name={displayName(user)} />
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:text-white"
              >
                เข้าสู่ระบบ
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-brand-500 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-600"
              >
                สมัครสมาชิก
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
