import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CameraMode, CubeOrientation } from '@/cube';
import { setPlayPref, usePlayPrefs, type RoomLayout } from '@/lib/play-prefs';
import type { CubeType } from '@/types/cube';

/** ประเภทที่พลิก "หน้า U ลงล่าง" ได้ — ต้องตรงกับ `ORIENTABLE_TYPES` ใน `ThreeCubeView` */
const ORIENTABLE: readonly CubeType[] = ['2x2x2', '3x3x3'];

const CAMERA_OPTIONS: { value: CameraMode; label: string; hint: string }[] = [
  { value: 'locked', label: 'ล็อก', hint: 'หมุนรอบแกนตั้ง ข้ามด้านบน/ล่างไม่ได้ — คิวบ์ไม่คว่ำ' },
  { value: 'free', label: 'อิสระ', hint: 'หมุนได้ทุกทิศ พลิกคิวบ์คว่ำได้' },
];

const ORIENTATION_OPTIONS: { value: CubeOrientation; label: string; hint: string }[] = [
  { value: 'top', label: 'บน', hint: 'หน้า U (ขาวในสกินมาตรฐาน) อยู่ด้านบนตามปกติ' },
  {
    value: 'bottom',
    label: 'ล่าง',
    hint: 'พลิกทั้งลูก 180° ให้หน้า U ไปอยู่ด้านล่าง — ด้านที่หันเข้าหาเรายังเป็นหน้าเดิม',
  },
];

const LAYOUT_OPTIONS: { value: RoomLayout; label: string; hint: string; duelOnly?: boolean }[] = [
  { value: 'auto', label: 'อัตโนมัติ', hint: 'จอกว้าง = แบบเดิม · จอแคบ = เราเด่น' },
  { value: 'classic', label: 'แบบเดิม', hint: 'สามคอลัมน์: เรา | ข้อมูล | คู่แข่ง' },
  { value: 'sides', label: 'ซ้าย-ขวา', hint: 'คิวบ์เราซ้าย คู่แข่งขวา · ข้อมูลคอลัมน์ขวา' },
  {
    value: 'focus',
    label: 'เราเด่น',
    hint: 'คิวบ์เราเต็มพื้นที่ · คู่แข่งมุมขวาบน · ข้อมูลคอลัมน์ขวา',
  },
  {
    value: 'stacked',
    label: 'บน-ล่าง',
    hint: 'คิวบ์เราบน คู่แข่งล่าง · ข้อมูลคอลัมน์ขวา',
    duelOnly: true,
  },
];

interface PlaySettingsMenuProps {
  /** ประเภทคิวบ์ที่กำลังเล่น — พีระมิดพลิกหน้า U ไม่ได้ (ADR-063 ข้อ 5) */
  cubeType: CubeType;
  /**
   * เปิดส่วน "การจัดวาง" — **ห้องฝึกซ้อมไม่ส่ง** เพราะไม่มีคู่แข่งให้จัดวาง
   * `allowStacked = false` (ห้อง 3–4 คน) ทำให้ตัวเลือกบน-ล่างกดไม่ได้ (ADR-063 ข้อ 3)
   */
  layout?: { allowStacked: boolean };
  className?: string;
}

/**
 * ปุ่มเฟือง + แผงตั้งค่าระหว่างเล่น (ADR-063 ข้อ 1) — ที่เดียวของทั้งแอปสำหรับ
 * มุมกล้องล็อก/อิสระ · หน้า U บน/ล่าง · การจัดวางหน้าห้อง
 *
 * เป็น popover ไม่ใช่ modal เพราะทุกตัวเลือกเห็นผลกับสิ่งที่อยู่ข้างหลังทันที
 * ฉากดำคลุมจอจะทำให้ตัดสินใจไม่ได้ว่าที่เลือกไปแล้วดีขึ้นหรือแย่ลง
 */
export function PlaySettingsMenu({ cubeType, layout, className = '' }: PlaySettingsMenuProps) {
  const prefs = usePlayPrefs();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    // `pointerdown` ไม่ใช่ `click` — ต้องปิดให้ทันก่อนที่ตัวคุมกล้องของคิวบ์จะเริ่มรับการลาก
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const orientable = ORIENTABLE.includes(cubeType);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
          open
            ? 'border-brand-500 bg-navy-800 text-slate-100'
            : 'border-line bg-navy-850 text-slate-300 hover:bg-navy-800 hover:text-slate-100'
        }`}
      >
        <GearIcon />
        ตั้งค่าการเล่น
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="ตั้งค่าการเล่น"
          className="absolute right-0 top-full z-40 mt-2 max-h-[70dvh] w-[19rem] divide-y divide-line-soft overflow-y-auto rounded-2xl border border-line bg-navy-850 p-4 shadow-2xl"
        >
          <Section title="มุมกล้อง">
            <Segmented
              ariaLabel="โหมดหมุนกล้อง"
              options={CAMERA_OPTIONS}
              value={prefs.cameraMode}
              onChange={(value) => setPlayPref('cameraMode', value)}
            />
          </Section>

          <Section
            title="หน้า U อยู่ด้าน"
            note={
              orientable
                ? 'เปลี่ยนแค่ภาพที่เห็น — ท่าที่หมุนยังเป็นโน้ตเทชันมาตรฐานเหมือนเดิม'
                : 'ใช้ได้กับ 2x2x2 และ 3x3x3 เท่านั้น (ทรงพีระมิดไม่มีหน้า U ให้พลิก)'
            }
          >
            <Segmented
              ariaLabel="ทิศของภาพคิวบ์"
              options={ORIENTATION_OPTIONS}
              value={prefs.cubeOrientation}
              onChange={(value) => setPlayPref('cubeOrientation', value)}
              disabled={!orientable}
            />
          </Section>

          {layout && (
            <Section title="การจัดวาง" note="จำไว้ในเครื่องนี้ ใช้กับทุกห้องที่เข้าต่อจากนี้">
              <div role="radiogroup" aria-label="การจัดวางหน้าห้อง" className="grid gap-1.5">
                {LAYOUT_OPTIONS.map((option) => {
                  const blocked = option.duelOnly === true && !layout.allowStacked;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={prefs.roomLayout === option.value}
                      disabled={blocked}
                      onClick={() => setPlayPref('roomLayout', option.value)}
                      className={`rounded-xl border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        prefs.roomLayout === option.value
                          ? 'border-brand-500 bg-brand-500/10'
                          : 'border-line-soft hover:border-line hover:bg-navy-800/60'
                      }`}
                    >
                      <span className="block text-sm text-slate-100">{option.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">
                        {blocked ? 'ใช้ได้กับห้อง 1 ต่อ 1 เท่านั้น' : option.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="py-3 first:pt-0 last:pb-0">
      <p className="text-xs font-semibold tracking-wide text-slate-400">{title}</p>
      <div className="mt-2">{children}</div>
      {note && <p className="mt-2 text-[11px] leading-4 text-slate-500">{note}</p>}
    </section>
  );
}

/** แถวตัวเลือกสองตัวแบบปุ่มติดกัน — ใช้กับทั้งมุมกล้องและทิศของภาพ */
function Segmented<T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
  disabled = false,
}: {
  ariaLabel: string;
  options: { value: T; label: string; hint: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`grid grid-cols-2 gap-1 rounded-xl bg-navy-900/70 p-1 ${
        disabled ? 'opacity-40' : ''
      }`}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          title={option.hint}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={`rounded-lg px-3 py-1.5 text-xs transition disabled:cursor-not-allowed ${
            value === option.value
              ? 'bg-brand-500 font-semibold text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
