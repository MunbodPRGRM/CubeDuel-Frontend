/**
 * โมเดลตรรกะของ **Pyramorphix** (เขียนใหม่ในเฟส 3.5 ก้อนที่ 2)
 *
 * Pyramorphix คือ 2x2x2 ที่ถูกตัดเป็นทรงสี่หน้า — ตรรกะการหมุนจึงเหมือนกันทุกประการ
 * จึงสืบทอด `NxNCubeModel(2)` มาตรง ๆ แล้วเพิ่มมาแค่เรื่องเดียว: **กติกา "แก้เสร็จ"**
 *
 * ### เปลี่ยนอะไรจากของเดิม
 *
 * ของเดิมเอาลำดับชิ้นและกติกาแก้เสร็จมาจาก KPuzzle ของ cubing.js (`deriveSlotOctants` +
 * `isPyramorphixSolved` ที่ไปอ่าน `patternData.CORNERS`) ทำให้ Pyramorphix เป็นประเภทเดียว
 * ที่รูปร่างของโมเดลถูกกำหนดโดยไลบรารีข้างนอก ต่างจาก 2x2x2 / 3x3x3 ที่คิดพิกัดเอง
 *
 * ตอนนี้ **คิดเองทั้งหมดเหมือนอีกสองประเภท** — พิกัดชิ้นมาจาก `NxNCubeModel.homeCoordsFor(2)`
 * และ "แก้เสร็จ" ตัดสินจากแลตทิซของเราเอง ส่วน KPuzzle ถอยไปเป็นตัวตรวจสอบใน
 * `scripts/verify-pyramorphix.ts` อย่างเดียว (ADR-028)
 *
 * ไฟล์นี้ **ห้าม import three หรือ DOM** — สคริปต์ `verify-*` รันบน Node เปล่า ๆ
 */
import { NxNCubeModel } from '../nxn/cube-model.ts';
import { IDENTITY, matEq } from '../three/lattice.ts';

export class PyramorphixModel extends NxNCubeModel {
  /**
   * ชิ้นที่โผล่ออกมาเป็น **ยอดพีระมิด** (เห็น 3 หน้า จึงมองออกว่าหมุนไปทางไหน)
   *
   * ยอดพีระมิดคือ octant ที่คูณเครื่องหมายทั้งสามแล้วได้ +1 — ตรงกับจุดยอดของทรงสี่หน้า
   * ที่ฝังอยู่ในลูกบาศก์ (ดู `pyramorphix-geometry.ts`) อีก 4 ชิ้นโผล่เป็นสามเหลี่ยม
   * กลางหน้า เห็นสีเดียว มองไม่ออกว่าหมุนไปทางไหน
   */
  readonly apexPieces: readonly number[];

  constructor() {
    super(2);
    this.apexPieces = this.lattice.homeCoords
      .map((coord, id) => ({ coord, id }))
      .filter(({ coord }) => coord[0]! * coord[1]! * coord[2]! === 1)
      .map(({ id }) => id);

    if (this.apexPieces.length !== 4) {
      throw new Error(`ยอดพีระมิดต้องมี 4 ชิ้น แต่คำนวณได้ ${this.apexPieces.length}`);
    }
  }

  /**
   * **แก้เสร็จ = ทุกชิ้นกลับบ้าน AND ยอดพีระมิดทั้ง 4 ชิ้นหันตรง** (ADR-019)
   *
   * ไม่ตรวจทิศทางของชิ้นกลางหน้า เพราะมันเป็นสามเหลี่ยมสีเดียว — ท่าที่เหลือของมัน
   * (หมุนรอบเส้นทแยงมุมของตัวเอง) ให้ภาพเดิมเป๊ะ ถ้าไปตรวจด้วยจะเกิดกรณี
   * **"คิวบ์ดูแก้เสร็จแล้วด้วยตาเปล่า แต่ระบบบอกว่ายังไม่เสร็จ"** ซึ่งผู้เล่นจะมองว่าเป็นบั๊ก
   *
   * ชิ้นที่กลับบ้านแล้วจะเหลือท่าที่เป็นไปได้แค่ 3 ท่า (หมุนรอบเส้นทแยงมุมของ octant ตัวเอง)
   * เงื่อนไข "กลับบ้าน" จึงคุมชิ้นกลางหน้าไว้พอดีอยู่แล้ว ไม่ต้องเช็คอะไรเพิ่ม
   */
  isSolved(): boolean {
    for (let id = 0; id < this.pieceCount; id++) {
      if (this.lattice.slotOf(this.lattice.coords[id]!) !== id) return false;
    }
    return this.apexPieces.every((id) => matEq(this.lattice.rotations[id]!, IDENTITY));
  }
}
