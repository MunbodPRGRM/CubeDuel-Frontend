import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';

const ADMIN_NAV = [
  { label: 'แดชบอร์ด', to: '/admin', end: true },
  { label: 'บัญชีผู้ใช้', to: '/admin/users', end: false },
  { label: 'รายงานผู้เล่น', to: '/admin/reports', end: false },
  { label: 'แมตช์ที่ถูก flag', to: '/admin/flags', end: false },
  { label: 'ข่าวสาร', to: '/admin/news', end: false },
] as const;

/**
 * โครงหน้าของทุกหน้าในส่วนแอดมิน — แถบเมนูซ้าย + เนื้อหาขวา
 *
 * ดีไซน์ไม่มีหน้าแอดมินเลยสักภาพ (เหมือนหน้าข่าว — ADR-049 ข้อ 6) จึงยืมโครงเดียวกับ
 * หน้าตั้งค่าบัญชี (`design/Profile - Settings`) มาใช้ เพื่อให้ทั้งแอปมีภาษาเดียวกัน
 */
export function AdminLayout({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-navy-900">
      <AppHeader />
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside>
          <p className="px-1 text-sm text-slate-500">ผู้ดูแลระบบ</p>
          <nav className="mt-2 space-y-1">
            {ADMIN_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `block rounded-xl px-4 py-2.5 text-sm transition ${
                    isActive
                      ? 'bg-navy-800 font-medium text-white'
                      : 'text-slate-400 hover:bg-navy-850'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <section>
          <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white">{title}</h1>
              {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
            </div>
            {actions}
          </header>
          {children}
        </section>
      </main>
    </div>
  );
}

/**
 * กล่องข้อความสถานะของหน้าแอดมิน (กำลังโหลด / ผิดพลาด / ไม่มีข้อมูล) — หน้าตาเหมือนกันทุกหน้า
 *
 * ส่ง `onRetry` มาเมื่อเป็น error จากการโหลด (`reload` ของ `useApiData`/`useApiPage`)
 * — หน้าแอดมินโหลดพลาดแล้วไม่มีปุ่มให้กด ต้องรีเฟรชทั้งหน้าเอง ซึ่งทำให้ตัวกรองที่ตั้งไว้หายหมด
 */
export function AdminNotice({
  children,
  tone,
  onRetry,
}: {
  children: ReactNode;
  tone?: 'error';
  onRetry?: () => void;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={`rounded-2xl border border-line bg-navy-850/80 px-6 py-12 text-center text-sm ${
        tone === 'error' ? 'text-loss' : 'text-slate-500'
      }`}
    >
      {children}
      {onRetry && (
        <div className="mt-4">
          <button
            type="button"
            onClick={onRetry}
            className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white"
          >
            ลองใหม่
          </button>
        </div>
      )}
    </div>
  );
}
