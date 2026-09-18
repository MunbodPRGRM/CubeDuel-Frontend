/** แปลงเลขสีของ Three.js (`0xRRGGBB`) เป็นค่าสีของ CSS · `alpha` 0–1 ต่อท้ายเป็น `#RRGGBBAA` */
export function skinCss(hex: number, alpha?: number): string {
  const base = `#${hex.toString(16).padStart(6, '0')}`;
  if (alpha === undefined) return base;
  const channel = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
  return `${base}${channel.toString(16).padStart(2, '0')}`;
}
