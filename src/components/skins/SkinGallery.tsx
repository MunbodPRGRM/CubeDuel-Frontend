import { CUBE_SKINS, type CubeSkin } from '@/cube';
import { SkinCubeIcon } from './SkinCubeIcon';
import { SkinSwatches } from './SkinSwatches';
import { skinCss } from './skin-css';

interface SkinGalleryProps {
  /** สกินที่กำลังดูในพรีวิว (อาจยังไม่ได้บันทึก) */
  value: string;
  /** สกินที่บันทึกไว้ในบัญชี — ได้ป้าย "ใช้อยู่" */
  savedId: string;
  onChange: (skinId: string) => void;
  /** จอแคบ: การ์ดเตี้ยสองคอลัมน์ (ADR-083 ข้อ 7) */
  compact?: boolean;
}

/**
 * การ์ดสกินทั้งหมด (ADR-080 ข้อ 5 · ADR-087)
 *
 * รูปบนการ์ดเป็น SVG จากจานสี + ลาย **ไม่มี WebGL** (ADR-080 ข้อ 3 · ADR-087 ข้อ 6) — ผิววัสดุ
 * (เงา/โลหะ/เรืองแสง) ดูที่พรีวิว 3 มิติตัวเดียวของหน้า · **ไม่มีตัวกรองหมวดแล้ว** สกินเหลือ 5 ตัว (ADR-087 ข้อ 1)
 */
export function SkinGallery({ value, savedId, onChange, compact = false }: SkinGalleryProps) {
  return (
    <div>
      <div
        className={compact ? 'grid grid-cols-2 gap-2' : 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3'}
      >
        {CUBE_SKINS.map((skin) => (
          <SkinCard
            key={skin.id}
            skin={skin}
            selected={skin.id === value}
            saved={skin.id === savedId}
            onSelect={() => onChange(skin.id)}
            compact={compact}
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
  compact,
}: {
  skin: CubeSkin;
  selected: boolean;
  saved: boolean;
  onSelect: () => void;
  /** การ์ดเตี้ย ไม่มีคำอธิบาย/ชิปสี — ตารางสองคอลัมน์ของจอแคบ (รายละเอียดดูที่พรีวิวด้านบน) */
  compact: boolean;
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
        className={`relative grid place-items-center ${compact ? 'h-24' : 'h-40'}`}
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
          size={compact ? 72 : 120}
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
        {!compact && (
          <span className="absolute right-2.5 top-2.5 rounded-md bg-navy-950/70 px-2 py-0.5 text-[11px] text-slate-400">
            {skin.tag}
          </span>
        )}
      </div>

      <div
        className={`flex flex-1 flex-col border-t border-line bg-navy-850 ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}
      >
        <p className={`font-semibold text-slate-100 ${compact ? 'truncate text-sm' : ''}`}>
          {skin.label}
        </p>
        {!compact && (
          <>
            <p className="mt-0.5 min-h-[2.5rem] text-xs leading-5 text-slate-500">{skin.hint}</p>
            <div className="mt-2">
              <SkinSwatches skin={skin} size="sm" />
            </div>
          </>
        )}
      </div>
    </button>
  );
}
