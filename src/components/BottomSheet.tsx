import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  /** หัวข้อของแผ่น — ใช้เป็นชื่อของ dialog ให้โปรแกรมอ่านจอด้วย */
  title: string;
  /** ซ่อนหัวข้อด้วยตา (ยังอ่านได้ด้วยโปรแกรมอ่านจอ) — ใช้ตอนเนื้อในมีหัวข้อใหญ่ของตัวเองแล้ว */
  hideTitle?: boolean;
  /**
   * `false` = กด `Esc` / แตะพื้นหลังแล้ว **ไม่ปิด** — ใช้กับแผ่นที่ต้องเลือกปุ่มข้างในเท่านั้น
   * ต้องมีปุ่มปิดในเนื้อหาเองเสมอ ไม่งั้นผู้ใช้ติดอยู่ในแผ่น
   */
  dismissible?: boolean;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * **แผ่นเลื่อนขึ้นจากล่าง** — ตัวเดียวของทั้งแอป ใช้แทน dialog กลางจอ **เฉพาะจอแคบ** (ADR-083 ข้อ 9)
 * เช่น ผลจบรอบ · เมนู ⋯ ของโปรไฟล์ · รายละเอียดแมตช์ · รายงานผู้เล่น
 *
 * - โฟกัสวนอยู่ในแผ่น (`Tab` / `Shift+Tab`) · เปิดแล้วโฟกัสของตัวแรก · ปิดแล้วคืนโฟกัสให้ปุ่มที่เปิด
 * - ล็อกการเลื่อนของหน้าข้างหลังระหว่างเปิด — ไม่งั้นลากนิ้วในแผ่นแล้วหน้าข้างหลังเลื่อนตาม
 * - วาดผ่าน portal ที่ `<body>` — ถ้าวางใต้กล่องที่มี `backdrop-blur`/`transform` ตำแหน่ง `fixed` จะเพี้ยน
 * - แอนิเมชันเฉพาะ `motion-safe`
 *
 * ⚠️ **ไม่ใช้กับ** `ReadyCheckModal` (ต้องเด่นกลางจอ) และ `PlaySettingsMenu` (ต้องเห็นผลข้างหลัง — ADR-063 ข้อ 1)
 */
export function BottomSheet({
  open,
  onClose,
  title,
  hideTitle = false,
  dismissible = true,
  children,
}: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // เก็บ onClose ตัวล่าสุดไว้ใน ref — ผู้ใช้ส่ง arrow function ใหม่ทุก render แล้ว effect จะรันซ้ำจนโฟกัสกระโดด
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = panel.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel).focus({ preventScroll: true });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissible) {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const head = items[0];
      const tail = items[items.length - 1];
      if (event.shiftKey && document.activeElement === head) {
        event.preventDefault();
        tail.focus();
      } else if (!event.shiftKey && document.activeElement === tail) {
        event.preventDefault();
        head.focus();
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      // ปุ่มที่เปิดอาจหายไปแล้ว (เช่น หน้าวาดใหม่) — คืนโฟกัสเฉพาะตอนที่มันยังอยู่ในหน้า
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open, dismissible]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div
        aria-hidden
        className="absolute inset-0 bg-navy-950/70 motion-safe:animate-fade-in"
        onClick={dismissible ? onClose : undefined}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex max-h-[85dvh] flex-col gap-4 overflow-y-auto overscroll-contain rounded-t-3xl border-t border-line bg-navy-850 px-5 pt-2.5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl outline-none motion-safe:animate-sheet-up"
      >
        <span aria-hidden className="mx-auto h-1 w-10 shrink-0 rounded-full bg-line" />
        <h2 id={titleId} className={hideTitle ? 'sr-only' : 'text-lg font-semibold text-slate-100'}>
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
