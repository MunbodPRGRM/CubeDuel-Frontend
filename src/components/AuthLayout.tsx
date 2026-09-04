import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CubeLogo } from './CubeLogo';
import { LeaderboardCard } from './LeaderboardCard';

interface AuthLayoutProps {
  /** บรรทัดเล็กสีฟ้าเหนือหัวข้อ เช่น "ยินดีต้อนรับการกลับมา" */
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

/**
 * หน้าสมัคร/เข้าสู่ระบบ แบ่งครึ่งจอตามดีไซน์
 *   ซ้าย  — แบรนด์ + ข้อความชวนเล่น + กระดานอันดับ (ซ่อนบนจอเล็ก เหลือแค่โลโก้)
 *   ขวา   — ฟอร์ม พื้นเข้มกว่าอีกขั้นเพื่อดึงสายตา
 */
export function AuthLayout({ eyebrow, title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-navy-950 lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ---------- ซ้าย ---------- */}
      <section className="relative overflow-hidden bg-navy-900 px-6 py-8 lg:px-14 lg:py-12">
        {/* แสงฟุ้งมุมซ้ายบนตามดีไซน์ */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-brand-500/12 blur-3xl"
        />

        <div className="relative flex h-full flex-col">
          <Link to="/" className="flex w-fit items-center gap-3">
            <CubeLogo size={38} />
            <span className="text-xl font-bold tracking-tight text-white">CubeDuel</span>
          </Link>

          <div className="mt-10 hidden lg:mt-24 lg:block">
            <h1 className="text-4xl font-extrabold leading-[1.25] text-white xl:text-[2.75rem]">
              พร้อมท้าชนความเร็วหรือยัง?
              <br />
              ยินดีต้อนรับสิงห์<span className="text-brand-500">รูบิก</span>
              <br />
              เข้าสู่ระบบเลย!
            </h1>

            <p className="mt-8 max-w-lg text-sm leading-7 text-slate-400">
              นี่คือเว็บไซต์เกมแข่งรูบิกระหว่างผู้เล่นด้วยกันแบบเรียลไทม์
              <br />
              จับคู่, แก้รูบิกด้วยความรวดเร็ว, ไต่ระดับสู่อันดับ 1 หรือจะสร้างห้อง
              <br />
              เพื่อฝึกซ้อม, เล่นกับเพื่อนก็ทำได้
            </p>

            <div className="mt-12 max-w-lg">
              <LeaderboardCard cubeType="3x3x3" limit={5} />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- ขวา ---------- */}
      <section className="flex items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-md">
          <p className="text-sm font-medium text-brand-500">{eyebrow}</p>
          <h2 className="mt-1.5 text-2xl font-bold text-white">{title}</h2>
          <p className="mt-2 text-sm text-slate-400">{subtitle}</p>

          <div className="mt-8">{children}</div>

          <p className="mt-7 text-center text-sm text-slate-400">{footer}</p>
        </div>
      </section>
    </div>
  );
}
