import type { ResolvedRoomLayout } from '@/lib/play-prefs';

interface LayoutThumbProps {
  layout: ResolvedRoomLayout;
  /** จำนวนคู่แข่งของห้องที่อยู่ (1–3) — วาดเป็นช่องย่อยตามจำนวนจริง */
  rivalCount: number;
  /** วาดหน้าตาบน **มือถือ** (จอแนวตั้ง) แทนจอ `lg` — ตอนนี้ใช้กับ `focus` ในการ์ด `auto` เท่านั้น */
  mobile?: boolean;
  className?: string;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const GAP = 2;
const PAD = 3;

/**
 * รูปตัวอย่างของ layout หน้าห้องในแผงเฟือง (ADR-081 ข้อ 3) — **วาดโครงด้วย SVG ไม่ใช่ภาพหน้าจอ**
 * รูปเดียววาดได้ทุกจำนวนคู่แข่ง · สีตามธีม · ไม่มีไฟล์ให้ถ่ายใหม่เมื่อหน้าห้องเปลี่ยน
 *
 * สัดส่วนเลียน `RoomStage` คร่าว ๆ พอให้แยกออกว่าแต่ละแบบต่างกันตรงไหน — **ไม่ต้องตรงเป๊ะ**
 * คิวบ์เรา = สีแบรนด์ · คู่แข่ง = เทา · ช่องข้อมูล = กล่องมีเส้นขีด
 */
export function LayoutThumb({
  layout,
  rivalCount,
  mobile = false,
  className = '',
}: LayoutThumbProps) {
  const count = Math.min(3, Math.max(1, rivalCount));
  const width = mobile ? 24 : 60;
  const height = 38;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <rect
        x={0.5}
        y={0.5}
        width={width - 1}
        height={height - 1}
        rx={3}
        className="fill-navy-900 stroke-line"
        strokeWidth={1}
      />
      {mobile ? <MobileFocus count={count} /> : <Wide layout={layout} count={count} />}
    </svg>
  );
}

function Wide({ layout, count }: { layout: ResolvedRoomLayout; count: number }) {
  const inner: Box = { x: PAD, y: PAD, w: 60 - PAD * 2, h: 38 - PAD * 2 };

  if (layout === 'classic') {
    // `1fr / 360px / 1fr` — คอลัมน์กลางแคบกว่าคิวบ์
    const col = (inner.w - GAP * 2) / 2.6;
    const info = inner.w - GAP * 2 - col * 2;
    return (
      <>
        <Self box={{ ...inner, w: col }} />
        <Info box={{ ...inner, x: inner.x + col + GAP, w: info }} />
        <Rivals box={{ ...inner, x: inner.x + col + info + GAP * 2, w: col }} count={count} />
      </>
    );
  }

  if (layout === 'sides') {
    // `1fr / 1fr / 22rem` — คิวบ์สองลูกเท่ากัน ข้อมูลขวาสุด
    const col = (inner.w - GAP * 2) / 2.8;
    const info = inner.w - GAP * 2 - col * 2;
    return (
      <>
        <Self box={{ ...inner, w: col }} />
        <Rivals box={{ ...inner, x: inner.x + col + GAP, w: col }} count={count} />
        <Info box={{ ...inner, x: inner.x + col * 2 + GAP * 2, w: info }} />
      </>
    );
  }

  const info = 14;
  const main = inner.w - GAP - info;
  const infoBox: Box = { ...inner, x: inner.x + main + GAP, w: info };

  if (layout === 'focus') {
    // จอ `lg`: แผงคู่แข่งซ้อนลงมาตามแนวตั้งที่มุมขวาบนของกล่องคิวบ์เรา
    const w = 12;
    const h = 7;
    return (
      <>
        <Self box={{ ...inner, w: main }} />
        {Array.from({ length: count }, (_, index) => (
          <Rival
            key={index}
            box={{ x: inner.x + main - w - 2, y: inner.y + 2 + index * (h + 1.5), w, h }}
            floating
          />
        ))}
        <Info box={infoBox} />
      </>
    );
  }

  // `stacked` — เราบน คู่แข่งล่าง ข้อมูลขวา
  const half = (inner.h - GAP) / 2;
  return (
    <>
      <Self box={{ ...inner, w: main, h: half }} />
      <Rivals box={{ ...inner, y: inner.y + half + GAP, w: main, h: half }} count={count} row />
      <Info box={infoBox} />
    </>
  );
}

/** มือถือ + `focus`: คิวบ์เราเต็มความกว้าง PiP ลอยใต้หัวแผง ช่องข้อมูลต่อลงมาข้างล่าง (ADR-081 ข้อ 2) */
function MobileFocus({ count }: { count: number }) {
  const self: Box = { x: PAD, y: PAD, w: 24 - PAD * 2, h: 24 };
  const top = self.y + 1.5;
  // ทุกห้องใช้ช่องขนาดหนึ่งในสามของแถว (ขนาดเดียวกับห้อง 4 คน) ชิดขวา — ตรงกับ `PipDock`
  const size = (self.w - 3 - 2) / 3;
  const pips: Box[] = Array.from({ length: count }, (_, index) => ({
    x: self.x + self.w - 1.5 - (count - index) * size - (count - index - 1),
    y: top,
    w: size,
    h: size,
  }));

  return (
    <>
      <Self box={self} />
      {pips.map((box, index) => (
        <Rival key={index} box={box} floating />
      ))}
      <Info
        box={{ x: PAD, y: self.y + self.h + GAP, w: self.w, h: 38 - PAD - (self.y + self.h + GAP) }}
      />
    </>
  );
}

function Self({ box }: { box: Box }) {
  return (
    <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={1.5} className="fill-brand-500/70" />
  );
}

function Rival({ box, floating = false }: { box: Box; floating?: boolean }) {
  return (
    <rect
      x={box.x}
      y={box.y}
      width={box.w}
      height={box.h}
      rx={1}
      // แผงที่ลอยทับคิวบ์เราต้องมีขอบเข้ม ไม่งั้นจะกลืนไปกับสีแบรนด์ข้างหลัง
      className={floating ? 'fill-slate-400 stroke-navy-900' : 'fill-slate-500/60'}
      strokeWidth={floating ? 0.8 : 0}
    />
  );
}

/** คอลัมน์คู่แข่ง — หลายคนแบ่งตามแนวตั้ง (หรือแนวนอนถ้า `row`) เท่า ๆ กัน */
function Rivals({ box, count, row = false }: { box: Box; count: number; row?: boolean }) {
  const gap = 1.5;
  const size = ((row ? box.w : box.h) - gap * (count - 1)) / count;
  return (
    <>
      {Array.from({ length: count }, (_, index) => {
        const offset = index * (size + gap);
        return (
          <Rival
            key={index}
            box={
              row
                ? { x: box.x + offset, y: box.y, w: size, h: box.h }
                : { x: box.x, y: box.y + offset, w: box.w, h: size }
            }
          />
        );
      })}
    </>
  );
}

function Info({ box }: { box: Box }) {
  const lines = box.h > 12 ? 3 : box.h > 7 ? 2 : 1;
  const pad = Math.min(2.5, box.w / 5);
  return (
    <>
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        rx={1.5}
        className="fill-navy-800 stroke-line"
        strokeWidth={0.6}
      />
      {Array.from({ length: lines }, (_, index) => (
        <line
          key={index}
          x1={box.x + pad}
          x2={box.x + box.w - pad - (index === lines - 1 ? box.w * 0.3 : 0)}
          y1={box.y + 3 + index * 3}
          y2={box.y + 3 + index * 3}
          className="stroke-slate-500"
          strokeWidth={1}
          strokeLinecap="round"
        />
      ))}
    </>
  );
}
