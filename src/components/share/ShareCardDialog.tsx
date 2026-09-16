import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/auth/useAuth';
import { canvasToPngFile, copyLink, downloadFile, shareOrDownloadImage } from '@/lib/share-image';
import { CARD_HEIGHT, CARD_WIDTH, drawShareCard, ensureCardFonts } from './draw-share-card';
import { shareCardFileName, type ShareCardData } from './share-card-data';

/**
 * พรีวิวการ์ดแชร์ + ปุ่ม แชร์รูป / บันทึกรูป / คัดลอกลิงก์ (ADR-074 ข้อ 5)
 *
 * วาดลง canvas ตัวเดียวกับที่พรีวิว แล้วดึงไฟล์จากตัวนั้นเลย — ไม่ต้องวาดสองรอบ
 * `design/` ไม่มีภาพของการ์ด จึงยืมสไตล์ modal เดิมของแอปมาทั้งชุด (ADR-024 ใช้กับหน้าที่ออกแบบไว้)
 */
export function ShareCardDialog({
  data,
  title,
  onClose,
}: {
  data: ShareCardData;
  /** ข้อความที่ติดไปกับรูปตอนใช้เมนูแชร์ของเครื่อง */
  title: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // ฟอนต์ไทยต้องมาก่อนวาด ไม่งั้นได้กล่องสี่เหลี่ยม (ADR-074 ข้อ 1)
      await ensureCardFonts();
      if (cancelled || !canvasRef.current) return;
      drawShareCard(canvasRef.current, data, user?.cubeSkin);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [data, user?.cubeSkin]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const withCard = useCallback(
    async (action: (file: File) => Promise<string>) => {
      const canvas = canvasRef.current;
      if (!canvas || !ready) return;
      setBusy(true);
      try {
        const file = await canvasToPngFile(canvas, shareCardFileName(data));
        setNotice(file ? await action(file) : 'สร้างรูปไม่สำเร็จ ลองอีกครั้ง');
      } finally {
        setBusy(false);
      }
    },
    [data, ready],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="แชร์การ์ด"
      className="fixed inset-0 z-50 grid place-items-center bg-navy-950/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-navy-850 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-100">แชร์เป็นการ์ด</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {data.kind === 'profile' ? 'การ์ดโปรไฟล์' : 'การ์ดผลการแข่งขัน'} · รูป PNG{' '}
              {CARD_WIDTH}×{CARD_HEIGHT}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-sm text-slate-400 transition hover:bg-navy-800 hover:text-slate-200"
          >
            ปิด
          </button>
        </header>

        <div className="px-5 py-4">
          <div className="relative overflow-hidden rounded-xl border border-line bg-navy-900">
            <canvas
              ref={canvasRef}
              aria-label="ตัวอย่างการ์ดที่จะแชร์"
              className="block h-auto w-full"
              style={{ aspectRatio: `${CARD_WIDTH} / ${CARD_HEIGHT}` }}
            />
            {!ready && (
              <p className="absolute inset-0 grid place-items-center text-sm text-slate-500">
                กำลังสร้างการ์ด…
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!ready || busy}
              onClick={() =>
                void withCard(async (file) => {
                  const result = await shareOrDownloadImage(file, {
                    title,
                    text: title,
                    url: data.url,
                  });
                  return result === 'shared'
                    ? 'แชร์รูปแล้ว'
                    : result === 'downloaded'
                      ? 'เครื่องนี้แชร์รูปตรง ๆ ไม่ได้ — บันทึกรูปลงเครื่องให้แล้ว'
                      : result === 'cancelled'
                        ? 'ยกเลิกการแชร์'
                        : 'แชร์ไม่สำเร็จ ลองกดบันทึกรูปแทน';
                })
              }
              className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-400 disabled:opacity-50"
            >
              แชร์รูป
            </button>
            <button
              type="button"
              disabled={!ready || busy}
              onClick={() =>
                void withCard(async (file) => {
                  downloadFile(file);
                  return 'บันทึกรูปลงเครื่องแล้ว';
                })
              }
              className="rounded-xl border border-line bg-navy-800 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-navy-700 hover:text-white disabled:opacity-50"
            >
              บันทึกรูป
            </button>
            <button
              type="button"
              onClick={() =>
                void copyLink(data.url).then((ok) =>
                  setNotice(ok ? 'คัดลอกลิงก์แล้ว' : 'คัดลอกลิงก์ไม่สำเร็จ'),
                )
              }
              className="rounded-xl border border-line bg-navy-800 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-navy-700 hover:text-white"
            >
              🔗 คัดลอกลิงก์
            </button>
          </div>

          {/* ลิงก์บนการ์ดยังต้องล็อกอินก่อนเปิดตาม ADR-073 — บอกไว้ตรง ๆ ดีกว่าให้คนแชร์ไปงงทีหลัง */}
          <p className="mt-3 text-xs text-slate-500">
            {notice ?? `ลิงก์บนการ์ด: ${data.url.replace(/^https?:\/\//, '')}`}
          </p>
        </div>
      </div>
    </div>
  );
}
