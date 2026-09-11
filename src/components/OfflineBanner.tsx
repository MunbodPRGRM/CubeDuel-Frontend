import { useEffect, useRef, useState } from 'react';
import { useOnline } from '@/hooks/useOnline';

/**
 * แถบบางบนสุดของจอ ขึ้นเมื่อ **เครื่องหลุดเน็ต** — ครอบทั้งแอปเพราะเป็นเรื่องของอุปกรณ์
 * ไม่ใช่ของหน้าใดหน้าหนึ่ง (คนละเรื่องกับ `ConnectionBanner` ที่พูดถึงที่นั่งในห้อง)
 *
 * ไม่มีปุ่มลองใหม่ **ตั้งใจ** — กดไปก็ไม่ช่วยถ้าเน็ตยังไม่มา พอเน็ตกลับมา
 * `socket.io` ต่อให้เอง และหน้าจอที่มีปุ่มลองใหม่ของตัวเองก็กดได้ตามปกติ
 *
 * ⚠️ ต้องเป็น `fixed` เพราะ component นี้ถูกวางไว้ท้าย `<App>` นอกกรอบของหน้า จะไปดัน
 * เนื้อหาตามปกติไม่ได้ — แลกมาด้วยการที่มัน **ทับแถบหัวเว็บ** ถ้าไม่ทำอะไรเพิ่ม
 * จึงต้องดัน `<body>` ลงมาเท่าความสูงจริงของแถบเอง (วัดด้วย `ResizeObserver`
 * ไม่ใช่ค่าคงที่ เพราะจอแคบข้อความจะตัดบรรทัดแล้วแถบสูงขึ้น)
 */
export function OfflineBanner() {
  const online = useOnline();
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (online || !el) {
      setHeight(0);
      return;
    }

    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    setHeight(el.offsetHeight);

    return () => observer.disconnect();
  }, [online]);

  useEffect(() => {
    if (height === 0) return;

    const root = document.documentElement;
    const previous = document.body.style.paddingTop;
    document.body.style.paddingTop = `${height}px`;
    // หน้าที่ล็อกความสูงเท่าจอ (ห้องแข่ง · ห้องฝึกซ้อม) ต้องหักความสูงแถบนี้ออกเอง
    // ไม่งั้น `100dvh` + padding ข้างบน = ล้นจอเท่าความสูงแถบพอดี (ADR-059 ข้อ 3)
    root.style.setProperty('--offline-banner-h', `${height}px`);

    return () => {
      document.body.style.paddingTop = previous;
      root.style.removeProperty('--offline-banner-h');
    };
  }, [height]);

  if (online) return null;

  return (
    <div
      ref={ref}
      role="status"
      className="fixed inset-x-0 top-0 z-50 bg-loss/90 px-4 py-2 text-center text-sm font-semibold text-navy-950 shadow-lg"
    >
      ออฟไลน์ — ไม่มีการเชื่อมต่ออินเทอร์เน็ต ระบบจะต่อกลับให้เองเมื่อเน็ตกลับมา
    </div>
  );
}
