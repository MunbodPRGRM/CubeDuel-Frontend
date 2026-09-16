import type { CubeSkin, FaceName } from '@/cube';
import { skinCss } from './skin-css';

const FACES: readonly FaceName[] = ['U', 'D', 'F', 'B', 'R', 'L'];

/**
 * ชิปสี 6 หน้าของสกินหนึ่งตัว — เทียบสกินกันได้ในสายตาเดียวโดยไม่ต้องสร้าง WebGL สักตัว (ADR-064 ข้อ 2)
 *
 * ใช้บนการ์ดของหน้า `/skins` (รูปลูกบาศก์เห็นแค่ 3 หน้า — ADR-080 ข้อ 3) และแถวสกินในหน้าตั้งค่า
 * แบบอ่านอย่างเดียว (ADR-064 ข้อ 5)
 */
export function SkinSwatches({ skin, size = 'md' }: { skin: CubeSkin; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-4 w-4 rounded' : 'h-5 w-5 rounded-md';
  return (
    <div className="flex gap-1.5">
      {FACES.map((face) => (
        <span
          key={face}
          title={`หน้า ${face}`}
          className={`${box} border border-black/40`}
          style={{ background: skinCss(skin.faceColors[face]) }}
        />
      ))}
    </div>
  );
}
