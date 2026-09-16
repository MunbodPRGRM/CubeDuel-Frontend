import type { CubeSkin } from '@/cube';
import { skinCss } from './skin-css';

/**
 * ลูกบาศก์ 3×3 แบบไอโซเมตริกวาดด้วย SVG จากจานสีของสกิน (ADR-080 ข้อ 3)
 *
 * ไม่ใช่ภาพจาก renderer — ไม่มี WebGL · สกินใหม่ได้รูปเองทันที · คมทุกขนาด
 * หน้าที่ของรูปคือ **เทียบสีระหว่างสกิน** หน้าตาจริงดูที่พรีวิว 3 มิติของหน้า `/skins`
 *
 * เห็น 3 หน้า: U บน · F ซ้าย · R ขวา (ท่ามองเดียวกับคิวบ์ในเกมตอนเริ่ม)
 */

type Point3 = readonly [number, number, number];

const N = 3;
/** ช่องว่างระหว่างสติกเกอร์ (หน่วยเดียวกับขนาดช่อง = 1) — เผยเนื้อพลาสติกให้เห็นร่อง */
const GAP = 0.09;
const COS30 = Math.cos(Math.PI / 6);

/** ฉายจุด 3 มิติลงระนาบ — มองจากมุม (+x, +y, +z) · จอ y ชี้ลง */
function project([x, y, z]: Point3): string {
  return `${((x - y) * COS30).toFixed(3)},${((x + y) * 0.5 - z).toFixed(3)}`;
}

function polygon(points: Point3[]): string {
  return points.map(project).join(' ');
}

type Face = 'U' | 'F' | 'R';

/** มุมทั้งสี่ของช่อง (a, b) บนหน้าหนึ่ง · `lo`/`hi` คือขอบของช่องหลังหักร่องแล้ว */
function cell(face: Face, a: number, b: number): Point3[] {
  const lo = (v: number) => v + GAP;
  const hi = (v: number) => v + 1 - GAP;
  switch (face) {
    case 'U': // z = N · a = x · b = y
      return [
        [lo(a), lo(b), N],
        [hi(a), lo(b), N],
        [hi(a), hi(b), N],
        [lo(a), hi(b), N],
      ];
    case 'F': // y = N · a = x · b = z
      return [
        [lo(a), N, lo(b)],
        [hi(a), N, lo(b)],
        [hi(a), N, hi(b)],
        [lo(a), N, hi(b)],
      ];
    case 'R': // x = N · a = y · b = z
      return [
        [N, lo(a), lo(b)],
        [N, hi(a), lo(b)],
        [N, hi(a), hi(b)],
        [N, lo(a), hi(b)],
      ];
  }
}

const OUTLINE: Record<Face, Point3[]> = {
  U: [
    [0, 0, N],
    [N, 0, N],
    [N, N, N],
    [0, N, N],
  ],
  F: [
    [0, N, 0],
    [N, N, 0],
    [N, N, N],
    [0, N, N],
  ],
  R: [
    [N, 0, 0],
    [N, N, 0],
    [N, N, N],
    [N, 0, N],
  ],
};

/** เงาทับหน้าข้าง — แสงมาจากด้านบนซ้าย ให้ดูมีมิติโดยไม่ต้องคำนวณแสงจริง */
const SHADE: Record<Face, number> = { U: 0, F: 0.14, R: 0.3 };

const FACES: readonly Face[] = ['U', 'F', 'R'];
const CELLS = Array.from({ length: N * N }, (_, i) => [i % N, Math.floor(i / N)] as const);

interface SkinCubeIconProps {
  skin: CubeSkin;
  /** ความกว้าง = ความสูง (px) */
  size?: number;
  className?: string;
}

export function SkinCubeIcon({ skin, size = 96, className }: SkinCubeIconProps) {
  const body = skinCss(skin.bodyColor);
  return (
    <svg
      viewBox="-3.1 -3.25 6.2 6.5"
      width={size}
      height={size}
      className={className}
      aria-hidden
      focusable="false"
    >
      {FACES.map((face) => (
        <g key={face}>
          {/* เนื้อพลาสติก — เส้นขอบหนาโค้งมนทำให้มุมลูกไม่แหลม */}
          <polygon
            points={polygon(OUTLINE[face])}
            fill={body}
            stroke={body}
            strokeWidth={0.22}
            strokeLinejoin="round"
          />
          {CELLS.map(([a, b]) => {
            const color = skinCss(skin.faceColors[face]);
            return (
              <polygon
                key={`${a}-${b}`}
                points={polygon(cell(face, a, b))}
                fill={color}
                stroke={color}
                strokeWidth={0.07}
                strokeLinejoin="round"
              />
            );
          })}
          {SHADE[face] > 0 && (
            <polygon points={polygon(OUTLINE[face])} fill="#000" fillOpacity={SHADE[face]} />
          )}
        </g>
      ))}
    </svg>
  );
}
