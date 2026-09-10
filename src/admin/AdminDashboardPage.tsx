import { Link } from 'react-router-dom';
import { useApiData } from '@/hooks/useApiData';
import { StatCard } from '@/components/StatCard';
import { CUBE_TYPE_LABEL } from '@/types/leaderboard';
import type { CubeType } from '@/types/cube';
import type { AdminDashboard } from '@/types/admin';
import { AdminLayout, AdminNotice } from './AdminLayout';

/** แดชบอร์ดแอดมิน (`GET /admin/dashboard` — api-contract.md ข้อ 9) */
export default function AdminDashboardPage() {
  const dash = useApiData<AdminDashboard>('/admin/dashboard');
  const d = dash.data;

  return (
    <AdminLayout title="แดชบอร์ด" description="ภาพรวมของระบบ ณ ตอนนี้">
      {dash.loading && <AdminNotice>กำลังโหลด…</AdminNotice>}
      {dash.error && <AdminNotice tone="error">{dash.error}</AdminNotice>}

      {d && (
        <>
          {/* ---------------- สองตัวแรกเป็นค่า ณ วินาทีนี้ (มาจาก memory ของ Socket.IO) */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="ห้องที่เปิดอยู่" value={String(d.activeRooms)} accent />
            <StatCard
              label="ผู้เล่นออนไลน์"
              value={String(d.onlineUsers)}
              note="นับคน ไม่ใช่จำนวนแท็บ"
            />
            <StatCard label="สมาชิกทั้งหมด" value={d.totalUsers.toLocaleString('th-TH')} />
            <StatCard label="แมตช์วันนี้" value={String(d.matchesToday)} note="ตามวันไทย" />
          </div>

          {/* ---------------- คิวงานที่แอดมินต้องจัดการ กดแล้วไปหน้านั้นเลย */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <QueueCard
              to="/admin/reports"
              label="รายงานที่รอตรวจ"
              count={d.pendingReports}
              empty="ไม่มีรายงานค้าง"
            />
            <QueueCard
              to="/admin/flags"
              label="แมตช์ที่ระบบสงสัย"
              count={d.flaggedMatches}
              empty="ไม่มี flag ค้าง"
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <WeeklyChart values={d.matchesLast7Days} />
            <CubeTypeBreakdown byCubeType={d.byCubeType} total={d.matchesToday} />
          </div>
        </>
      )}
    </AdminLayout>
  );
}

function QueueCard({
  to,
  label,
  count,
  empty,
}: {
  to: string;
  label: string;
  count: number;
  empty: string;
}) {
  return (
    <Link
      to={to}
      className={`flex items-center justify-between rounded-2xl border px-5 py-4 transition ${
        count > 0
          ? 'border-gold-400/40 bg-gold-400/5 hover:bg-gold-400/10'
          : 'border-line bg-navy-850/80 hover:bg-navy-850'
      }`}
    >
      <div>
        <p className="text-sm text-slate-300">{label}</p>
        <p className="mt-0.5 text-xs text-slate-500">{count > 0 ? 'กดเพื่อเปิดรายการ' : empty}</p>
      </div>
      <span
        className={`tabular text-3xl font-bold ${count > 0 ? 'text-gold-400' : 'text-slate-600'}`}
      >
        {count}
      </span>
    </Link>
  );
}

/**
 * กราฟแท่ง 7 วันแบบวาดด้วย div ล้วน — ไม่ลากไลบรารีกราฟเข้ามาเพื่อกราฟเดียวในทั้งโปรเจกต์
 * (`matchesLast7Days` เรียงเก่า → ใหม่ ตัวสุดท้ายคือวันนี้ — api-contract.md ข้อ 9)
 */
function WeeklyChart({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const today = new Date();

  return (
    <section className="rounded-2xl border border-line bg-navy-850/80 px-5 py-4">
      <h2 className="text-sm font-semibold text-slate-200">แมตช์ 7 วันล่าสุด</h2>
      <div className="mt-4 flex h-40 items-end gap-2">
        {values.map((value, index) => {
          const day = new Date(today);
          day.setDate(today.getDate() - (values.length - 1 - index));
          const isToday = index === values.length - 1;
          return (
            <div key={index} className="flex h-full flex-1 flex-col items-center gap-1.5">
              <span className="tabular text-xs text-slate-400">{value}</span>
              {/* แท่งต้องอยู่ในกล่องที่มีความสูงแน่นอน (flex-1) ไม่งั้น height เป็น % จะไม่มีผล */}
              <div className="flex w-full flex-1 items-end">
                <div
                  className={`w-full rounded-t-md ${isToday ? 'bg-brand-500' : 'bg-brand-500/35'}`}
                  style={{ height: `${Math.max(3, (value / max) * 100)}%` }}
                />
              </div>
              <span className="text-[11px] text-slate-500">
                {day.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CubeTypeBreakdown({
  byCubeType,
  total,
}: {
  byCubeType: Record<CubeType, number>;
  total: number;
}) {
  const rows = Object.entries(byCubeType) as [CubeType, number][];

  return (
    <section className="rounded-2xl border border-line bg-navy-850/80 px-5 py-4">
      <h2 className="text-sm font-semibold text-slate-200">แมตช์วันนี้ แยกตามประเภท</h2>
      {total === 0 ? (
        <p className="mt-4 text-sm text-slate-500">วันนี้ยังไม่มีแมตช์</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {rows.map(([cubeType, count]) => (
            <li key={cubeType}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-slate-300">{CUBE_TYPE_LABEL[cubeType]}</span>
                <span className="tabular text-slate-400">{count}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-navy-900">
                <div
                  className="h-full rounded-full bg-brand-500/70"
                  style={{ width: `${(count / total) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
