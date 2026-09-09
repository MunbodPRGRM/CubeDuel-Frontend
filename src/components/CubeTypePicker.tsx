import { CUBE_TYPES, type CubeType } from '@/types/cube';
import { CUBE_TYPE_LABEL } from '@/types/leaderboard';

interface CubeTypePickerProps {
  value: CubeType;
  onChange: (value: CubeType) => void;
  /** ล็อกไว้เปลี่ยนไม่ได้ — ใช้ตอนอยู่ในคิวจับคู่ (เปลี่ยนประเภทต้องออกจากคิวก่อน) */
  disabled?: boolean;
  /** ข้อความบอกเหตุผลตอนล็อก */
  disabledHint?: string;
}

/**
 * เลือกประเภทรูบิค
 *
 * ⚠️ ภาพดีไซน์ไม่ได้เผื่อช่องนี้ไว้ แต่ **จำเป็น** เพราะคะแนน Elo และสถิติ
 * แยกกันอิสระทั้ง 4 ประเภท (CLAUDE.md ข้อ 2) ถ้าไม่มี ตัวเลขบนหน้าจอจะกำกวมว่าเป็นของประเภทไหน
 */
export function CubeTypePicker({
  value,
  onChange,
  disabled = false,
  disabledHint,
}: CubeTypePickerProps) {
  return (
    <div
      role="tablist"
      aria-label="เลือกประเภทรูบิค"
      className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-navy-850/80 p-1"
    >
      {CUBE_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          role="tab"
          aria-selected={type === value}
          disabled={disabled}
          title={disabled ? disabledHint : undefined}
          onClick={() => onChange(type)}
          className={`rounded-lg px-3 py-1.5 text-sm transition disabled:cursor-not-allowed ${
            type === value
              ? 'bg-brand-500 font-semibold text-white disabled:bg-brand-500/50'
              : 'text-slate-400 hover:text-slate-200 disabled:text-slate-600 disabled:hover:text-slate-600'
          }`}
        >
          {CUBE_TYPE_LABEL[type]}
        </button>
      ))}
    </div>
  );
}
