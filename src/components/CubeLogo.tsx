/**
 * โลโก้รูบิคทรงไอโซเมตริก — วาดด้วย SVG ล้วน ไม่พึ่งไฟล์ภาพ
 * (คิวบ์ 3 มิติของจริงเป็นงานเฟส 3 — ตัวนี้เป็นแค่ภาพนิ่งประกอบหน้าจอ)
 *
 * หลักการวาด: หน้าละ 3×3 ช่อง แปลงพิกัดตารางเป็นพิกัดจริงด้วยเวกเตอร์ของแต่ละหน้า
 * ทำให้ปรับจำนวนช่องหรือขนาดได้โดยไม่ต้องไล่แก้จุดทีละจุด
 */

/**
 * จุดยอดของคิวบ์ไอโซเมตริกในกรอบ 100×100:
 *   บน (50,6) · ซ้าย (6.5,31.2) · ขวา (93.5,31.2) · หน้า (50,56.4) · ล่างสุด (50,94)
 * แต่ละหน้าเก็บ "มุมเริ่ม + เวกเตอร์ขอบสองด้าน" แล้วหารสามเอาเป็นช่องย่อย
 */
const FACELETS = {
  top: { origin: [50, 6], dx: [43.5, 25.2], dy: [-43.5, 25.2] },
  left: { origin: [6.5, 31.2], dx: [43.5, 25.2], dy: [0, 37.6] },
  right: { origin: [50, 56.4], dx: [43.5, -25.2], dy: [0, 37.6] },
} as const;

const COLORS = {
  top: [
    '#f8fafc',
    '#ef4444',
    '#3b82f6',
    '#f59e0b',
    '#f8fafc',
    '#22c55e',
    '#3b82f6',
    '#f8fafc',
    '#ef4444',
  ],
  left: [
    '#22c55e',
    '#f59e0b',
    '#f8fafc',
    '#ef4444',
    '#22c55e',
    '#3b82f6',
    '#f59e0b',
    '#ef4444',
    '#22c55e',
  ],
  right: [
    '#3b82f6',
    '#f8fafc',
    '#f59e0b',
    '#22c55e',
    '#ef4444',
    '#f8fafc',
    '#ef4444',
    '#3b82f6',
    '#f59e0b',
  ],
} as const;

function face(name: keyof typeof FACELETS) {
  const { origin, dx, dy } = FACELETS[name];
  const cells = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      // มุมทั้งสี่ของช่อง (col,row) = origin + col*dx + row*dy แล้วขยับไปอีก 1 หน่วยในแต่ละแกน
      const corner = (c: number, r: number) => [
        origin[0] + c * (dx[0] / 3) + r * (dy[0] / 3),
        origin[1] + c * (dx[1] / 3) + r * (dy[1] / 3),
      ];
      const pts = [
        corner(col, row),
        corner(col + 1, row),
        corner(col + 1, row + 1),
        corner(col, row + 1),
      ];
      cells.push({
        key: `${name}-${row}-${col}`,
        points: pts.map((p) => p.join(',')).join(' '),
        fill: COLORS[name][row * 3 + col],
      });
    }
  }
  return cells;
}

const ALL_CELLS = [...face('top'), ...face('left'), ...face('right')];

export function CubeLogo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="โลโก้ CubeDuel"
    >
      {ALL_CELLS.map((c) => (
        <polygon
          key={c.key}
          points={c.points}
          fill={c.fill}
          stroke="#0b1220"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
