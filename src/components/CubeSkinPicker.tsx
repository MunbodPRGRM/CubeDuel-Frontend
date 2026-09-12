import { CUBE_SKINS, type CubeSkin } from '@/cube';

/** แปลงเลขสีของ Three.js (0xRRGGBB) เป็นค่าสีของ CSS */
function css(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

const FACES = ['U', 'D', 'F', 'B', 'R', 'L'] as const;

/**
 * ชิปสี 6 หน้าของสกินหนึ่งตัว — เทียบสกินกันทั้งหมดได้ในสายตาเดียวโดยไม่ต้องสร้าง WebGL
 * สักตัว (ADR-064 ข้อ 2) · `/settings` เอาไปโชว์สกินที่ใช้อยู่แบบอ่านอย่างเดียว (ข้อ 5)
 */
export function SkinSwatches({ skin, size = 'md' }: { skin: CubeSkin; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-4 w-4 rounded' : 'h-5 w-5 rounded-md';
  return (
    <div className="flex gap-1.5">
      {FACES.map((face) => (
        <span
          key={face}
          title={`หน้า ${face}`}
          className={`${box} border border-black/40`}
          style={{ background: css(skin.faceColors[face]) }}
        />
      ))}
    </div>
  );
}

/**
 * เลือกสกินสีคิวบ์ — ใช้ในหน้า `/skins` (ADR-064) · ตัวเลือกเป็นชิปสีล้วน ไม่มีคิวบ์ 3 มิติในนี้
 * เพราะหน้านั้นมีพรีวิวตัวใหญ่ตัวเดียวอยู่แล้ว
 */
export function CubeSkinPicker({
  value,
  onChange,
  className = '',
}: {
  value: string;
  onChange: (skinId: string) => void;
  className?: string;
}) {
  return (
    <div className={`grid gap-2 ${className}`}>
      {CUBE_SKINS.map((skin) => (
        <SkinOption
          key={skin.id}
          skin={skin}
          selected={skin.id === value}
          onSelect={() => onChange(skin.id)}
        />
      ))}
    </div>
  );
}

function SkinOption({
  skin,
  selected,
  onSelect,
}: {
  skin: CubeSkin;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`rounded-xl border px-4 py-3 text-left transition ${
        selected
          ? 'border-brand-500/60 bg-brand-500/10'
          : 'border-line bg-navy-900/40 hover:border-slate-600'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-100">{skin.label}</span>
        {selected && <span className="text-xs text-brand-400">กำลังดูอยู่</span>}
      </div>
      <p className="mt-0.5 text-xs text-slate-500">{skin.hint}</p>
      <div className="mt-2.5">
        <SkinSwatches skin={skin} />
      </div>
    </button>
  );
}
