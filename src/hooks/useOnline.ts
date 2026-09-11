import { useEffect, useState } from 'react';

/**
 * เบราว์เซอร์มองว่าเครื่องนี้ต่อเน็ตอยู่หรือไม่
 *
 * ⚠️ `navigator.onLine` บอกได้แค่ว่า **มีเส้นทางออกจากเครื่อง** ไม่ได้แปลว่าไปถึง server ของเราได้
 * (ต่อ Wi-Fi ที่ไม่มีอินเทอร์เน็ตก็ยังเป็น `true`) — จึงใช้ได้แค่กับข้อความเตือน
 * **ห้ามเอาไปตัดสินใจแทนการยิงจริง** ส่วนที่บอกว่า "ไปถึง server ไหม" คือ `E_NETWORK` จาก `lib/api.ts`
 * กับสถานะของ socket · ค่าที่ได้ตอนแรกอ่านตอน mount เพื่อให้ตรงกับของจริงตั้งแต่เฟรมแรก
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    // สถานะอาจเปลี่ยนไปแล้วระหว่าง render แรกกับตอนที่ผูก listener ติด
    update();

    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return online;
}
