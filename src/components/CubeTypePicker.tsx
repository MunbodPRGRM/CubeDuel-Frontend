import { CUBE_TYPES, type CubeType } from '@/types/cube';
import { CUBE_TYPE_LABEL } from '@/types/leaderboard';

interface CubeTypePickerProps {
  value: CubeType;
  onChange: (value: CubeType) => void;
}

/**
 * เลือกประเภทรูบิค
 *
 * ⚠️ ภาพดีไซน์ไม่ได้เผื่อช่องนี้ไว้ แต่ **จำเป็น** เพราะคะแนน Elo และสถิติ
 * แยกกันอิสระทั้ง 4 ประเภท (CLAUDE.md ข้อ 2) ถ้าไม่มี ตัวเลขบนหน้าจอจะกำกวมว่าเป็นของประเภทไหน
 */
export function CubeTypePicker({ value, onChange }: CubeTypePickerProps) {
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
          onClick={() => onChange(type)}
          className={`rounded-lg px-3 py-1.5 text-sm transition ${
            type === value
              ? 'bg-brand-500 font-semibold text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {CUBE_TYPE_LABEL[type]}
        </button>
      ))}
    </div>
  );
}
