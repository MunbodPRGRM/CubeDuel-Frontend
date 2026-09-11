import type { CameraMode } from '@/cube';
import { setPlayPref, usePlayPrefs } from '@/lib/play-prefs';

const OPTIONS: { mode: CameraMode; label: string; hint: string }[] = [
  { mode: 'locked', label: 'ล็อก', hint: 'หมุนรอบแกนตั้ง ข้ามด้านบน/ล่างไม่ได้ — คิวบ์ไม่คว่ำ' },
  { mode: 'free', label: 'อิสระ', hint: 'หมุนได้ทุกทิศ พลิกคิวบ์คว่ำได้' },
];

/**
 * สลับโหมดหมุนกล้อง ล็อก/อิสระ — มีผลกับคิวบ์ **ทุกลูกในแอป** ทันที และจำไว้ในเครื่องนี้ (ADR-061)
 *
 * ⚙️ ชั่วคราว: ก้อนที่ 6 ของเฟส 12 จะย้ายเข้าแผงตั้งค่าที่เปิดจากปุ่มเฟือง
 */
export function CameraModeToggle({ className = '' }: { className?: string }) {
  const { cameraMode } = usePlayPrefs();

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border border-line-soft px-3 py-2 ${className}`}
    >
      <span className="text-sm text-slate-300">มุมกล้อง</span>
      <div
        role="radiogroup"
        aria-label="โหมดหมุนกล้อง"
        className="inline-flex gap-1 rounded-lg bg-navy-900/70 p-0.5"
      >
        {OPTIONS.map(({ mode, label, hint }) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={cameraMode === mode}
            title={hint}
            onClick={() => setPlayPref('cameraMode', mode)}
            className={`rounded-md px-3 py-1 text-xs transition ${
              cameraMode === mode
                ? 'bg-brand-500 font-semibold text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
