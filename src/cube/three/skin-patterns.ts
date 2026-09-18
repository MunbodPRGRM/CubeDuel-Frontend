/**
 * **ลวดลายของสกิน** — วาดเป็นภาพโทนเทาด้วยโค้ดล้วน (ADR-087 ข้อ 2 · เฟส 13 ก้อนที่ 25)
 *
 * ผลลัพธ์คือ `Uint8Array` ค่าเทาทีละพิกเซล **ไม่ใช้ Canvas / DOM เลย** เพราะมีผู้ใช้สามที่:
 *   - `ThreeCubeView` → `DataTexture` แล้วคูณกับสีสติกเกอร์ใน shader (ลายใบเดียวย้อมได้ทุกหน้า)
 *   - รูปการ์ดในหน้า `/skins` → แปลงเป็นรูปแล้ววางเป็น SVG `<pattern>` (ข้อ 6)
 *   - `scripts/verify-skins.ts` บน Node เปล่า → ตรวจว่าจุดที่มืดที่สุดไม่ต่ำกว่าเกณฑ์ (ข้อ 7)
 * → **ลายมีแหล่งเดียว** ทั้งสามที่เห็นพิกเซลชุดเดียวกัน
 *
 * ทุกลาย **ต่อกันได้ไร้รอยต่อ** (tileable) เพราะ texture ใช้ `RepeatWrapping` — noise ทุกตัวในไฟล์นี้
 * จึงวนรอบด้วยคาบที่เป็นจำนวนเต็ม
 *
 * ค่าเทาทุกพิกเซลอยู่ในช่วง [`PATTERN_MIN_GRAY`, 1] — ลายที่มืดกว่านี้ทำให้สีข้างเคียง
 * (เหลือง–ส้ม · แดง–ส้ม) เข้าใกล้กันจนแยกไม่ออกตอนหน้าเอียงรับแสง (ADR-087 ข้อ 2)
 * · ค่าเทาคูณใน **linear space** (ใน shader) — 0.75 ตามแผนเดิมมืดลงบนจอแค่ ~12% ลายแทบมองไม่เห็น
 *   เจ้าของสั่งให้ลายชัดขึ้นสองรอบ → 0.55 → 0.35 → **0.25** (~50% บนจอ) แล้วให้ `verify-skins` เทียบสีตอนมืดสุด
 *   เป็นตัวกันแทน (ADR-087 หมายเหตุตอนลงมือ) · 0.2 ไม่ผ่าน — น้ำเงินที่มืดลงเหลือ 20% จมกับเนื้อพลาสติกเกือบดำ
 *
 * ไฟล์นี้ **ห้าม import three หรือ DOM** — สคริปต์ `verify-skins` รันบน Node เปล่า ๆ
 */

export type PatternKind = 'carbon' | 'honeycomb' | 'marble' | 'brushed';

/** จุดที่มืดที่สุดของลายต้องไม่ต่ำกว่านี้ (0–1) — `verify-skins` ตรวจจากพิกเซลจริง */
export const PATTERN_MIN_GRAY = 0.25;

/** ขนาดภาพลาย (px) — ยกกำลังสอง ให้ mipmap ได้ */
export const PATTERN_SIZE = 256;

/**
 * ลายหนึ่งรอบกว้างกี่หน่วยโลก (คิวบ์ทั้งลูกกว้าง 2) — ความละเอียดของลาย **เท่ากันทุกประเภททุกขนาด**
 * ไม่ยืดตามขนาดสติกเกอร์ (ADR-087 ข้อ 3) · สติกเกอร์ 3x3 กว้างราว 0.52
 */
export const PATTERN_TILE_WORLD: Record<PatternKind, number> = {
  carbon: 0.6,
  honeycomb: 0.7,
  marble: 1.2,
  brushed: 1.0,
};

// ---------------------------------------------------------------- noise ที่วนรอบ

/** hash จำนวนเต็ม → [0, 1) · ใช้ `Math.imul` เพื่อให้ได้ผลเดียวกันทุกเครื่อง */
function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** value noise ที่วนรอบด้วยคาบ `px` × `py` (จำนวนเต็ม) */
function periodicNoise(x: number, y: number, px: number, py: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = smooth(x - xi);
  const fy = smooth(y - yi);
  const x0 = mod(xi, px);
  const x1 = mod(xi + 1, px);
  const y0 = mod(yi, py);
  const y1 = mod(yi + 1, py);
  const top = hash(x0, y0, seed) * (1 - fx) + hash(x1, y0, seed) * fx;
  const bottom = hash(x0, y1, seed) * (1 - fx) + hash(x1, y1, seed) * fx;
  return top * (1 - fy) + bottom * fy;
}

/** noise หลายชั้น (fBm) บนพิกัด u, v ∈ [0, 1) — ทุกชั้นคาบเป็นจำนวนเต็ม จึงยังวนรอบ */
function periodicFbm(
  u: number,
  v: number,
  baseX: number,
  baseY: number,
  octaves: number,
  seed: number,
): number {
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const f = 2 ** o;
    const amp = 0.5 ** o;
    sum += amp * periodicNoise(u * baseX * f, v * baseY * f, baseX * f, baseY * f, seed + o);
    norm += amp;
  }
  return sum / norm;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  return smooth(clamp01((x - edge0) / (edge1 - edge0)));
}

// ---------------------------------------------------------------- ลาย (คืน 0–1 ก่อนบีบช่วง)

/** คาร์บอนสานขัดแบบ plain weave — 4×4 ช่องต่อรอบ · ช่องสลับแนวนอน/แนวตั้งเป็นตาหมากรุก */
function carbon(u: number, v: number): number {
  const CELLS = 4;
  const cu = u * CELLS;
  const cv = v * CELLS;
  const i = Math.floor(cu);
  const j = Math.floor(cv);
  const horizontal = (i + j) % 2 === 0;
  const across = horizontal ? cv - j : cu - i;
  const along = horizontal ? cu - i : cv - j;
  // เส้นใยโค้งนูน: สว่างกลางเส้น มืดที่ขอบ
  const tow = Math.sin(Math.PI * across) ** 0.8;
  // ริ้วใยละเอียดตามแนวเส้น
  const fibers = 0.5 + 0.5 * Math.sin(across * Math.PI * 10);
  // ปลายช่องที่เส้นมุดลงใต้เส้นขวางมืดลง — ทำให้เห็นเป็น "สาน" ไม่ใช่ลายทาง
  const dip = 1 - 0.55 * Math.abs(2 * along - 1) ** 3;
  return tow * (0.78 + 0.22 * fibers) * dip;
}

/**
 * ตารางหกเหลี่ยม (ยอดแหลมบนล่าง) — ร่องมืด ในช่องสว่าง
 *
 * แลตทิซหกเหลี่ยมมีคาบ (1, √3) · ภาพจัตุรัสจึงใส่ 7 × 4 คาบ (7 ≈ 4√3 = 6.93 ยืดไม่ถึง 1%)
 */
function honeycomb(u: number, v: number): number {
  const SQRT3 = Math.sqrt(3);
  const px = u * 7;
  const py = v * 4 * SQRT3;
  const ax = mod(px, 1) - 0.5;
  const ay = mod(py, SQRT3) - SQRT3 / 2;
  const bx = mod(px - 0.5, 1) - 0.5;
  const by = mod(py - SQRT3 / 2, SQRT3) - SQRT3 / 2;
  const [gx, gy] = ax * ax + ay * ay < bx * bx + by * by ? [ax, ay] : [bx, by];
  // ระยะแบบหกเหลี่ยมจากจุดกลางช่อง — ถึงขอบที่ 0.5
  const d = Math.max(Math.abs(gx), 0.5 * Math.abs(gx) + (SQRT3 / 2) * Math.abs(gy));
  const edge = 0.5 - d;
  const groove = smoothstep(0.015, 0.07, edge);
  const dome = 1 - 0.12 * d * 2;
  return groove * dome;
}

/** หินอ่อน — เส้นเลือดบิดตาม noise บนพื้นขุ่น · ทิศเส้น (3, 2) เป็นจำนวนเต็มจึงยังวนรอบ */
function marble(u: number, v: number): number {
  const turbulence = periodicFbm(u, v, 3, 3, 5, 11);
  const phase = 2 * Math.PI * (3 * u + 2 * v) + 8 * turbulence;
  const vein = 1 - smoothstep(0, 0.3, Math.abs(Math.sin(phase)));
  const cloud = periodicFbm(u, v, 4, 4, 4, 23);
  return clamp01(1 - 0.9 * vein * (0.55 + 0.45 * cloud) - 0.35 * cloud);
}

/** โลหะขัด — ริ้วแนวนอน: noise ถี่มากตามแนวตั้ง ช้ามากตามแนวนอน */
function brushed(u: number, v: number): number {
  const streaks = periodicFbm(u, v, 3, 96, 3, 31);
  const sheen = periodicFbm(u, v, 2, 2, 2, 37);
  // fBm ส่วนใหญ่กองอยู่แถว 0.5 — ยืดออกให้ริ้วเห็นบนจอ
  const stretched = clamp01((streaks - 0.5) * 4 + 0.5);
  return clamp01(0.85 * stretched + 0.15 * sheen);
}

const PATTERNS: Record<PatternKind, (u: number, v: number) => number> = {
  carbon,
  honeycomb,
  marble,
  brushed,
};

// ---------------------------------------------------------------- ส่งออก

/** ค่าต่ำสุดเป็นไบต์ — ปัดขึ้น ไม่งั้น 0.75 × 255 = 191.25 ปัดลงเหลือ 191 (= 0.749) หลุดเกณฑ์ */
const MIN_GRAY_BYTE = Math.ceil(PATTERN_MIN_GRAY * 255);

function toGray(value: number): number {
  const gray = Math.round((PATTERN_MIN_GRAY + (1 - PATTERN_MIN_GRAY) * clamp01(value)) * 255);
  return Math.max(MIN_GRAY_BYTE, gray);
}

function render(size: number, fn: (u: number, v: number) => number): Uint8Array {
  const out = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      out[y * size + x] = toGray(fn((x + 0.5) / size, (y + 0.5) / size));
    }
  }
  return out;
}

const patternCache = new Map<string, Uint8Array>();

function cached(key: string, build: () => Uint8Array): Uint8Array {
  let hit = patternCache.get(key);
  if (!hit) {
    hit = build();
    patternCache.set(key, hit);
  }
  return hit;
}

/** ภาพลายโทนเทา `size × size` (แถวบนก่อน) · ค่า 0–255 อยู่ในช่วง `PATTERN_MIN_GRAY` ขึ้นไปเสมอ */
export function renderPattern(kind: PatternKind, size = PATTERN_SIZE): Uint8Array {
  return cached(`p:${kind}:${size}`, () => render(size, PATTERNS[kind]));
}
