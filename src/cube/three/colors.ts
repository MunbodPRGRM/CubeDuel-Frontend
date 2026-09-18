/**
 * จานสี + ลวดลาย + ผิวของคิวบ์ 3 มิติ — รวมไว้ที่เดียวเพราะฟีเจอร์ "เลือกสกิน" (ข้อ 10 ใน CLAUDE.md)
 *
 * **เฟส 8 ก้อนที่ 1:** ที่นี่กลายเป็น **แหล่งความจริงของสกินทั้งหมด** แล้ว — geometry ทุกตัว
 * รับ `CubeSkin` เข้าไปแทนที่จะ import ค่าคงที่ตรง ๆ (ADR-048 ข้อ 2)
 * ฝั่ง server เก็บแค่ **รหัส** ของสกินลง `User.cube_skin` และรู้จักเฉพาะรายชื่อใน
 * `backend/src/constants.ts` → **เพิ่มสกินใหม่ต้องแก้สองไฟล์นั้นพร้อมกัน** (ADR-021)
 *
 * สกินตั้งต้น (`classic`) ยึดสีมาตรฐาน WCA แล้วดันความสว่างขึ้นนิดให้ตัดกับพื้นหลัง navy ของดีไซน์ (ADR-024)
 *
 * **เฟส 13 ก้อนที่ 25 (ADR-087):** เหลือ `classic` + 4 สกินที่มี **ลวดลาย + ผิววัสดุ** ของตัวเอง
 * (สกินเปลี่ยนสีอย่างเดียว 11 ตัวของ ADR-080 ถูกลบ) · ไม่มีหมวดแล้ว
 * · **ตัวตนของแต่ละหน้ายังคงเดิมทุกสกิน** (U ขาว · D เหลือง · F เขียว · B น้ำเงิน · R แดง · L ส้ม)
 * · สีต้องแยกกันออกตามเกณฑ์ของ `npm run verify:skins` **รวมตอนถูกลายคูณให้มืดลงแล้ว** — แก้สี/ลายแล้วรันทุกครั้ง
 */
import type { PatternKind } from './skin-patterns.ts';

/** ชื่อหน้าตามโน้ตเทชัน — ลูกบาศก์ใช้ครบ 6 หน้า ทรงพีระมิดหยิบไปใช้ 4 หน้า */
export type FaceName = 'U' | 'D' | 'F' | 'B' | 'R' | 'L';

/**
 * ผิววัสดุของสกิน (ADR-087 ข้อ 4) — `ThreeCubeView` ตั้งลง material ตัวเดียวของคิวบ์
 *
 * "เคลือบเงา/ขัดเงา" ทำด้วย `roughness` ต่ำ ไม่ใช้ `MeshPhysicalMaterial` (หนักบนมือถือ ตาแยกไม่ค่อยออก)
 */
export interface SkinFinish {
  roughness: number;
  metalness: number;
  /**
   * ความแรงของการเรืองแสงตามสีสติกเกอร์ (0 = ไม่เรือง) — เรืองเฉพาะส่วนสว่างของลาย ร่องไม่เรือง
   * เนื้อพลาสติกไม่เรืองเสมอ
   */
  glow: number;
  /**
   * ต้องมี environment map ไหม — โลหะที่ไม่มีอะไรให้สะท้อนจะออกมามืดเกือบดำ
   * สกินอื่นไม่ใส่ แสงจะได้เหมือนเดิมเป๊ะ
   */
  environment: boolean;
}

export interface CubeSkin {
  /** ต้องตรงกับรายชื่อใน `backend/src/constants.ts` (`CUBE_SKINS`) */
  id: string;
  label: string;
  /** คำอธิบายสั้น ๆ ของบุคลิกสกิน — ใต้ชื่อบนการ์ดในหน้า `/skins` */
  hint: string;
  /** ป้ายสั้นบนการ์ด/พรีวิว บอกลายกับผิว (แทนป้ายหมวดเดิม) */
  tag: string;
  faceColors: Record<FaceName, number>;
  /** เนื้อพลาสติกและรอยตัดที่ไม่ใช่ผิวนอก */
  bodyColor: number;
  /** ลวดลายบนสติกเกอร์ · `null` = สีเรียบ (ADR-087 ข้อ 2) */
  pattern: PatternKind | null;
  finish: SkinFinish;
}

/** ผิวพลาสติกเดิมก่อนมีสกินลวดลาย — `classic` ใช้ค่านี้ ภาพจึงเหมือนเดิมทุกพิกเซล */
const PLASTIC: SkinFinish = { roughness: 0.45, metalness: 0.02, glow: 0, environment: false };

export const CUBE_SKINS: readonly CubeSkin[] = [
  {
    id: 'classic',
    label: 'มาตรฐาน',
    hint: 'สีตามลูกจริงของ WCA',
    tag: 'สีเรียบ · พลาสติก',
    faceColors: {
      U: 0xf1f5f9, // ขาว
      D: 0xfacc15, // เหลือง
      F: 0x22c55e, // เขียว
      B: 0x3b82f6, // น้ำเงิน
      R: 0xef4444, // แดง
      L: 0xf97316, // ส้ม
    },
    bodyColor: 0x0b0f16,
    pattern: null,
    finish: PLASTIC,
  },
  {
    id: 'carbon',
    label: 'คาร์บอน',
    hint: 'ลายสานคาร์บอนไฟเบอร์ใต้ผิวเคลือบเงา',
    tag: 'ลายคาร์บอน · เคลือบเงา',
    faceColors: {
      U: 0xf4f4f5, // ขาว
      D: 0xfacc15, // เหลือง
      F: 0x10b981, // เขียว
      B: 0x5596fa, // น้ำเงิน
      R: 0xe11d48, // แดง
      L: 0xf97316, // ส้ม
    },
    bodyColor: 0x17191d,
    pattern: 'carbon',
    finish: { roughness: 0.22, metalness: 0.05, glow: 0, environment: false },
  },
  {
    id: 'honeycomb',
    label: 'รังผึ้ง',
    hint: 'ตารางหกเหลี่ยมเรืองแสงบนพลาสติกดำ',
    tag: 'ลายหกเหลี่ยม · เรืองแสง',
    faceColors: {
      U: 0xe0f2fe, // ขาวอมฟ้า
      D: 0xfde047, // เหลือง
      F: 0x22c55e, // เขียว
      B: 0x5a9cff, // น้ำเงิน
      R: 0xf43f5e, // แดง
      L: 0xfb923c, // ส้ม
    },
    bodyColor: 0x05070d,
    pattern: 'honeycomb',
    finish: { roughness: 0.5, metalness: 0, glow: 0.45, environment: false },
  },
  {
    id: 'marble',
    label: 'หินอ่อน',
    hint: 'เส้นหินอ่อนขัดเงา ไม่มีแผ่นไหนซ้ำกัน',
    tag: 'ลายหินอ่อน · ขัดเงา',
    faceColors: {
      U: 0xf5f3ee, // ขาวงาช้าง
      D: 0xf2c94c, // เหลือง
      F: 0x2fa36b, // เขียวหยก
      B: 0x6f93dd, // น้ำเงินลาพิส
      R: 0xd1383a, // แดงแจสเปอร์
      L: 0xef8a3c, // ส้มอำพัน
    },
    bodyColor: 0x121110,
    pattern: 'marble',
    finish: { roughness: 0.18, metalness: 0, glow: 0, environment: false },
  },
  {
    id: 'brushed',
    label: 'โลหะขัด',
    hint: 'อะลูมิเนียมขัดลาย ชิ้นกลางขัดวน',
    tag: 'ลายขัด · โลหะ',
    faceColors: {
      U: 0xe5e7eb, // เงิน
      D: 0xf5c542, // ทอง
      F: 0x3fb950, // เขียว
      B: 0x3b82f6, // น้ำเงิน
      R: 0xef4444, // แดง
      L: 0xf28c28, // ส้มทองแดง
    },
    bodyColor: 0x131518,
    pattern: 'brushed',
    finish: { roughness: 0.35, metalness: 0.55, glow: 0, environment: true },
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
