/**
 * รูปร่างข้อมูลข่าวสาร — ต้องตรงกับ docs/api-contract.md ข้อ 7
 *
 * ⚠️ ไม่ได้แชร์กับ backend (ADR-021) — แก้ payload เมื่อไหร่ต้องแก้เอกสารก่อนแล้วไล่แก้สองฝั่ง
 */

export interface NewsAuthor {
  userId: number;
  username: string;
  nickname: string | null;
}

interface NewsBase {
  newsId: number;
  title: string;
  /** พาธ (`/uploads/news/…`) ไม่ใช่ URL เต็ม — ต่อโดเมนด้วย `fileUrl()` ก่อนใช้ */
  image: string | null;
  author: NewsAuthor;
  createdAt: string;
  updatedAt: string;
}

/** แถวในหน้ารายการ — ได้ **คำโปรย** ไม่ใช่เนื้อข่าวเต็ม (ADR-049 ข้อ 4) */
export interface NewsListItem extends NewsBase {
  excerpt: string;
}

/** หน้าอ่านข่าว — ได้เนื้อเต็มเป็น **ข้อความล้วน** ห้ามเอาไปใส่ `dangerouslySetInnerHTML` */
export interface NewsDetail extends NewsBase {
  content: string;
}

export function newsAuthorName(author: NewsAuthor): string {
  return author.nickname?.trim() || author.username;
}

/** วันที่แบบไทยสั้น ๆ ใช้ทั้งการ์ดข่าวและหน้าอ่านข่าว */
export function formatNewsDate(iso: string): string {
  return new Date(iso).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
