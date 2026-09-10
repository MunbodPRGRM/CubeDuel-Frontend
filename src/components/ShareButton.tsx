import { useEffect, useState } from 'react';

interface ShareButtonProps {
  /** พาธในเว็บ เช่น `/users/12` — เติมโดเมนให้เองตอนแชร์ */
  path: string;
  /** ข้อความที่ติดไปกับลิงก์เวลาใช้เมนูแชร์ของเครื่อง */
  title: string;
  text?: string;
  label?: string;
  className?: string;
}

/**
 * ปุ่มแชร์ลิงก์ — ใช้เมนูแชร์ของเครื่องถ้ามี (มือถือ/Capacitor เฟส 9) ไม่มีก็คัดลอกลิงก์ลงคลิปบอร์ด
 *
 * ต้องมี URL จริงถึงจะแชร์ได้ → ของที่แชร์ได้ทุกชิ้นต้องมีเส้นทางของตัวเอง
 * (ผลแมตช์เคยเป็น modal อย่างเดียว เฟส 8 จึงเพิ่มหน้าเต็มให้ด้วย — ADR-048 ข้อ 4)
 */
export function ShareButton({ path, title, text, label = 'แชร์', className }: ShareButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const timer = window.setTimeout(() => setState('idle'), 2000);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function share() {
    const url = new URL(path, window.location.origin).toString();

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // ผู้ใช้กดยกเลิกเมนูแชร์ หรือเบราว์เซอร์ไม่ยอมให้แชร์ — ตกไปใช้การคัดลอกแทน
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      setState('failed');
    }
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      className={
        className ??
        'rounded-xl border border-line bg-navy-800 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-navy-700 hover:text-white'
      }
    >
      {state === 'copied'
        ? '✓ คัดลอกลิงก์แล้ว'
        : state === 'failed'
          ? 'คัดลอกไม่สำเร็จ'
          : `🔗 ${label}`}
    </button>
  );
}
