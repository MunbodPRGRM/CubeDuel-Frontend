import {
  isValidElement,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { setPlayPref, type PipCorner } from '@/lib/play-prefs';

interface PipDockProps {
  /** มุมที่เกาะอยู่ — ค่าจาก `play-prefs` */
  corner: PipCorner;
  /** ย่อเหลือชิปหรือไม่ — ค่าจาก `play-prefs` · แผงข้างในต้องได้ค่าเดียวกันผ่าน prop `collapsed` */
  collapsed: boolean;
  /** แผง `PlayerCubePanel` หน้าตา `pip` ของคู่แข่งทุกคน เรียงตามที่นั่ง */
  panels: ReactNode[];
}

/** ขยับน้อยกว่านี้ = แตะ ไม่ใช่ลาก (นิ้วบนจอสัมผัสสั่นเล็กน้อยเสมอ) */
const DRAG_THRESHOLD_PX = 6;

/**
 * **ทุกห้องได้กล่องขนาดเดียวกับช่องของห้อง 4 คน** (เจ้าของสั่ง 2026-09-17 · ADR-081 ข้อ 2)
 * = หนึ่งในสามของแถวเต็มกรอบ → กล่องละ `(กรอบ − 2rem) / 3` (ขอบซ้ายขวา 0.5rem × 2 + ช่องไฟ 0.5rem × 2)
 * — 360 px ≈ 87 · 375 px ≈ 92 · 414 px ≈ 105 · `%` อ้างกรอบคิวบ์ เพราะกลุ่มเป็น absolute ในกรอบนั้น
 * ห้อง 4 คนไม่อยู่ในตารางนี้ — ใช้ `inset-x-2` เต็มแถวซึ่งได้ขนาดเดียวกันพอดี
 */
const DOCK_WIDTH: Record<number, string> = {
  1: 'w-[calc((100%_-_2rem)/3)]',
  2: 'w-[calc((100%_-_2rem)*2/3_+_0.5rem)]',
};

/**
 * **แผงคู่แข่งแบบ PiP บนจอแคบ** (ADR-081 ข้อ 2) — วางเป็น `overlay` ข้างในกรอบคิวบ์ของแผงเรา
 *
 * - ลากไปปล่อยแล้วดูดเข้ามุมที่ใกล้ที่สุด · ห้อง 4 คนตอนกางเต็มแถวเลือกได้แค่บน/ล่าง
 * - ปุ่ม `—` ย่อเหลือชิปต่อคน · แตะชิปหรือปุ่มขยายเพื่อกางคืน · ทั้งมุมและการย่อจำไว้ในเครื่อง
 *
 * ⚠️ ต้องเป็น **ลูกโดยตรงของกรอบคิวบ์** — ตอนปล่อยใช้ `parentElement` เป็นพื้นที่อ้างอิงหามุม
 * ⚠️ คิวบ์ในแผง `pip` ไม่รับนิ้ว (ลากกล้องคู่แข่งไม่ได้) — ไม่งั้นแยกการลากกล่องกับการหมุนกล้องไม่ออก
 */
export function PipDock({ corner, collapsed, panels }: PipDockProps) {
  const drag = useRef<{ pointerId: number; x: number; y: number; moved: boolean } | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);

  const top = corner.startsWith('top');
  const right = corner.endsWith('right');
  /** กางเต็มแถว (ห้อง 4 คน) — ความกว้างเต็มกรอบ จึงเลื่อนได้แค่แนวตั้ง */
  const fullRow = panels.length >= 3 && !collapsed;

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    if (!state.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    state.moved = true;
    setOffset({ x: fullRow ? 0 : dx, y: dy });
  };

  const finish = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    drag.current = null;
    setOffset(null);
    if (cancelled) return;

    // แตะเฉย ๆ บนชิป = กางคืน · แตะกล่องที่กางอยู่แล้วไม่ทำอะไร
    if (!state.moved) {
      if (collapsed) setPlayPref('pipCollapsed', false);
      return;
    }

    // ยังอยู่ในเฟรมเดียวกับที่ลาก — rect รวม transform ที่เลื่อนไปแล้ว
    const area = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!area) return;
    const box = event.currentTarget.getBoundingClientRect();
    const vertical = box.top + box.height / 2 < area.top + area.height / 2 ? 'top' : 'bottom';
    const horizontal = fullRow
      ? right
        ? 'right'
        : 'left'
      : box.left + box.width / 2 < area.left + area.width / 2
        ? 'left'
        : 'right';
    setPlayPref('pipCorner', `${vertical}-${horizontal}`);
  };

  const position = [
    top ? 'top-2' : 'bottom-2',
    fullRow ? 'inset-x-2' : right ? 'right-2' : 'left-2',
    collapsed ? `flex-col ${right ? 'items-end' : 'items-start'}` : right ? 'justify-end' : '',
    collapsed || fullRow ? '' : (DOCK_WIDTH[panels.length] ?? ''),
  ].join(' ');

  return (
    <div
      role="group"
      aria-label="แผงคู่แข่ง — ลากไปมุมอื่นได้"
      className={`absolute z-10 flex touch-none select-none gap-2 ${position} ${
        offset ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      style={offset ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => finish(event, false)}
      onPointerCancel={(event) => finish(event, true)}
    >
      {panels.map((panel, index) => (
        <div
          // ใช้ key ของแผง (userId) — ลำดับที่นั่งเปลี่ยนแล้วคิวบ์ต้องไม่ถูกสร้างใหม่
          key={isValidElement(panel) && panel.key !== null ? panel.key : index}
          className={collapsed ? 'min-w-0 max-w-full' : 'aspect-square min-w-0 max-w-48 flex-1'}
        >
          {panel}
        </div>
      ))}

      <button
        type="button"
        aria-label={collapsed ? 'ขยายแผงคู่แข่ง' : 'ย่อแผงคู่แข่ง'}
        // ปุ่มต้องไม่เริ่มการลากของกลุ่ม ไม่งั้น pointer capture จะกลืน click ของปุ่มไป
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => setPlayPref('pipCollapsed', !collapsed)}
        className={
          collapsed
            ? 'rounded-full border border-line bg-navy-850/95 px-2 py-1 text-[10px] text-slate-300 shadow-lg'
            : 'absolute -right-1.5 -top-1.5 z-20 grid h-6 w-6 place-items-center rounded-full border border-line bg-navy-850 text-slate-300 shadow-lg'
        }
      >
        {collapsed ? 'แสดงคิวบ์คู่แข่ง' : <MinimizeIcon />}
      </button>
    </div>
  );
}

function MinimizeIcon() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden>
      <path d="M2.5 6h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
