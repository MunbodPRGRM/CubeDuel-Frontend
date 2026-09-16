/**
 * ตรวจว่า **สีของทุกสกินแยกกันออกจริง** และรายชื่อตรงกับ server (เฟส 13 ก้อนที่ 11 — ADR-080 ข้อ 4)
 *
 * สกินที่สวยแต่สองหน้าสีใกล้กันใช้แข่งไม่ได้ — ตาคนแยกไม่ออกตอนหน้าเอียงรับแสง
 * วัดด้วย **CIEDE2000** (ระยะห่างของสีตามการมองเห็นของคน) ไม่ใช่ระยะ RGB ที่หลอกตา
 *
 * เกณฑ์ขั้นต่ำ (ที่มาของตัวเลขอยู่ใน ADR-080 ข้อ 4):
 *   - สีหน้าลูกบาศก์ทุกคู่ (6 สี)          ≥ 15
 *   - 4 สีที่ทรงพีระมิดใช้ (`tetraFaceColors`) ≥ 25
 *   - สีหน้าเทียบเนื้อพลาสติก             ≥ 25
 *
 * `backend/` อยู่คนละ repo — ถ้าเช็กเอาต์มาแค่ repo นี้ ข้อที่เทียบรายชื่อกับ server จะถูกข้ามพร้อมบอก
 *
 * รัน: `npm run verify:skins`
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CUBE_SKINS,
  DEFAULT_SKIN_ID,
  SKIN_CATEGORIES,
  tetraFaceColors,
  type FaceName,
} from '../src/cube/three/colors.ts';

const MIN_FACE_DELTA = 15;
const MIN_TETRA_DELTA = 25;
const MIN_BODY_DELTA = 25;
/** `User.cube_skin` เป็น `VARCHAR(30)` */
const MAX_ID_LENGTH = 30;

const here = dirname(fileURLToPath(import.meta.url));
const backendConstants = resolve(here, '..', '..', 'backend', 'src', 'constants.ts');

let failures = 0;

function check(label: string, ok: boolean, detail = ''): void {
  if (!ok) failures++;
  console.log(`${ok ? '  ✓' : '  ✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}

// ---------------------------------------------------------------- CIEDE2000

function toLab(hex: number): Lab {
  const linear = (channel: number): number => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = linear((hex >> 16) & 255);
  const g = linear((hex >> 8) & 255);
  const b = linear(hex & 255);

  // sRGB → XYZ (D65) แล้วหารด้วยจุดขาวอ้างอิง
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

type Lab = [number, number, number];

/** ระยะห่างของสองสีแบบ CIEDE2000 — สูตรตาม Sharma, Wu & Dalal (2005) */
function deltaE2000Lab([L1, a1, b1]: Lab, [L2, a2, b2]: Lab): number {
  const rad = Math.PI / 180;

  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);

  const hue = (a: number, b: number): number => {
    if (a === 0 && b === 0) return 0;
    const h = Math.atan2(b, a) / rad;
    return h < 0 ? h + 360 : h;
  };
  const h1p = hue(a1p, b1);
  const h2p = hue(a2p, b2);

  const dL = L2 - L1;
  const dC = C2p - C1p;
  let dh = 0;
  if (C1p * C2p !== 0) {
    dh = h2p - h1p;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
  }
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin((dh / 2) * rad);

  const Lbar = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;
  let hbar = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hbar += hbar < 360 ? 360 : -360;
    hbar /= 2;
  }

  const T =
    1 -
    0.17 * Math.cos((hbar - 30) * rad) +
    0.24 * Math.cos(2 * hbar * rad) +
    0.32 * Math.cos((3 * hbar + 6) * rad) -
    0.2 * Math.cos((4 * hbar - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hbar - 275) / 25) ** 2));
  const RC = 2 * Math.sqrt(Cbarp ** 7 / (Cbarp ** 7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lbar - 50) ** 2) / Math.sqrt(20 + (Lbar - 50) ** 2);
  const SC = 1 + 0.045 * Cbarp;
  const SH = 1 + 0.015 * Cbarp * T;
  const RT = -Math.sin(2 * dTheta * rad) * RC;

  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}

function deltaE2000(hexA: number, hexB: number): number {
  return deltaE2000Lab(toLab(hexA), toLab(hexB));
}

/** คู่ที่ใกล้กันที่สุดในชุดสี */
function closestPair(colors: [string, number][]): { delta: number; pair: string } {
  let best = { delta: Infinity, pair: '' };
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const delta = deltaE2000(colors[i]![1], colors[j]![1]);
      if (delta < best.delta) best = { delta, pair: `${colors[i]![0]}–${colors[j]![0]}` };
    }
  }
  return best;
}

// ---------------------------------------------------------------- 0) ความเข้ากันได้ของตัวสูตร

console.log('\n0) สูตร CIEDE2000 ให้ผลตรงกับค่าอ้างอิง');
{
  // คู่ที่ 1 · 7 · 13 · 17 ของตารางทดสอบในเปเปอร์ Sharma — ครอบสีอิ่ม · สีเทา · มุมสีข้าม 0°
  const cases: [Lab, Lab, number][] = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 0, 0], [50, -1, 2], 2.3669],
    [[50, 2.49, -0.001], [50, -2.49, 0.0011], 7.2195],
    [[50, 2.5, 0], [73, 25, -18], 27.1492],
  ];
  for (const [a, b, expected] of cases) {
    const actual = deltaE2000Lab(a, b);
    check(
      `Lab(${a.join(', ')}) ↔ Lab(${b.join(', ')}) = ${expected}`,
      Math.abs(actual - expected) < 1e-4,
      actual.toFixed(4),
    );
  }
  // สีเดียวกัน = 0 · ขาวกับดำ = 100 (L ต่างกัน 100 และ L เฉลี่ย 50 พอดี ตัวถ่วง SL จึงเป็น 1)
  check('สีเดียวกัน = 0', deltaE2000(0x3b82f6, 0x3b82f6) === 0);
  const whiteBlack = deltaE2000(0xffffff, 0x000000);
  check('ขาว–ดำ ≈ 100', Math.abs(whiteBlack - 100) < 0.01, whiteBlack.toFixed(2));
}

// ---------------------------------------------------------------- 1) รายชื่อ

console.log('\n1) รายชื่อสกิน');
{
  const ids = CUBE_SKINS.map((skin) => skin.id);
  check('รหัสไม่ซ้ำกัน', new Set(ids).size === ids.length, ids.join(', '));
  check(
    `รหัสเป็น a-z ยาวไม่เกิน ${MAX_ID_LENGTH} ตัว`,
    ids.every((id) => /^[a-z]+$/.test(id) && id.length <= MAX_ID_LENGTH),
  );
  check(
    `ตัวแรกคือสกินตั้งต้น (${DEFAULT_SKIN_ID}) — getSkin() ตกกลับไปตัวแรก`,
    ids[0] === DEFAULT_SKIN_ID,
    ids[0],
  );
  const categories = SKIN_CATEGORIES.map((category) => category.id);
  check(
    'ทุกสกินอยู่ในหมวดที่มีจริง',
    CUBE_SKINS.every((skin) => categories.includes(skin.category)),
  );
  check(
    'ทุกหมวดมีสกินอย่างน้อยหนึ่งตัว (ไม่มีตัวกรองที่กดแล้วว่าง)',
    categories.every((category) => CUBE_SKINS.some((skin) => skin.category === category)),
  );
  check(
    'ชื่อและคำอธิบายไม่ว่าง',
    CUBE_SKINS.every((skin) => skin.label.trim() !== '' && skin.hint.trim() !== ''),
  );

  if (existsSync(backendConstants)) {
    const source = readFileSync(backendConstants, 'utf8');
    const block = /export const CUBE_SKINS = \[([^\]]*)\]/.exec(source)?.[1] ?? '';
    const serverIds = [...block.matchAll(/'([^']+)'/g)].map((match) => match[1]!);
    const missing = ids.filter((id) => !serverIds.includes(id));
    const extra = serverIds.filter((id) => !ids.includes(id));
    check(
      'ตรงกับ backend/src/constants.ts ทุกตัว (ADR-048 ข้อ 2)',
      serverIds.length > 0 && missing.length === 0 && extra.length === 0,
      [
        missing.length ? `server ไม่รู้จัก: ${missing.join(', ')}` : '',
        extra.length ? `frontend ไม่มี: ${extra.join(', ')}` : '',
        serverIds.length === 0 ? 'อ่านรายชื่อจากไฟล์ไม่ได้' : '',
      ]
        .filter(Boolean)
        .join(' · '),
    );
  } else {
    console.log(
      '  – เทียบกับ backend/src/constants.ts — ข้าม (ไม่มีโฟลเดอร์ backend/ ข้าง repo นี้)',
    );
  }
}

// ---------------------------------------------------------------- 2) สีแยกกันออก

console.log(
  `\n2) สีแยกกันออก (CIEDE2000 · หน้า ≥ ${MIN_FACE_DELTA} · พีระมิด ≥ ${MIN_TETRA_DELTA} · พลาสติก ≥ ${MIN_BODY_DELTA})`,
);
const FACES: FaceName[] = ['U', 'D', 'F', 'B', 'R', 'L'];
for (const skin of CUBE_SKINS) {
  const faces = closestPair(FACES.map((face) => [face, skin.faceColors[face]]));
  const tetra = closestPair(
    tetraFaceColors(skin).map((color, index) => [`หน้า${index + 1}`, color]),
  );
  let body = { delta: Infinity, face: '' };
  for (const face of FACES) {
    const delta = deltaE2000(skin.faceColors[face], skin.bodyColor);
    if (delta < body.delta) body = { delta, face };
  }

  const ok =
    faces.delta >= MIN_FACE_DELTA && tetra.delta >= MIN_TETRA_DELTA && body.delta >= MIN_BODY_DELTA;
  check(
    skin.id.padEnd(11),
    ok,
    `หน้า ${faces.delta.toFixed(1)} (${faces.pair}) · พีระมิด ${tetra.delta.toFixed(1)} · พลาสติก ${body.delta.toFixed(1)} (${body.face})`,
  );
}

console.log(failures === 0 ? '\nผ่านทุกข้อ ✅' : `\nไม่ผ่าน ${failures} ข้อ ❌`);
process.exit(failures === 0 ? 0 : 1);
