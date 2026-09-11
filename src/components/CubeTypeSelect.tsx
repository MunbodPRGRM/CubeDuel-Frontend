import { CUBE_TYPES, type CubeType } from '@/types/cube';
import { CUBE_TYPE_LABEL } from '@/types/leaderboard';

interface CubeTypeSelectProps {
  value: CubeType;
  onChange: (value: CubeType) => void;
  disabled?: boolean;
}

/**
 * เลือกประเภทรูบิคแบบ dropdown — ใช้ในแผงที่แคบ (ห้องฝึกซ้อม · ADR-059 ข้อ 6)
 *
 * ใช้ `<select>` ของเบราว์เซอร์ตรง ๆ ไม่เขียน listbox เอง — คีย์บอร์ด/screen reader ได้ฟรี
 * และบนมือถือ (เฟส 9) จะเปิดตัวเลือกแบบ native ของเครื่อง · สีของรายการที่กางออกมามืดตาม
 * `color-scheme: dark` ใน `styles/index.css` · หน้าอื่นยังใช้แท็บ `CubeTypePicker` เหมือนเดิม
 */
export function CubeTypeSelect({ value, onChange, disabled = false }: CubeTypeSelectProps) {
  return (
    <div className="relative">
      <select
        aria-label="เลือกประเภทรูบิค"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as CubeType)}
        className="w-full cursor-pointer appearance-none rounded-lg border border-line bg-navy-900/70 py-2 pl-3 pr-9 text-sm font-medium text-slate-100 transition hover:border-brand-500/60 focus:border-brand-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
      >
        {CUBE_TYPES.map((type) => (
          <option key={type} value={type}>
            {CUBE_TYPE_LABEL[type]}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
      >
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
}
