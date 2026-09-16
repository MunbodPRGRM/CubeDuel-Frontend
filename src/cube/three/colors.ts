/**
 * จานสีของคิวบ์ 3 มิติ — รวมไว้ที่เดียวเพราะฟีเจอร์ "เลือกสกินสี" (ข้อ 10 ใน CLAUDE.md)
 *
 * **เฟส 8 ก้อนที่ 1:** ที่นี่กลายเป็น **แหล่งความจริงของสกินทั้งหมด** แล้ว — geometry ทุกตัว
 * รับ `CubeSkin` เข้าไปแทนที่จะ import ค่าคงที่ตรง ๆ (ADR-048 ข้อ 2)
 * ฝั่ง server เก็บแค่ **รหัส** ของสกินลง `User.cube_skin` และรู้จักเฉพาะรายชื่อใน
 * `backend/src/constants.ts` → **เพิ่มสกินใหม่ต้องแก้สองไฟล์นั้นพร้อมกัน** (ADR-021)
 *
 * สกินตั้งต้น (`classic`) ยึดสีมาตรฐาน WCA แล้วดันความสว่างขึ้นนิดให้ตัดกับพื้นหลัง navy ของดีไซน์ (ADR-024)
 *
 * **เฟส 13 ก้อนที่ 11 (ADR-080):** 12 สกิน 5 หมวด ฟรีทั้งหมด · ทุกสกินเปลี่ยนแค่ **โทน** ตัวตนของหน้าคงเดิม
 * (U ขาว · D เหลือง · F เขียว · B น้ำเงิน · R แดง · L ส้ม) ยกเว้น `colorblind` ที่ R เป็นชมพูอมม่วงโดยจงใจ
 * · สีต้องแยกกันออกตามเกณฑ์ของ `npm run verify:skins` — แก้สีแล้วรันทุกครั้ง
 */

/** ชื่อหน้าตามโน้ตเทชัน — ลูกบาศก์ใช้ครบ 6 หน้า ทรงพีระมิดหยิบไปใช้ 4 หน้า */
export type FaceName = 'U' | 'D' | 'F' | 'B' | 'R' | 'L';

/** หมวดของสกินบนหน้า `/skins` — ลำดับใน `SKIN_CATEGORIES` คือลำดับของตัวกรอง */
export type SkinCategory = 'standard' | 'vivid' | 'soft' | 'nature' | 'accessible';

export const SKIN_CATEGORIES: readonly { id: SkinCategory; label: string }[] = [
  { id: 'standard', label: 'มาตรฐาน' },
  { id: 'vivid', label: 'สดใส' },
  { id: 'soft', label: 'โทนนุ่ม' },
  { id: 'nature', label: 'ธีมธรรมชาติ' },
  { id: 'accessible', label: 'อ่านง่าย' },
];

export interface CubeSkin {
  /** ต้องตรงกับรายชื่อใน `backend/src/constants.ts` (`CUBE_SKINS`) */
  id: string;
  label: string;
  /** คำอธิบายสั้น ๆ ของบุคลิกสกิน — ใต้ชื่อบนการ์ดในหน้า `/skins` */
  hint: string;
  category: SkinCategory;
  faceColors: Record<FaceName, number>;
  /** เนื้อพลาสติกและรอยตัดที่ไม่ใช่ผิวนอก */
  bodyColor: number;
}

export const CUBE_SKINS: readonly CubeSkin[] = [
  {
    id: 'classic',
    label: 'มาตรฐาน',
    hint: 'สีตามลูกจริงของ WCA',
    category: 'standard',
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
    id: 'retro',
    label: 'ย้อนยุค',
    hint: 'สีหม่นแบบลูกบิดยุค 80',
    category: 'standard',
    faceColors: {
      U: 0xeae7dc, // ขาวงาช้าง
      D: 0xf2c14e, // เหลือง
      F: 0x3e8e41, // เขียว
      B: 0x2f5d8a, // น้ำเงิน
      R: 0xb83b3b, // แดง
      L: 0xe07a2e, // ส้ม
    },
    bodyColor: 0x1a1a1a,
  },
  {
    id: 'midnight',
    label: 'ราตรี',
    hint: 'สีเข้มอิ่ม ไม่แสบตาในห้องมืด',
    category: 'standard',
    faceColors: {
      U: 0xcbd5e1, // เทาแสงจันทร์
      D: 0xeab308, // เหลือง
      F: 0x16a34a, // เขียว
      B: 0x4f46e5, // คราม
      R: 0xdc2626, // แดง
      L: 0xf97316, // ส้ม
    },
    bodyColor: 0x05060f,
  },
  {
    id: 'neon',
    label: 'นีออน',
    hint: 'สีจัดจ้านบนพลาสติกดำสนิท',
    category: 'vivid',
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
    id: 'candy',
    label: 'ลูกกวาด',
    hint: 'สีหวานสดใสแบบขนม',
    category: 'vivid',
    faceColors: {
      U: 0xffffff, // ขาว
      D: 0xfff176, // เหลือง
      F: 0x69f0ae, // เขียว
      B: 0x40c4ff, // น้ำเงิน
      R: 0xff4081, // ชมพูเข้ม
      L: 0xffab40, // ส้ม
    },
    bodyColor: 0x1e1b2e,
  },
  {
    id: 'sunset',
    label: 'พระอาทิตย์ตก',
    hint: 'โทนอุ่นบนพลาสติกม่วงเข้ม',
    category: 'vivid',
    faceColors: {
      U: 0xfff1e6, // ขาวอมส้ม
      D: 0xffd166, // เหลือง
      F: 0x06d6a0, // เขียวมินต์
      B: 0x5e60ce, // ม่วงน้ำเงิน
      R: 0xef476f, // แดงอมชมพู
      L: 0xff8c42, // ส้ม
    },
    bodyColor: 0x1c0f1a,
  },
  {
    id: 'pastel',
    label: 'พาสเทล',
    hint: 'สีอ่อน สบายตาเวลาเล่นนาน ๆ',
    category: 'soft',
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
    id: 'sakura',
    label: 'ซากุระ',
    hint: 'ชมพูอ่อนละมุน สบายตา',
    category: 'soft',
    faceColors: {
      U: 0xfff7fb, // ขาวอมชมพู
      D: 0xffe57a, // เหลือง
      F: 0x86e0a8, // เขียว
      B: 0x90cdf4, // น้ำเงิน
      R: 0xf687b3, // ชมพูซากุระ
      L: 0xfba36b, // ส้ม
    },
    bodyColor: 0x2a1f2b,
  },
  {
    id: 'ocean',
    label: 'มหาสมุทร',
    hint: 'ฟ้าทะเลบนพลาสติกน้ำเงินเข้ม',
    category: 'nature',
    faceColors: {
      U: 0xe0f2fe, // ขาวฟ้าน้ำแข็ง
      D: 0xf5d67b, // เหลืองทราย
      F: 0x14b8a6, // เขียวน้ำทะเล
      B: 0x2563eb, // น้ำเงิน
      R: 0xf43f5e, // แดงปะการัง
      L: 0xfb923c, // ส้ม
    },
    bodyColor: 0x0c1f33,
  },
  {
    id: 'forest',
    label: 'ป่าไม้',
    hint: 'โทนดินและใบไม้',
    category: 'nature',
    faceColors: {
      U: 0xf5f5dc, // ขาวครีม
      D: 0xecd444, // เหลือง
      F: 0x52b788, // เขียวใบไม้
      B: 0x457b9d, // น้ำเงินอมเทา
      R: 0xd62828, // แดงเบอร์รี่
      L: 0xee8434, // ส้ม
    },
    bodyColor: 0x13160f,
  },
  {
    id: 'contrast',
    label: 'คอนทราสต์สูง',
    hint: 'สีแยกกันชัด สำหรับคนที่แยกเขียว/ส้มยาก',
    category: 'accessible',
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
  {
    id: 'colorblind',
    label: 'สำหรับคนตาบอดสี',
    hint: 'จานสี Okabe–Ito · หน้า R เป็นชมพูแทนแดง',
    category: 'accessible',
    faceColors: {
      U: 0xffffff, // ขาว
      D: 0xf0e442, // เหลือง
      F: 0x009e73, // เขียว
      B: 0x0072b2, // น้ำเงิน
      R: 0xcc79a7, // ชมพูอมม่วง (จงใจ — แดงกับส้มคือคู่ที่แยกยากที่สุด)
      L: 0xe69f00, // ส้ม
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
