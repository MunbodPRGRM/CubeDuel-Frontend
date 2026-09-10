/**
 * จานสีของคิวบ์ 3 มิติ — รวมไว้ที่เดียวเพราะฟีเจอร์ "เลือกสกินสี" (ข้อ 10 ใน CLAUDE.md)
 *
 * **เฟส 8 ก้อนที่ 1:** ที่นี่กลายเป็น **แหล่งความจริงของสกินทั้งหมด** แล้ว — geometry ทุกตัว
 * รับ `CubeSkin` เข้าไปแทนที่จะ import ค่าคงที่ตรง ๆ (ADR-048 ข้อ 2)
 * ฝั่ง server เก็บแค่ **รหัส** ของสกินลง `User.cube_skin` และรู้จักเฉพาะรายชื่อใน
 * `backend/src/constants.ts` → **เพิ่มสกินใหม่ต้องแก้สองไฟล์นั้นพร้อมกัน** (ADR-021)
 *
 * สกินตั้งต้น (`classic`) ยึดสีมาตรฐาน WCA แล้วดันความสว่างขึ้นนิดให้ตัดกับพื้นหลัง navy ของดีไซน์ (ADR-024)
 */

/** ชื่อหน้าตามโน้ตเทชัน — ลูกบาศก์ใช้ครบ 6 หน้า ทรงพีระมิดหยิบไปใช้ 4 หน้า */
export type FaceName = 'U' | 'D' | 'F' | 'B' | 'R' | 'L';

export interface CubeSkin {
  /** ต้องตรงกับรายชื่อใน `backend/src/constants.ts` (`CUBE_SKINS`) */
  id: string;
  label: string;
  /** ชื่อไทยสั้น ๆ ของบุคลิกสกิน — ใช้ในหน้าตั้งค่า */
  hint: string;
  faceColors: Record<FaceName, number>;
  /** เนื้อพลาสติกและรอยตัดที่ไม่ใช่ผิวนอก */
  bodyColor: number;
}

export const CUBE_SKINS: readonly CubeSkin[] = [
  {
    id: 'classic',
    label: 'มาตรฐาน',
    hint: 'สีตามลูกจริงของ WCA',
    faceColors: {
      U: 0xf1f5f9, // ขาว
      D: 0xfacc15, // เหลือง
      F: 0x22c55e, // เขียว
      B: 0x3b82f6, // น้ำเงิน
      R: 0xef4444, // แดง
      L: 0xf97316, // ส้ม
    },
    bodyColor: 0x0b0f16,
  },
  {
    id: 'pastel',
    label: 'พาสเทล',
    hint: 'สีอ่อน สบายตาเวลาเล่นนาน ๆ',
    faceColors: {
      U: 0xf8fafc,
      D: 0xfde68a,
      F: 0x86efac,
      B: 0x93c5fd,
      R: 0xfca5a5,
      L: 0xfdba74,
    },
    bodyColor: 0x232b3a,
  },
  {
    id: 'neon',
    label: 'นีออน',
    hint: 'สีจัดจ้านบนพลาสติกดำสนิท',
    faceColors: {
      U: 0xe2e8f0,
      D: 0xf2ff00,
      F: 0x00ff9d,
      B: 0x00d5ff,
      R: 0xff2d6f,
      L: 0xff8a00,
    },
    bodyColor: 0x05070c,
  },
  {
    id: 'contrast',
    label: 'คอนทราสต์สูง',
    hint: 'สีแยกกันชัด สำหรับคนที่แยกเขียว/ส้มยาก',
    faceColors: {
      U: 0xffffff,
      D: 0xffd400,
      F: 0x00b050,
      B: 0x0057ff,
      R: 0xe8112d,
      L: 0xff7a00,
    },
    bodyColor: 0x000000,
  },
];

export const DEFAULT_SKIN_ID = 'classic';

/** สกินตามรหัส — รหัสที่ไม่รู้จัก (ข้อมูลเก่า/พิมพ์มั่ว) ตกกลับไปที่สกินตั้งต้นเสมอ ไม่ throw */
export function getSkin(id: string | null | undefined): CubeSkin {
  return CUBE_SKINS.find((skin) => skin.id === id) ?? CLASSIC_SKIN;
}

export const CLASSIC_SKIN: CubeSkin = CUBE_SKINS[0]!;

/**
 * รูบิคทรงพีระมิดมี 4 หน้า จึงใช้จานสีของลูกบาศก์ไม่ครบทุกสี — เลือกมา 4 สีที่แยกกันชัดที่สุด
 * (ข้ามขาวกับส้มเพราะขาวจมกับสติกเกอร์สว่าง และส้มใกล้แดงเกินไปเมื่อหน้าเอียงรับแสง)
 *
 * เรียงตามลำดับหน้าที่ `pyramorphix/pyramorphix-geometry.ts` กับ
 * `pyraminx/pyraminx-geometry.ts` ประกาศไว้
 */
export function tetraFaceColors(skin: CubeSkin): readonly number[] {
  return [
    skin.faceColors.F, // เขียว
    skin.faceColors.R, // แดง
    skin.faceColors.B, // น้ำเงิน
    skin.faceColors.D, // เหลือง
  ];
}

// ---------------------------------------------------------------- ของเดิม (= สกิน classic)
// สคริปต์ `verify-*` กับโค้ดที่ไม่สนใจสกินยังใช้ค่าพวกนี้ได้เหมือนเดิม

export const FACE_COLORS: Record<string, number> = CLASSIC_SKIN.faceColors;
export const BODY_COLOR = CLASSIC_SKIN.bodyColor;
export const TETRA_FACE_COLORS: readonly number[] = tetraFaceColors(CLASSIC_SKIN);
