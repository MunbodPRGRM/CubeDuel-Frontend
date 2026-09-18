import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { CubeTypeImage } from '@/components/CubeTypeImage';
import { CubeTypeSelect } from '@/components/CubeTypeSelect';
import { SkinShowcaseCard } from '@/components/skins/SkinShowcaseCard';
import { useApiPage } from '@/hooks/useApiPage';
import { formatSolveTime, formatWinRate } from '@/lib/format';
import { QueuePanel } from '@/queue/QueuePanel';
import { useQueue } from '@/socket/useQueue';
import type { CubeType } from '@/types/cube';
import type { UserRating } from '@/types/leaderboard';
import type { NewsListItem } from '@/types/news';

interface MobileHomeProps {
  skinId: string | null | undefined;
  cubeType: CubeType;
  onCubeTypeChange: (value: CubeType) => void;
  rating: UserRating | undefined;
  /** `undefined` = ยังโหลดไม่เสร็จ · `null` = แก้ยังไม่ครบ 5 ครั้ง */
  ao5: number | null | undefined;
}

/**
 * **หน้าแรกของจอแคบ** (ADR-083 ข้อ 4) — ทุกอย่างที่ต้องใช้บ่อยจบในจอเดียว ไม่ต้องเลื่อน
 *
 * dropdown ประเภท → การ์ดคะแนน → สกิน → ปุ่มห้อง → ข่าวล่าสุด · ประวัติ/กระดานอันดับ/ข่าวเต็มอยู่ในแท็บของมันเอง
 * ข้อมูลคะแนนรับมาจาก `HomePage` (ยิง API ที่เดียว) · คิวใช้ `useQueue` ตัวเดิม **ตรรกะเหมือนการ์ดหลักจอกว้างทุกอย่าง**
 * ความสูงเป็น `min-h-app` ไม่ใช่ `h-app` — จอเตี้ยที่ใส่ไม่พอให้หน้าเลื่อนแทนการบีบจนตัวหนังสือซ้อน (ADR-083 ข้อ 8)
 */
export function MobileHome({ skinId, cubeType, onCubeTypeChange, rating, ao5 }: MobileHomeProps) {
  const queue = useQueue();
  // `ready_check` ยังนับว่าอยู่ในคิว (ADR-077 ข้อ 4) — เหตุผลเดียวกับ `HeroCard` ของจอกว้าง
  const queuing = queue.phase === 'queued' || queue.phase === 'ready_check';
  const queuingMulti = queuing && queue.kind === 'multiplayer';
  // ข้อความหมดเวลารอ/ข้อผิดพลาดของคิว — `QueuePanel` วาดเองเมื่อเป็นสองกรณีนี้ · วางแทนแถวข่าว
  const queueNotice = queue.phase === 'timeout' || (!queuing && queue.error !== null);

  return (
    <div className="flex min-h-app flex-col bg-navy-900">
      <AppHeader />

      <main className="flex flex-1 flex-col gap-3 px-4 pt-3 pb-4">
        {/* dropdown ตัวเดียวกับการ์ดหลักจอกว้าง · แถวของตัวเองเต็มความกว้าง (เจ้าของสั่ง · ADR-083 ข้อ 4.2)
            เปลี่ยนประเภทระหว่างอยู่ในคิวไม่ได้ — server ตอบ `E_ALREADY_IN_QUEUE` (socket-events.md ข้อ 4) */}
        <div className="shrink-0">
          <CubeTypeSelect
            value={cubeType}
            onChange={onCubeTypeChange}
            disabled={queuing}
            disabledHint="ออกจากคิวก่อนจึงจะเปลี่ยนประเภทได้"
          />
        </div>

        <section className="flex shrink-0 items-center gap-3 rounded-2xl border border-line bg-navy-850 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[11px] font-semibold tracking-widest text-slate-400">ELO</span>
              <span className="tabular text-3xl font-bold text-brand-400">
                {rating ? rating.eloRating : '—'}
              </span>
              {rating && <span className="text-xs text-slate-400">อันดับที่ {rating.rank}</span>}
            </p>
            <dl className="mt-1 flex flex-wrap gap-x-2.5 text-[11px] text-slate-400">
              <Stat label="ดีที่สุด" value={formatSolveTime(rating?.bestTime)} />
              <Stat label="เฉลี่ย 5" value={formatSolveTime(ao5)} />
              <Stat
                label="ชนะ"
                value={rating && rating.matchesPlayed > 0 ? formatWinRate(rating.winRate) : '—'}
              />
            </dl>
          </div>
          <CubeTypeImage cubeType={cubeType} size={64} className="shrink-0" />
        </section>

        <SkinShowcaseCard skinId={skinId} compact />

        {queuing ? (
          <section className="flex max-h-80 min-h-56 flex-1 flex-col gap-3 rounded-2xl border border-brand-500/40 bg-navy-850 p-4">
            {/* คิวสองช่องใช้แผงเดียวกัน · ช่วง `ready_check` แผงว่าง — หน้าต่างยืนยันเด้งทับอยู่แล้ว */}
            <QueuePanel className="" />
            <button
              type="button"
              disabled={queue.busy}
              onClick={() => void queue.leave()}
              className="mt-auto rounded-xl border border-line bg-navy-800 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {queuingMulti ? '✕ ยกเลิกการรวมกลุ่ม' : '✕ ยกเลิกการจับคู่'}
            </button>
          </section>
        ) : (
          <nav
            aria-label="เลือกห้อง"
            className="grid max-h-80 flex-1 grid-cols-2 grid-rows-[minmax(3.75rem,0.8fr)_repeat(2,minmax(auto,1fr))] gap-2.5"
          >
            <button
              type="button"
              disabled={queue.busy}
              onClick={() => void queue.join(cubeType, 'competitive')}
              className="col-span-2 flex items-center gap-3 rounded-2xl border border-brand-400 bg-brand-500 px-4 py-2.5 text-left text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <TileIcon primary>
                <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
              </TileIcon>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold">จับคู่</span>
                <span className="block truncate text-xs text-blue-100">
                  1 ต่อ 1 กับผู้เล่นระดับใกล้เคียง · มีผล ELO
                </span>
              </span>
              <span aria-hidden className="text-xl">
                ›
              </span>
            </button>
            {/* คิวคนละช่องกับ 1v1 โดยสิ้นเชิง (เฟส 6) */}
            <Tile
              title="ห้องหลายคน (3–4)"
              note="แข่งพร้อมกัน · Pairwise ELO"
              disabled={queue.busy}
              onClick={() => void queue.join(cubeType, 'multiplayer')}
              icon={
                <>
                  <circle cx="9" cy="8" r="3.5" />
                  <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
                  <circle cx="17" cy="9" r="2.5" />
                  <path d="M17 14a5 5 0 0 1 5 5" />
                </>
              }
            />
            <Tile
              title="ฝึกซ้อม"
              note="คนเดียว · ไม่บันทึกผล"
              to="/practice"
              icon={
                <>
                  <circle cx="12" cy="13" r="8" />
                  <path d="M12 9v4l2.5 2M9 2h6" />
                </>
              }
            />
            <Tile
              title="สร้างห้อง"
              note="เล่นกับเพื่อน · ไม่มีผล ELO"
              to="/room/new"
              icon={<path d="M12 5v14M5 12h14" />}
            />
            <Tile
              title="ใส่เลขห้อง"
              note="เข้าเป็นผู้เล่นหรือผู้ชม"
              to="/room/join"
              icon={<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />}
            />
          </nav>
        )}

        {queueNotice ? <QueuePanel className="" /> : <LatestNewsLine />}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1">
      <dt>{label}</dt>
      <dd className="tabular font-semibold text-slate-100">{value}</dd>
    </div>
  );
}

function TileIcon({ children, primary = false }: { children: ReactNode; primary?: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
        primary ? 'bg-white/20 text-white' : 'bg-navy-950 text-brand-400'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </span>
  );
}

type TileProps = { title: string; note: string; icon: ReactNode } & (
  | { to: string; onClick?: never; disabled?: never }
  | { to?: never; onClick: () => void; disabled: boolean }
);

/** ปุ่มห้องในตาราง 2×2 — ลิงก์ไปหน้าอื่น หรือปุ่มเข้าคิว หน้าตาเดียวกัน */
function Tile({ title, note, icon, to, onClick, disabled }: TileProps) {
  const className =
    'flex min-h-0 flex-col justify-between gap-1.5 overflow-hidden rounded-2xl border border-line bg-navy-800 p-2.5 text-left transition hover:border-brand-500/60 disabled:cursor-not-allowed disabled:opacity-50';
  const body = (
    <>
      <TileIcon>{icon}</TileIcon>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-slate-100">{title}</span>
        <span className="block truncate text-[11px] text-slate-400">{note}</span>
      </span>
    </>
  );

  return to ? (
    <Link to={to} className={className}>
      {body}
    </Link>
  ) : (
    <button type="button" disabled={disabled} onClick={onClick} className={className}>
      {body}
    </button>
  );
}

/**
 * ข่าวล่าสุดบรรทัดเดียว — ไม่มีข่าวเลย = ไม่แสดงอะไร (เหมือน `LatestNewsCard` ของจอกว้าง)
 * จอเตี้ยกว่า 44rem (~700 px) ซ่อน — ปุ่มห้องสำคัญกว่า ข่าวยังเข้าได้จากแท็บข่าวสาร (ADR-083 ข้อ 8)
 */
function LatestNewsLine() {
  const news = useApiPage<NewsListItem>('/news?page=1&limit=1');
  const item = news.data?.[0];
  if (!item) return null;

  return (
    <Link
      to={`/news/${item.newsId}`}
      className="flex shrink-0 items-center gap-2.5 rounded-xl border border-line-soft bg-navy-850 px-3 py-2.5 text-sm transition hover:border-brand-500/60 [@media(max-height:44rem)]:hidden"
    >
      <span className="shrink-0 rounded-full bg-gold-400/15 px-2 py-0.5 text-[11px] font-bold text-gold-400">
        ข่าวล่าสุด
      </span>
      <span className="min-w-0 flex-1 truncate text-slate-200">{item.title}</span>
      <span aria-hidden className="text-slate-500">
        ›
      </span>
    </Link>
  );
}
