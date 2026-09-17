import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';

type Tab = 'home' | 'leaderboard' | 'news' | 'profile';

const TABS: { id: Tab; label: string; to: string; icon: ReactNode }[] = [
  {
    id: 'home',
    label: 'หน้าแรก',
    to: '/',
    icon: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  },
  {
    id: 'leaderboard',
    label: 'อันดับ',
    to: '/leaderboard',
    icon: (
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />
    ),
  },
  {
    id: 'news',
    label: 'ข่าวสาร',
    to: '/news',
    icon: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 8h10M7 12h10M7 16h6" />
      </>
    ),
  },
  {
    id: 'profile',
    label: 'ฉัน',
    to: '/profile',
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
  },
];

/**
 * หน้าที่ไม่มีแถบล่าง (ADR-083 ข้อ 3) — ห้องแข่ง/ฝึกซ้อมใช้พื้นที่ทั้งหมดให้คิวบ์ · หน้าแอดมินออกแบบไว้บนจอคอม
 * `/room/new` กับ `/room/join` เป็นฟอร์มธรรมดา ยังมีแถบ
 */
function hidesTabBar(pathname: string): boolean {
  if (pathname === '/practice' || pathname.startsWith('/admin')) return true;
  const room = /^\/room\/([^/]+)\/?$/.exec(pathname);
  return room !== null && room[1] !== 'new' && room[1] !== 'join';
}

/** หน้าลูกไฮไลต์แท็บแม่ · `/users/:id` ของตัวเองคือแท็บ "ฉัน" (`/profile` เด้งมาที่นี่ — ADR-047 ข้อ 5) */
function activeTab(pathname: string, myUserId: number): Tab | null {
  if (pathname === '/' || pathname.startsWith('/room/') || pathname === '/skins') return 'home';
  if (pathname.startsWith('/leaderboard')) return 'leaderboard';
  if (pathname.startsWith('/news')) return 'news';
  const user = /^\/users\/(\d+)/.exec(pathname);
  if (user) return Number(user[1]) === myUserId ? 'profile' : 'leaderboard';
  if (
    pathname === '/profile' ||
    pathname === '/settings' ||
    pathname.startsWith('/matches/') ||
    pathname.startsWith('/multiplayer-matches/')
  ) {
    return 'profile';
  }
  return null;
}

/**
 * **แถบเมนูล่างของจอแคบ** (ADR-083 ข้อ 3) — เมนูบนถูกซ่อนต่ำกว่า `md` จึงเป็นทางเดียวที่ไปหน้าหลักได้
 *
 * วางครั้งเดียวท้าย `<App>` (แบบเดียวกับ `QueueBanner`) ไม่ใส่ซ้ำทุกหน้า
 * ตอนแสดงอยู่จะติดคลาส `has-tabbar` ให้ `<body>` → CSS ดันเนื้อหาขึ้นเท่าความสูงแถบเฉพาะจอแคบ (`index.css`)
 * คนที่ยังไม่ล็อกอินไม่เห็นแถบ — ทุกปลายทางต้องล็อกอิน (ADR-073 ข้อ 2)
 */
export function MobileTabBar() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const visible = user !== null && !hidesTabBar(pathname);

  useEffect(() => {
    if (!visible) return;
    document.body.classList.add('has-tabbar');
    return () => document.body.classList.remove('has-tabbar');
  }, [visible]);

  if (!visible) return null;
  const current = activeTab(pathname, user.userId);

  return (
    <nav
      aria-label="เมนูหลัก"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-navy-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid h-15 grid-cols-4">
        {TABS.map((tab) => {
          const active = tab.id === current;
          return (
            <li key={tab.id}>
              <Link
                to={tab.to}
                aria-current={active ? 'page' : undefined}
                className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition ${
                  active ? 'text-brand-400' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {tab.icon}
                </svg>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
