import { useState } from 'react';
import { CUBE_SKINS, SKIN_CATEGORIES, type CubeSkin, type SkinCategory } from '@/cube';
import { SkinCubeIcon } from './SkinCubeIcon';
import { SkinSwatches } from './SkinSwatches';
import { skinCss } from './skin-css';

const CATEGORY_LABEL = Object.fromEntries(
  SKIN_CATEGORIES.map((category) => [category.id, category.label]),
) as Record<SkinCategory, string>;

interface SkinGalleryProps {
  /** สกินที่กำลังดูในพรีวิว (อาจยังไม่ได้บันทึก) */
  value: string;
  /** สกินที่บันทึกไว้ในบัญชี — ได้ป้าย "ใช้อยู่" */
  savedId: string;
  onChange: (skinId: string) => void;
}

/**
 * ตัวกรองหมวด + การ์ดสกินทั้งหมด (ADR-080 ข้อ 5)
 *
 * รูปบนการ์ดเป็น SVG จากจานสี **ไม่มี WebGL** (ข้อ 3) — หน้าตาจริงดูที่พรีวิวตัวเดียวของหน้า
 * ตัวกรองไม่จำข้ามการเปิดหน้า เพราะไม่ใช่ค่าตั้ง
 */
export function SkinGallery({ value, savedId, onChange }: SkinGalleryProps) {
  const [category, setCategory] = useState<SkinCategory | 'all'>('all');
  const skins =
    category === 'all' ? CUBE_SKINS : CUBE_SKINS.filter((skin) => skin.category === category);

  const filters: { id: SkinCategory | 'all'; label: string; count: number }[] = [
    { id: 'all', label: 'ทั้งหมด', count: CUBE_SKINS.length },
    ...SKIN_CATEGORIES.map((entry) => ({
      ...entry,
      count: CUBE_SKINS.filter((skin) => skin.category === entry.id).length,
    })),
  ];

  return (
    <div>
      <div role="group" aria-label="กรองตามหมวด" className="flex flex-wrap gap-2">
        {filters.map((filter) => {
          const active = filter.id === category;
          return (
            <button
              key={filter.id}
              type="button"
              aria-pressed={active}
              onClick={() => setCategory(filter.id)}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                active
                  ? 'border-brand-500 bg-brand-500/15 font-semibold text-brand-300'
                  : 'border-line bg-navy-850/80 text-slate-400 hover:border-slate-600 hover:text-slate-200'
              }`}
            >
              {filter.label}
              <span className="ml-1.5 text-xs text-slate-500">{filter.count}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {skins.map((skin) => (
          <SkinCard
            key={skin.id}
            skin={skin}
            selected={skin.id === value}
            saved={skin.id === savedId}
            onSelect={() => onChange(skin.id)}
          />
        ))}
      </div>
    </div>
  );
}

function SkinCard({
  skin,
  selected,
  saved,
  onSelect,
}: {
  skin: CubeSkin;
  selected: boolean;
  saved: boolean;
  onSelect: () => void;
}) {
  const { faceColors, bodyColor } = skin;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group flex flex-col overflow-hidden rounded-2xl border text-left transition ${
        selected
          ? 'border-brand-500 ring-2 ring-brand-500/40'
          : 'border-line hover:-translate-y-0.5 hover:border-slate-500'
      }`}
    >
      {/* พื้นหลังย้อมด้วยสีของสกินเอง — การ์ดแต่ละใบมีบรรยากาศของตัวเองโดยไม่ต้องมีรูปแยก */}
      <div
        className="relative grid h-40 place-items-center"
        style={{
          background: [
            `radial-gradient(circle at 25% 20%, ${skinCss(faceColors.U, 0.16)}, transparent 55%)`,
            `radial-gradient(circle at 80% 85%, ${skinCss(faceColors.R, 0.22)}, transparent 50%)`,
            `radial-gradient(circle at 15% 90%, ${skinCss(faceColors.F, 0.18)}, transparent 45%)`,
            skinCss(bodyColor),
          ].join(', '),
        }}
      >
        <SkinCubeIcon
          skin={skin}
          size={120}
          className="drop-shadow-[0_8px_16px_rgba(0,0,0,0.45)] transition group-hover:scale-105"
        />
        {saved && (
          <span className="absolute left-2.5 top-2.5 rounded-md border border-win/40 bg-navy-950/80 px-2 py-0.5 text-[11px] font-semibold text-win">
            ใช้อยู่
          </span>
        )}
        {selected && !saved && (
          <span className="absolute left-2.5 top-2.5 rounded-md border border-gold-400/40 bg-navy-950/80 px-2 py-0.5 text-[11px] font-semibold text-gold-400">
            กำลังลอง
          </span>
        )}
        <span className="absolute right-2.5 top-2.5 rounded-md bg-navy-950/70 px-2 py-0.5 text-[11px] text-slate-400">
          {CATEGORY_LABEL[skin.category]}
        </span>
      </div>

      <div className="flex flex-1 flex-col border-t border-line bg-navy-850 px-4 py-3">
        <p className="font-semibold text-slate-100">{skin.label}</p>
        <p className="mt-0.5 min-h-[2.5rem] text-xs leading-5 text-slate-500">{skin.hint}</p>
        <div className="mt-2">
          <SkinSwatches skin={skin} size="sm" />
        </div>
      </div>
    </button>
  );
}
