import cube2x2x2 from '@/assets/cubes/2x2x2.webp';
import cube3x3x3 from '@/assets/cubes/3x3x3.webp';
import cubePyraminx from '@/assets/cubes/pyraminx.webp';
import cubePyramorphix from '@/assets/cubes/pyramorphix.webp';
import { CUBE_TYPES, type CubeType } from '@/types/cube';
import { CUBE_TYPE_LABEL } from '@/types/leaderboard';

/**
 * ภาพนิ่งของรูบิคแต่ละประเภท (เฟส 13 ก้อนที่ 8)
 *
 * ถ่ายจาก renderer ของเราเอง (`createCubeView` · สกินมาตรฐาน · สถานะแก้เสร็จ · มุมกล้องเริ่มต้น)
 * แล้วตัดขอบโปร่งใสให้ทุกรูปอยู่ในกรอบขนาดเท่ากัน 480×480 · **ไม่ตามสกินของผู้เล่น** — เจ้าของเลือกเอง
 * ถ้าแก้หน้าตาคิวบ์ใน `src/cube/` จนภาพไม่ตรงแล้ว ต้องถ่ายใหม่ (ขั้นตอนอยู่ใน roadmap เฟส 13 ก้อนที่ 8)
 *
 * `Record<CubeType, …>` ให้ TypeScript ฟ้องเมื่อมีประเภทใหม่แต่ยังไม่มีรูป
 */
const CUBE_IMAGES: Record<CubeType, string> = {
  '2x2x2': cube2x2x2,
  '3x3x3': cube3x3x3,
  pyraminx: cubePyraminx,
  pyramorphix: cubePyramorphix,
};

interface CubeTypeImageProps {
  cubeType: CubeType;
  /** ความกว้าง = ความสูง (px) · ไฟล์จริง 480 px จึงคมถึงจอ 2 เท่าที่ 240 */
  size?: number;
  className?: string;
}

/**
 * วางรูปครบทั้ง 4 ซ้อนกันแล้วสลับด้วย opacity — รูปทุกใบโหลดไว้ตั้งแต่แรก
 * ตอนกดเปลี่ยนประเภทจึงไม่มีจังหวะว่างระหว่างรอโหลดรูปใหม่ (ถ้าเปลี่ยน `src` ของ `<img>` ใบเดียวจะกระพริบ)
 */
export function CubeTypeImage({ cubeType, size = 240, className }: CubeTypeImageProps) {
  return (
    <div className={`relative ${className ?? ''}`} style={{ width: size, height: size }}>
      {CUBE_TYPES.map((type) => {
        const active = type === cubeType;
        return (
          <img
            key={type}
            src={CUBE_IMAGES[type]}
            alt={active ? `รูบิค ${CUBE_TYPE_LABEL[type]}` : ''}
            aria-hidden={active ? undefined : true}
            width={size}
            height={size}
            draggable={false}
            className={`absolute inset-0 h-full w-full select-none object-contain transition-opacity duration-200 ${
              active ? 'opacity-100' : 'opacity-0'
            }`}
          />
        );
      })}
    </div>
  );
}
