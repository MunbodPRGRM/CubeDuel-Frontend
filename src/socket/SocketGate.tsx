import type { ReactNode } from 'react';
import { PageSpinner } from '@/components/PageSpinner';
import { useSocket } from './useSocket';

/**
 * ห่อหน้าที่ทำงานไม่ได้เลยถ้ายังไม่ได้ต่อ socket
 *
 * ต่างจาก `RequireAuth` ตรงที่ล็อกอินแล้วยังต่อไม่ติดได้ (backend ไม่ได้รัน / เน็ตหลุด)
 * — กรณีนั้นต้องบอกให้ชัดว่าเป็นเรื่องการเชื่อมต่อ ไม่ใช่ให้กดปุ่มแล้วเงียบไปเฉย ๆ
 *
 * ⚠️ อย่าเอาไปครอบ **หน้าห้อง** ตรง ๆ เพราะพอเน็ตกระตุกทีเดียวทั้งหน้าจะถูก unmount
 * (ในเฟส 4 ก้อน 4 = คิวบ์กับตัวจับเวลาหายกลางแมตช์) — หน้าห้องใช้ `ConnectionBanner` แทน
 */
export function SocketGate({ children }: { children: ReactNode }) {
  const { status } = useSocket();

  if (status === 'connected') return <>{children}</>;
  if (status === 'error') return <ConnectionErrorCard />;

  return (
    <div className="text-center">
      <PageSpinner />
      <p className="text-sm text-slate-500">กำลังเชื่อมต่อเซิร์ฟเวอร์…</p>
    </div>
  );
}

export function ConnectionErrorCard() {
  const { error, reconnect } = useSocket();

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-loss/40 bg-loss/5 px-6 py-8 text-center">
      <p className="font-semibold text-loss">เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ</p>
      <p className="mt-2 text-sm text-slate-400">
        {error?.message ?? 'ไม่ทราบสาเหตุ กรุณาลองใหม่อีกครั้ง'}
      </p>
      <button
        type="button"
        onClick={reconnect}
        className="mt-5 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
      >
        ลองเชื่อมต่อใหม่
      </button>
    </div>
  );
}

/**
 * แถบบางบอกสถานะการเชื่อมต่อ — ใช้กับหน้าที่ต้องคาหน้าจอไว้ระหว่างต่อใหม่
 * (ที่นั่งในห้องผูกกับ `userId` ไม่ใช่ socket ต่อกลับมาได้ก็ยังอยู่ห้องเดิม — ADR-034 ข้อ 3)
 */
export function ConnectionBanner() {
  const { status, error, reconnect } = useSocket();

  if (status === 'connected') return null;

  const isError = status === 'error';
  return (
    <div
      role="status"
      className={`flex flex-wrap items-center justify-center gap-3 rounded-xl border px-4 py-2.5 text-sm ${
        isError
          ? 'border-loss/40 bg-loss/10 text-loss'
          : 'border-gold-400/40 bg-gold-400/10 text-gold-400'
      }`}
    >
      {!isError && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-gold-400/30 border-t-gold-400" />
      )}
      <span>
        {isError
          ? (error?.message ?? 'การเชื่อมต่อหลุด')
          : 'การเชื่อมต่อหลุด กำลังต่อใหม่ให้อัตโนมัติ…'}
      </span>
      {isError && (
        <button type="button" onClick={reconnect} className="underline underline-offset-2">
          ลองใหม่
        </button>
      )}
    </div>
  );
}
