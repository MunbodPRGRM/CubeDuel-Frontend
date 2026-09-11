import type { ReactNode } from 'react';
import { CubeLogo } from './CubeLogo';

/**
 * หน้าจอ error เต็มหน้า — ใช้ตอนแอปไปต่อไม่ได้จริง ๆ (render พัง / เน็ตหลุด / server ไม่ตอบ)
 *
 * **ตั้งใจไม่ใช้ `AppHeader`** เพราะตัวที่เรียกหน้านี้บ่อยที่สุดคือ `ErrorBoundary` ซึ่งอาจถูก
 * ปลุกโดย error ที่เกิดใน `AppHeader` เอง (มันยิง REST ขอ rating ด้วย) — วาดแถบเดิมซ้ำ
 * ก็จะพังซ้ำแล้วเหลือจอขาวเหมือนเดิม · ที่นี่จึงวาดแค่โลโก้กับลิงก์ `<a>` ธรรมดา
 * ไม่พึ่ง react-router เผื่อกรณีที่ router เองเป็นตัวพัง
 */
export function ErrorScreen({
  title,
  message,
  detail,
  actions,
}: {
  title: string;
  message: string;
  /** รายละเอียดทางเทคนิค — โชว์เฉพาะตอน dev เท่านั้น ผู้ใช้จริงไม่ต้องเห็น */
  detail?: string | null;
  actions?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-navy-900">
      <header className="border-b border-line bg-navy-950/70">
        <div className="page-wide flex h-16 items-center gap-2.5 px-4">
          <CubeLogo size={30} />
          <span className="text-lg font-bold tracking-tight text-white">CubeDuel</span>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div
          role="alert"
          className="w-full max-w-md rounded-2xl border border-line bg-navy-850/80 px-6 py-10 text-center"
        >
          <h1 className="text-xl font-bold text-white">{title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">{message}</p>

          {detail && (
            <pre className="mt-4 overflow-x-auto rounded-xl border border-line-soft bg-navy-950/60 px-3 py-2 text-left text-xs text-slate-500">
              {detail}
            </pre>
          )}

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">{actions}</div>
        </div>
      </main>
    </div>
  );
}

/** ปุ่มหลักของหน้า error — ใช้ `<button>` เสมอ เพราะทุกปุ่มบนหน้านี้เป็นการสั่งงาน ไม่ใช่การเปิดลิงก์ */
export function ErrorAction({
  children,
  onClick,
  tone = 'primary',
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: 'primary' | 'ghost';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        tone === 'primary'
          ? 'rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600'
          : 'rounded-xl border border-line px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white'
      }
    >
      {children}
    </button>
  );
}

/**
 * กล่อง error ในหน้า — ใช้แทนที่ข้อความสีแดงลอย ๆ ที่เคยเขียนซ้ำกันทุกหน้า
 * มีปุ่ม "ลองใหม่" ให้เมื่อผู้เรียกส่ง `onRetry` มา (ควรส่งเสมอถ้าเป็น error จากการโหลดข้อมูล)
 */
export function ErrorNotice({
  message,
  onRetry,
  className = '',
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`rounded-2xl border border-loss/40 bg-loss/5 px-6 py-10 text-center ${className}`}
    >
      <p className="text-sm text-loss">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-xl border border-line px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white"
        >
          ลองใหม่
        </button>
      )}
    </div>
  );
}
