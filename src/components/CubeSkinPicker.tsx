import { CUBE_SKINS, type CubeSkin } from '@/cube';

/** แปลงเลขสีของ Three.js (0xRRGGBB) เป็นค่าสีของ CSS */
function css(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

/**
 * เลือกสกินสีคิวบ์ — ดีไซน์หน้าตั้งค่าไม่มีส่วนนี้ (ADR-024 ว่าด้วยของที่ดีไซน์ไม่ได้เผื่อไว้)
 * จึงวางเป็นการ์ดต่อจากช่องชื่อเล่น พร้อมชิปสีของแต่ละสกินให้เทียบกันเห็น ๆ
 */
export function CubeSkinPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (skinId: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
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
        {selected && <span className="text-xs text-brand-400">เลือกอยู่</span>}
      </div>
      <p className="mt-0.5 text-xs text-slate-500">{skin.hint}</p>
      <div className="mt-2.5 flex gap-1.5">
        {(['U', 'D', 'F', 'B', 'R', 'L'] as const).map((face) => (
          <span
            key={face}
            title={`หน้า ${face}`}
            className="h-5 w-5 rounded-md border border-black/40"
            style={{ background: css(skin.faceColors[face]) }}
          />
        ))}
      </div>
    </button>
  );
}
