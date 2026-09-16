/**
 * ทางออกของรูปการ์ดแชร์ — เมนูแชร์ของเครื่องก่อน ถ้าไม่ได้ค่อยดาวน์โหลด (ADR-074 ข้อ 5)
 *
 * ⚠️ **เฟส 9 (Capacitor) ต้องแก้ที่ไฟล์นี้ไฟล์เดียว** — WebView แชร์ไฟล์ผ่าน Web Share API ไม่ได้
 * ต้องเขียนไฟล์ด้วย `@capacitor/filesystem` แล้วส่ง path ให้ `@capacitor/share` แทน
 * → หน้าจอเรียกแค่ `shareOrDownloadImage()` ห้ามเรียก `navigator.share` เองที่อื่น
 */

/** ผลของการกดปุ่ม — ทุกทางมีปลายทาง ไม่มีทางไหน throw ออกไปให้หน้าจอพัง */
export type ShareImageResult = 'shared' | 'downloaded' | 'cancelled' | 'failed';

/** canvas → ไฟล์ PNG · `null` = เบราว์เซอร์แปลงไม่ได้ (ไม่เคยเจอ แต่ `toBlob` คืน null ได้ตามสเปก) */
export async function canvasToPngFile(
  canvas: HTMLCanvasElement,
  fileName: string,
): Promise<File | null> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), 'image/png');
  });
  if (!blob) return null;
  return new File([blob], fileName, { type: 'image/png' });
}

/** ดาวน์โหลดไฟล์ลงเครื่อง — คืน object URL ทิ้งเสมอ ไม่งั้นรูปค้างใน memory ทั้งแท็บ */
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // ปล่อยให้เบราว์เซอร์เริ่มโหลดก่อนค่อยคืน URL
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * แชร์รูปเข้าเมนูของเครื่อง ถ้าทำไม่ได้ก็ดาวน์โหลดแทน
 *
 * `canShare` ต้องถามด้วย **ไฟล์จริง** เพราะบางเครื่องรับแชร์ลิงก์ได้แต่รับไฟล์ไม่ได้
 * · ผู้ใช้กดยกเลิกเมนูแชร์ = `AbortError` ซึ่ง **ไม่ใช่ error** ต้องเงียบ ไม่ใช่เด้งไปดาวน์โหลดให้เอง
 */
export async function shareOrDownloadImage(
  file: File,
  meta: { title: string; text?: string; url?: string },
): Promise<ShareImageResult> {
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: meta.title, text: meta.text, url: meta.url });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      // เครื่องรับแชร์ไฟล์ไม่ไหวจริง ๆ (บางเบราว์เซอร์ตอบ NotAllowedError) → ตกไปดาวน์โหลด
    }
  }

  try {
    downloadFile(file);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}

/** คัดลอกลิงก์ — แยกจากการแชร์รูป เพราะปุ่มคนละปุ่มและต้องใช้ได้เสมอแม้แชร์รูปไม่ได้ */
export async function copyLink(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}
