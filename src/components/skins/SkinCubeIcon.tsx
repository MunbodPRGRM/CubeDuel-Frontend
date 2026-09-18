import { useId } from 'react';
import { PATTERN_TILE_WORLD, renderPattern, type CubeSkin, type PatternKind } from '@/cube';
import { skinCss } from './skin-css';

/**
 * ลูกบาศก์ 3×3 แบบไอโซเมตริกวาดด้วย SVG จากจานสีของสกิน (ADR-080 ข้อ 3)
 *
 * ไม่ใช่ภาพจาก renderer — ไม่มี WebGL · สกินใหม่ได้รูปเองทันที · คมทุกขนาด
 * หน้าที่ของรูปคือ **เทียบสีและลายระหว่างสกิน** ผิววัสดุ (เงา/โลหะ/เรือง) ดูที่พรีวิว 3 มิติของหน้า `/skins`
 *
 * เห็น 3 หน้า: U บน · F ซ้าย · R ขวา (ท่ามองเดียวกับคิวบ์ในเกมตอนเริ่ม)
 *
 * **ลาย (ADR-087 ข้อ 6):** ภาพลายโทนเทาชุดเดียวกับที่ `ThreeCubeView` ใช้ (`renderPattern`) → รูป → SVG
 * `<pattern>` แล้ว **คูณ** (`mix-blend-mode: multiply`) ทับสติกเกอร์ · ลายวาดในพิกัดของหน้าแต่ละหน้า
 * แล้วเอียงตามหน้าด้วย `matrix(...)`
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

/**
 * เมทริกซ์ `matrix(a b c d e f)` ที่พาพิกัดของหน้า (a, b ตามที่ `cell()` ใช้) ไปเป็นพิกัดบนจอ
 * — ตัวเดียวกับ `project()` แค่เขียนเป็นเมทริกซ์ ให้ลาย/วงแหวนเอียงตามหน้าได้
 */
const FACE_MATRIX: Record<Face, string> = {
  U: [COS30, 0.5, -COS30, 0.5, 0, -N].join(' '),
  F: [COS30, 0.5, 0, -1, -N * COS30, 0.5 * N].join(' '),
  R: [-COS30, 0.5, 0, -1, N * COS30, 0.5 * N].join(' '),
};

/** ขนาดช่องของรูปนี้ในหน่วยโลกของคิวบ์ 3x3 (ทั้งลูกกว้าง 2) — ใช้แปลงขนาดลายให้เท่าในเกม */
const CELL_WORLD = 2 / N;
/** ความละเอียดของภาพลายบนการ์ด — การ์ดใหญ่สุดราว 120 px ไม่ต้องใช้ 256 */
const ICON_PATTERN_SIZE = 64;

const patternUrls = new Map<PatternKind, string>();

/** ภาพลายเป็น data URL — สร้างครั้งเดียวต่อลายต่อหน้าเว็บ (ใช้ Canvas จึงเรียกได้เฉพาะในเบราว์เซอร์) */
function patternUrl(kind: PatternKind): string | null {
  const hit = patternUrls.get(kind);
  if (hit) return hit;
  if (typeof document === 'undefined') return null;
  const size = ICON_PATTERN_SIZE;
  const gray = renderPattern(kind, size);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const image = ctx.createImageData(size, size);
  for (let i = 0; i < gray.length; i++) {
    image.data[i * 4] = gray[i]!;
    image.data[i * 4 + 1] = gray[i]!;
    image.data[i * 4 + 2] = gray[i]!;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const url = canvas.toDataURL('image/png');
  patternUrls.set(kind, url);
  return url;
}

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
  const patternId = `skin-pattern-${useId().replace(/:/g, '')}`;
  const url = skin.pattern ? patternUrl(skin.pattern) : null;
  // ขนาดลายหนึ่งรอบในหน่วยช่องของรูป — เทียบเท่าขนาดจริงบนคิวบ์ 3x3 ในเกม
  const tile = skin.pattern ? PATTERN_TILE_WORLD[skin.pattern] / CELL_WORLD : 1;
  const inset = 1 - 2 * GAP;
  return (
    <svg
      viewBox="-3.1 -3.25 6.2 6.5"
      width={size}
      height={size}
      className={className}
      aria-hidden
      focusable="false"
    >
      {url && (
        <defs>
          <pattern id={patternId} patternUnits="userSpaceOnUse" width={tile} height={tile}>
            <image href={url} width={tile} height={tile} preserveAspectRatio="none" />
          </pattern>
        </defs>
      )}
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
          {url && (
            // ลายคูณทับสติกเกอร์ในพิกัดของหน้าเอง แล้วเอียงทั้งกลุ่มตามหน้า
            <g transform={`matrix(${FACE_MATRIX[face]})`} style={{ mixBlendMode: 'multiply' }}>
              {CELLS.map(([a, b]) => (
                <rect
                  key={`${a}-${b}`}
                  x={a + GAP}
                  y={b + GAP}
                  width={inset}
                  height={inset}
                  fill={`url(#${patternId})`}
                />
              ))}
            </g>
          )}
          {SHADE[face] > 0 && (
            <polygon points={polygon(OUTLINE[face])} fill="#000" fillOpacity={SHADE[face]} />
          )}
        </g>
      ))}
    </svg>
  );
}
