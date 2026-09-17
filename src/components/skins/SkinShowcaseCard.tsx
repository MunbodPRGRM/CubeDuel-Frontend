import { Link } from 'react-router-dom';
import { CUBE_SKINS, SKIN_CATEGORIES, getSkin } from '@/cube';
import { SkinCubeIcon } from './SkinCubeIcon';

/**
 * การ์ด "สกินคิวบ์" บนหน้าแรก — ทางเข้าหน้า `/skins` ที่เจ้าของเลือก (ADR-080 ข้อ 1)
 *
 * รูปเป็น SVG ทั้งหมด **ไม่มี WebGL บนหน้าแรก** · เรียงสกินของเราไว้หน้าสุด ตามด้วยหมวดละหนึ่งตัว
 * ให้เห็นว่ามีแบบไหนบ้างโดยไม่ต้องกดเข้าไป
 */
export function SkinShowcaseCard({
  skinId,
  compact = false,
}: {
  skinId: string | null | undefined;
  /** แถวเดียวทั้งแถวกดได้ — หน้าแรกจอแคบ (ADR-083 ข้อ 4) · ไม่มีคิวบ์ตัวอย่างหมวดอื่นและคำอธิบาย */
  compact?: boolean;
}) {
  const current = getSkin(skinId);

  if (compact) {
    return (
      <Link
        to="/skins"
        className="flex shrink-0 items-center gap-3 rounded-2xl border border-line-soft bg-navy-850 px-3 py-2 transition hover:border-brand-500/60"
      >
        <SkinCubeIcon skin={current} size={36} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate text-sm text-slate-100">
          <span className="block text-[11px] text-brand-400">สกินคิวบ์</span>
          ใช้อยู่: {current.label}
        </span>
        <span className="shrink-0 text-xs font-semibold text-brand-300">เลือกสกิน →</span>
      </Link>
    );
  }

  const samples = SKIN_CATEGORIES.map((category) =>
    CUBE_SKINS.find((skin) => skin.category === category.id && skin.id !== current.id),
  ).filter((skin) => skin !== undefined);

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-line bg-navy-850">
      <div className="flex flex-col gap-5 px-6 py-5 sm:flex-row sm:items-center">
        <div className="flex shrink-0 items-center" aria-hidden>
          <SkinCubeIcon
            skin={current}
            size={76}
            className="relative z-10 drop-shadow-[0_6px_12px_rgba(0,0,0,0.5)]"
          />
          {samples.map((skin, index) => (
            // ตัวหลังซ้อนใต้ตัวหน้า — ลำดับชั้นลดลงทีละขั้น
            <span
              key={skin.id}
              className="relative -ml-3"
              style={{ zIndex: samples.length - index }}
            >
              <SkinCubeIcon skin={skin} size={52} className="opacity-80" />
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs text-brand-400">สกินคิวบ์</p>
          <h2 className="mt-0.5 font-semibold text-slate-100">ใช้อยู่: {current.label}</h2>
          <p className="mt-1 text-sm text-slate-400">
            มีให้เลือก {CUBE_SKINS.length} แบบ ฟรีทั้งหมด · เปลี่ยนสีคิวบ์ 3 มิติทุกห้อง
            เห็นเฉพาะฝั่งคุณ
          </p>
        </div>

        <Link
          to="/skins"
          className="shrink-0 self-start rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 sm:self-auto"
        >
          เลือกสกิน →
        </Link>
      </div>
    </section>
  );
}
