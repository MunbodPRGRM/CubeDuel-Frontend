import { useEffect, useRef, useState } from 'react';
import { TUTORIAL_STEPS } from './tutorial-steps';

interface TutorialDialogProps {
  /** ปิดกล่อง — ตัวเรียกเป็นคนตัดสินว่าจะจำว่า “ดูแล้ว” หรือไม่ */
  onClose: () => void;
}

/**
 * กล่องโหมดฝึกสอนการใช้งาน — ทีละขั้น กด “ถัดไป” ไปเรื่อย ๆ จนจบ
 *
 * ทำเป็น modal เหมือนงานอื่นทุกชิ้นในเว็บนี้ (ADR-051 ข้อ 3) ไม่ใช่หน้า `/tutorial`
 * เพราะเปิดจากหน้าไหนก็ได้โดยไม่ทำให้ผู้ใช้หลุดออกจากสิ่งที่ทำค้างไว้ (เช่น รออยู่ในคิว)
 */
export function TutorialDialog({ onClose }: TutorialDialogProps) {
  const [index, setIndex] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const step = TUTORIAL_STEPS[index];
  const isLast = index === TUTORIAL_STEPS.length - 1;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, TUTORIAL_STEPS.length - 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // โฟกัสปุ่มหลักตอนเปิด เพื่อให้กด Enter รัวจบคู่มือได้โดยไม่ต้องแตะเมาส์
  useEffect(() => {
    nextRef.current?.focus();
  }, []);

  // ขั้นที่ยาวกว่าจอ (มือถือ) ต้องเริ่มอ่านจากบนสุดทุกครั้งที่เปลี่ยนขั้น
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [index]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="โหมดฝึกสอนการใช้งาน"
      className="fixed inset-0 z-50 grid place-items-center bg-navy-950/85 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-line bg-navy-850 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-brand-400">
              วิธีใช้งาน · ขั้นที่ {index + 1} จาก {TUTORIAL_STEPS.length}
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-slate-100">{step.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดคู่มือ"
            className="-mr-1 -mt-1 shrink-0 rounded-lg px-2 py-1 text-slate-500 transition hover:bg-navy-800 hover:text-slate-200"
          >
            ✕
          </button>
        </header>

        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p className="text-sm leading-6 text-slate-300">{step.lead}</p>

          <div className="mt-3">{step.visual}</div>

          <ul className="mt-3 space-y-1.5">
            {step.points.map((point) => (
              <li key={point} className="flex gap-2 text-xs leading-5 text-slate-400">
                <span aria-hidden className="text-brand-500">
                  •
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <footer className="flex items-center gap-3 border-t border-line px-5 py-4">
          {/* จุดบอกความคืบหน้า — กดข้ามไปขั้นไหนก็ได้ ไม่ต้องกดถัดไปทีละครั้ง */}
          <div className="flex flex-1 flex-wrap gap-1.5">
            {TUTORIAL_STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`ไปขั้นที่ ${i + 1}: ${s.title}`}
                aria-current={i === index ? 'step' : undefined}
                onClick={() => setIndex(i)}
                className={`h-2 rounded-full transition ${
                  i === index ? 'w-5 bg-brand-500' : 'w-2 bg-navy-700 hover:bg-navy-800'
                }`}
              />
            ))}
          </div>

          {index > 0 && (
            <button
              type="button"
              onClick={() => setIndex((i) => i - 1)}
              className="rounded-xl border border-line bg-navy-800 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-navy-700"
            >
              ย้อนกลับ
            </button>
          )}
          <button
            ref={nextRef}
            type="button"
            onClick={() => (isLast ? onClose() : setIndex((i) => i + 1))}
            className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            {isLast ? 'เริ่มเล่นเลย' : 'ถัดไป'}
          </button>
        </footer>
      </div>
    </div>
  );
}
