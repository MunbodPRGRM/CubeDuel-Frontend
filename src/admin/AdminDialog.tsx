import { useEffect, type ReactNode } from 'react';

/**
 * กล่องโต้ตอบของหน้าแอดมิน — ใช้ซ้ำทั้งแก้คะแนน / ตัดสินรายงาน / ตัดสิน flag
 *
 * ทุกงานของแอดมินเป็น "เปิดของชิ้นเดียวขึ้นมาทำแล้วกลับไปที่รายการ" → modal เหมาะกว่าหน้าแยก
 * ด้วยเหตุผลเดียวกับผลแมตช์ย้อนหลัง (ADR-047 ข้อ 6)
 */
export function AdminDialog({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 grid place-items-center bg-navy-950/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-navy-850 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-100">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-sm text-slate-400 transition hover:bg-navy-800 hover:text-slate-200"
          >
            ปิด
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
