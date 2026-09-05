import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { displayName } from '@/types/auth';
import { useApiData } from '@/hooks/useApiData';
import type { UserRating } from '@/types/leaderboard';
import { Avatar } from './Avatar';
import { CubeLogo } from './CubeLogo';

/**
 * แถบบนสุดตามดีไซน์ — เมนูหลัก + ชิปผู้ใช้ (ชื่อ + ELO + รูปโปรไฟล์)
 * เมนูที่หน้ายังไม่ถูกสร้างจะเป็นตัวจาง กดไม่ได้ พร้อมบอกว่าจะมาในเฟสไหน
 */
const NAV_ITEMS = [
  { label: 'หน้าแรก', to: '/' },
  { label: 'ฝึกซ้อม', to: '/practice' },
  { label: 'สร้างห้อง', to: null, phase: 'เฟส 4' },
  { label: 'กระดานจัดอันดับ', to: null, phase: 'เฟส 7' },
  { label: 'โปรไฟล์', to: null, phase: 'เฟส 8' },
] as const;

export function AppHeader() {
  const { status, user, logout } = useAuth();

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
          {NAV_ITEMS.map((item) =>
            item.to ? (
              <NavLink
                key={item.label}
                to={item.to}
                className={({ isActive }) =>
                  `text-sm transition ${isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`
                }
              >
                {item.label}
              </NavLink>
            ) : (
              <span
                key={item.label}
                title={`ยังไม่เปิดใช้งาน — จะมาใน${item.phase}`}
                className="cursor-not-allowed text-sm text-slate-600"
              >
                {item.label}
              </span>
            ),
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {status === 'loading' ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand-500" />
          ) : user ? (
            <>
              <div className="hidden text-right leading-tight sm:block">
                <p className="text-sm font-medium text-slate-100">{displayName(user)}</p>
                <p className="tabular text-xs text-brand-400">
                  {elo === undefined ? '— ELO' : `${elo} ELO`}
                </p>
              </div>
              <Avatar name={displayName(user)} />
              {/* ดีไซน์วางปุ่มออกจากระบบไว้ในหน้าโปรไฟล์ (เฟส 8) — ระหว่างที่ยังไม่มีหน้านั้น พักไว้ตรงนี้ก่อน */}
              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-lg border border-loss/40 px-3 py-1.5 text-sm font-medium text-loss transition hover:bg-loss/10"
              >
                ออกจากระบบ
              </button>
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
