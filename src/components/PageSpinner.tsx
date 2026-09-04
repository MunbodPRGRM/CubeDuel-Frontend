/** ใช้ระหว่างรอกู้เซสชันตอนเปิดแอป — กันหน้าจอกระพริบไปหน้า login แล้วเด้งกลับ */
export function PageSpinner() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand-500" />
      <span className="sr-only">กำลังโหลด</span>
    </div>
  );
}
