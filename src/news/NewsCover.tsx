import { newsCoverStyle } from './news-covers';

type NewsCoverSize = 'thumb' | 'card' | 'hero' | 'tile';

/** ขนาดกรอบ + ไอคอน + ป้าย ต่อขนาด (ADR-084 ข้อ 4) */
const SIZES: Record<NewsCoverSize, { box: string; icon: string; label: string | null }> = {
  // การ์ดข่าวย่อ 64×64 — ป้ายไม่พอที่ ไอคอน + สีบอกหมวดแทน
  thumb: { box: 'h-16 w-16 rounded-xl', icon: 'h-7 w-7', label: null },
  card: { box: 'h-24 w-32 rounded-xl', icon: 'h-9 w-9', label: 'text-[10px] px-1.5 py-0.5' },
  hero: {
    box: 'aspect-[21/9] w-full',
    icon: 'h-16 w-16 sm:h-20 sm:w-20',
    label: 'text-xs px-2.5 py-1',
  },
  // ช่องเลือกปกในฟอร์มแอดมิน — กว้างตามช่องตาราง · ชื่อปกพิมพ์ใต้ช่องแทนป้าย
  tile: { box: 'aspect-[4/3] w-full rounded-lg', icon: 'h-8 w-8', label: null },
};

/**
 * ปกข่าวที่เว็บวาดเอง — HTML/CSS + SVG ล้วน ไม่มีไฟล์ภาพ (ADR-084)
 *
 * **ไม่มีชื่อข่าวบนปก** — ที่ใช้ปกทุกที่แสดงชื่อข้าง ๆ อยู่แล้ว
 * ป้ายหมวดอยู่ใน `aria-label` ด้วยเสมอ (ขนาด `thumb` ไม่มีป้ายให้เห็น) · สีไม่ใช่ทางเดียวที่บอกหมวด — ไอคอนต่างกันทุกแบบ
 */
export function NewsCover({
  cover,
  size,
  className = '',
}: {
  cover: string;
  size: NewsCoverSize;
  className?: string;
}) {
  const style = newsCoverStyle(cover);
  const dims = SIZES[size];

  return (
    <span
      role="img"
      aria-label={`ปกข่าว: ${style.label}`}
      className={`relative grid shrink-0 place-items-center overflow-hidden border border-line ${style.surface} ${dims.box} ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className={`${dims.icon} ${style.ink}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {style.icon.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
      {dims.label && (
        <span
          aria-hidden
          className={`absolute bottom-1.5 left-1.5 rounded-md bg-navy-950/70 font-semibold ${style.ink} ${dims.label}`}
        >
          {style.label}
        </span>
      )}
    </span>
  );
}
