/**
 * ตัววาดการ์ดแชร์ — Canvas 2D ล้วน ๆ **ไม่ผูกกับ React และไม่ลงไลบรารีใหม่** (ADR-074 ข้อ 1)
 *
 * กติกาที่ห้ามพลาด:
 * · ต้อง `await ensureCardFonts()` ก่อนวาดเสมอ ไม่งั้นภาษาไทยออกมาเป็นกล่องสี่เหลี่ยม
 * · ข้อความยาวทุกจุดต้องผ่าน `fit()` — การ์ดต้องไม่มีวันล้นกรอบ
 * · เวลา `null` = DNF (ตัวเรียกแปลงเป็นข้อความมาแล้วใน `share-card-data.ts`) ห้ามวาด 0
 */

import { getSkin, type CubeSkin } from '@/cube/three/colors';
import { formatEloChange, formatSolveTime, formatWinRate } from '@/lib/format';
import { CUBE_TYPE_LABEL } from '@/types/leaderboard';
import type { MatchCardData, ProfileCardData, ShareCardData } from './share-card-data';

/** อัตราส่วนเดียวกับภาพพรีวิวลิงก์มาตรฐาน — เผื่อวันหนึ่งเอาไปทำ OG image (ADR-074 ข้อ 2) */
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;
/** เรนเดอร์ใหญ่กว่าจริงเพื่อให้คมบนจอมือถือ */
const SCALE = 2;

const PAD = 64;
const BAR_W = 16;
const CONTENT_X = PAD + BAR_W + 16;
const RIGHT_X = CARD_WIDTH - PAD;

const COLOR = {
  bgTop: '#0a1524',
  bgBottom: '#060c17',
  panel: '#0d1c30',
  line: '#1e3350',
  text: '#f1f5f9',
  dim: '#94a3b8',
  faint: '#64748b',
  win: '#4ade80',
  loss: '#f87171',
  gold: '#fbbf24',
} as const;

const FAMILY = '"Noto Sans Thai", Inter, system-ui, sans-serif';
const WEIGHTS = [400, 500, 600, 700, 800] as const;

function font(weight: number, size: number): string {
  return `${weight} ${size}px ${FAMILY}`;
}

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/**
 * บังคับให้ฟอนต์ที่การ์ดใช้โหลดเสร็จจริงก่อนวาด
 *
 * Google Fonts ดึงไฟล์ของ weight ไหนต่อเมื่อมีอะไรบนหน้าใช้ weight นั้น → บาง weight
 * ที่แอปไม่ได้ใช้ยังไม่มาตอนกดแชร์ · canvas วาดด้วยฟอนต์ที่ยังไม่มาแบบเงียบ ๆ ไม่ error
 */
export async function ensureCardFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.all(
      WEIGHTS.flatMap((weight) => [
        document.fonts.load(`${weight} 48px "Noto Sans Thai"`, 'ชนะกิโมโน'),
        document.fonts.load(`${weight} 48px Inter`, 'CubeDuel 012'),
      ]),
    );
    await document.fonts.ready;
  } catch {
    // โหลดฟอนต์ไม่ได้ = วาดด้วย fallback ของเครื่อง ดีกว่าไม่ได้การ์ดเลย
  }
}

// ---------------------------------------------------------------- เครื่องมือวาด

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  // `roundRect` มีในเบราว์เซอร์ปัจจุบันทุกตัว แต่กันพลาดไว้ให้ WebView เก่าของเฟส 9
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** ตัดข้อความให้พอดีความกว้างจริง แล้วต่อท้ายด้วย `…` */
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  opts: { weight: number; size: number; color: string; align?: CanvasTextAlign; maxWidth?: number },
): void {
  ctx.font = font(opts.weight, opts.size);
  ctx.fillStyle = opts.color;
  ctx.textAlign = opts.align ?? 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(opts.maxWidth ? fit(ctx, value, opts.maxWidth) : value, x, y);
}

/** ป้ายกลม ๆ — คืนความกว้างที่ใช้ไป เพื่อให้เรียงต่อกันได้ */
function chip(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  color: string,
): number {
  ctx.font = font(600, 22);
  const w = ctx.measureText(label).width + 34;
  const h = 42;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = COLOR.panel;
  ctx.fill();
  ctx.strokeStyle = COLOR.line;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  text(ctx, label, x + 17, y + 28, { weight: 600, size: 22, color });
  return w;
}

function formatThaiDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

function background(ctx: CanvasRenderingContext2D, skin: CubeSkin, accent: string): void {
  const bg = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  bg.addColorStop(0, COLOR.bgTop);
  bg.addColorStop(1, COLOR.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // แสงจาง ๆ มุมขวาบนด้วยสีเน้นของสกิน
  const glow = ctx.createRadialGradient(CARD_WIDTH - 120, -40, 40, CARD_WIDTH - 120, -40, 620);
  glow.addColorStop(0, `${accent}33`);
  glow.addColorStop(1, '#00000000');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // แถบสติกเกอร์ 6 หน้าของสกิน — บอกว่าเป็นการ์ดของ CubeDuel ตั้งแต่ยังไม่อ่านตัวหนังสือ
  const faces = [
    skin.faceColors.U,
    skin.faceColors.R,
    skin.faceColors.F,
    skin.faceColors.D,
    skin.faceColors.L,
    skin.faceColors.B,
  ];
  const segment = (CARD_HEIGHT - PAD * 2) / faces.length;
  faces.forEach((color, i) => {
    roundRect(ctx, PAD, PAD + i * segment, BAR_W, segment - 8, 6);
    ctx.fillStyle = hex(color);
    ctx.fill();
  });

  ctx.strokeStyle = COLOR.line;
  ctx.lineWidth = 2;
  roundRect(ctx, 6, 6, CARD_WIDTH - 12, CARD_HEIGHT - 12, 28);
  ctx.stroke();
}

function header(ctx: CanvasRenderingContext2D, accent: string, right: string): void {
  text(ctx, 'CubeDuel', CONTENT_X, PAD + 26, { weight: 800, size: 30, color: COLOR.text });
  ctx.beginPath();
  ctx.arc(CONTENT_X + ctx.measureText('CubeDuel').width + 14, PAD + 16, 6, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  text(ctx, right, RIGHT_X, PAD + 24, {
    weight: 600,
    size: 24,
    color: COLOR.faint,
    align: 'right',
    maxWidth: 520,
  });
}

function footer(ctx: CanvasRenderingContext2D, url: string, right: string): void {
  const y = CARD_HEIGHT - PAD - 6;
  text(ctx, url.replace(/^https?:\/\//, ''), CONTENT_X, y, {
    weight: 500,
    size: 22,
    color: COLOR.faint,
    maxWidth: 640,
  });
  text(ctx, right, RIGHT_X, y, {
    weight: 500,
    size: 22,
    color: COLOR.faint,
    align: 'right',
    maxWidth: 400,
  });
}

/** กล่องตัวเลขสถิติหนึ่งช่อง */
function statBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  color: string,
): void {
  roundRect(ctx, x, y, w, h, 20);
  ctx.fillStyle = COLOR.panel;
  ctx.fill();
  ctx.strokeStyle = COLOR.line;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  text(ctx, label, x + 18, y + 38, { weight: 600, size: 20, color: COLOR.faint, maxWidth: w - 36 });
  text(ctx, value, x + 18, y + 90, { weight: 700, size: 38, color, maxWidth: w - 36 });
}

// ---------------------------------------------------------------- การ์ดแต่ละแบบ

function drawProfileCard(
  ctx: CanvasRenderingContext2D,
  data: ProfileCardData,
  accent: string,
): void {
  header(ctx, accent, `โปรไฟล์ · ${CUBE_TYPE_LABEL[data.cubeType]}`);

  // วงกลมตัวอักษรย่อ — ระบบใช้ตัวย่อทั้งแอป ไม่มีรูปโปรไฟล์ให้ติด CORS
  const cx = CONTENT_X + 66;
  const cy = 232;
  ctx.beginPath();
  ctx.arc(cx, cy, 66, 0, Math.PI * 2);
  ctx.fillStyle = COLOR.panel;
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.textAlign = 'center';
  text(ctx, data.name.trim().charAt(0).toUpperCase() || '?', cx, cy + 22, {
    weight: 700,
    size: 62,
    color: COLOR.text,
    align: 'center',
  });

  const nameX = cx + 100;
  const eloText = data.elo === null ? '—' : String(data.elo);
  ctx.font = font(800, 76);
  const eloW = ctx.measureText(eloText).width;
  // เว้นช่องจาก ELO ให้พออ่านออกว่าเป็นคนละก้อน — ELO กว้างไม่เท่ากันตามจำนวนหลัก
  const nameMax = RIGHT_X - nameX - eloW - 60;

  text(ctx, data.name, nameX, 212, {
    weight: 800,
    size: 56,
    color: COLOR.text,
    maxWidth: nameMax,
  });
  text(ctx, data.username ? `@${data.username}` : '', nameX, 256, {
    weight: 500,
    size: 26,
    color: COLOR.dim,
    maxWidth: nameMax,
  });
  chip(ctx, CUBE_TYPE_LABEL[data.cubeType], nameX, 282, accent);

  text(ctx, 'ELO', RIGHT_X, 176, { weight: 600, size: 24, color: COLOR.faint, align: 'right' });
  text(ctx, eloText, RIGHT_X, 246, { weight: 800, size: 76, color: accent, align: 'right' });

  // 5 ช่องเท่ากัน — Ao5 กับ Ao12 ต้องแยกช่อง ยัดรวมช่องเดียวแล้วโดน `fit()` ตัดทิ้ง
  const boxY = 372;
  const boxH = 118;
  const gap = 16;
  const boxW = (RIGHT_X - CONTENT_X - gap * 4) / 5;
  const boxes: Array<[string, string, string]> = [
    ['ชนะ–แพ้', `${data.wins}–${data.losses}`, COLOR.text],
    [
      'Win rate',
      formatWinRate(data.winRate),
      data.winRate !== null && data.winRate >= 0.5 ? COLOR.win : COLOR.text,
    ],
    ['Best', formatSolveTime(data.best), COLOR.gold],
    ['Ao5', formatSolveTime(data.ao5), COLOR.text],
    ['Ao12', formatSolveTime(data.ao12), COLOR.text],
  ];
  boxes.forEach(([label, value, color], i) => {
    statBox(ctx, CONTENT_X + (boxW + gap) * i, boxY, boxW, boxH, label, value, color);
  });

  footer(ctx, data.url, data.since ? `เล่นตั้งแต่ ${formatThaiDate(data.since)}` : '');
}

const OUTCOME: Record<MatchCardData['outcome'], { label: string; color: string }> = {
  win: { label: 'ชนะ', color: COLOR.win },
  loss: { label: 'แพ้', color: COLOR.loss },
  draw: { label: 'เสมอ', color: COLOR.dim },
};

function drawMatchCard(ctx: CanvasRenderingContext2D, data: MatchCardData, accent: string): void {
  header(ctx, accent, `${data.matchNo} · ${data.roomLabel} · ${CUBE_TYPE_LABEL[data.cubeType]}`);

  const outcome = OUTCOME[data.outcome];
  text(ctx, 'ผลการแข่งขัน', CONTENT_X, 176, { weight: 600, size: 26, color: COLOR.faint });
  text(ctx, outcome.label, CONTENT_X, 262, { weight: 800, size: 84, color: outcome.color });

  // ฝั่งขวาของบรรทัดผล: อันดับของห้องหลายคน (1v1 ไม่มีอันดับให้โชว์ เพราะมีแค่ชนะ/แพ้)
  if (data.rank) {
    text(ctx, 'อันดับ', RIGHT_X, 176, {
      weight: 600,
      size: 24,
      color: COLOR.faint,
      align: 'right',
    });
    text(ctx, `${data.rank.rankNo} / ${data.rank.playerCount}`, RIGHT_X, 256, {
      weight: 800,
      size: 76,
      color: data.rank.rankNo === 1 ? COLOR.gold : COLOR.text,
      align: 'right',
    });
  }

  const boxY = 320;
  const boxH = 140;
  const gap = 20;
  const boxW = data.rival ? (RIGHT_X - CONTENT_X - gap) / 2 : RIGHT_X - CONTENT_X;

  const drawSide = (x: number, name: string, value: string, highlight: boolean) => {
    roundRect(ctx, x, boxY, boxW, boxH, 22);
    ctx.fillStyle = COLOR.panel;
    ctx.fill();
    ctx.strokeStyle = highlight ? accent : COLOR.line;
    ctx.lineWidth = highlight ? 2.5 : 1.5;
    ctx.stroke();
    text(ctx, name, x + 26, boxY + 46, {
      weight: 600,
      size: 24,
      color: COLOR.dim,
      maxWidth: boxW - 52,
    });
    text(ctx, value, x + 26, boxY + 112, {
      weight: 800,
      size: 54,
      color: highlight ? COLOR.text : COLOR.dim,
      maxWidth: boxW - 52,
    });
  };

  drawSide(CONTENT_X, data.self.name, data.self.label, true);
  if (data.rival) drawSide(CONTENT_X + boxW + gap, data.rival.name, data.rival.label, false);

  // ป้ายล่าง: Elo · move · วันที่
  let x = CONTENT_X;
  const chipY = 490;
  const eloLabel =
    data.eloChange === null ? 'ไม่ปรับคะแนน' : `ELO ${formatEloChange(data.eloChange)}`;
  const eloColor =
    data.eloChange === null
      ? COLOR.faint
      : data.eloChange > 0
        ? COLOR.win
        : data.eloChange < 0
          ? COLOR.loss
          : COLOR.dim;
  x += chip(ctx, eloLabel, x, chipY, eloColor) + 12;
  x +=
    chip(ctx, `${data.moveCount === null ? '—' : data.moveCount} moves`, x, chipY, COLOR.dim) + 12;
  chip(ctx, formatThaiDate(data.playedAt), x, chipY, COLOR.dim);

  footer(ctx, data.url, '');
}

// ---------------------------------------------------------------- ทางเข้า

/**
 * วาดการ์ดลง canvas ที่ส่งเข้ามา (ตั้งขนาดให้เอง) — **ต้องเรียก `ensureCardFonts()` ก่อน**
 */
export function drawShareCard(
  canvas: HTMLCanvasElement,
  data: ShareCardData,
  skinId: string | null | undefined,
): void {
  canvas.width = CARD_WIDTH * SCALE;
  canvas.height = CARD_HEIGHT * SCALE;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const skin = getSkin(skinId);
  const accent = hex(skin.faceColors.B);

  background(ctx, skin, accent);
  if (data.kind === 'profile') drawProfileCard(ctx, data, accent);
  else drawMatchCard(ctx, data, accent);
}
