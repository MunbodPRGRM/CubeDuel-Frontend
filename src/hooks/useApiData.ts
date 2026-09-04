import { useEffect, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * ดึงข้อมูลแบบอ่านอย่างเดียวมาแสดงบนหน้าจอ
 *
 * ตั้งใจให้เล็กที่สุดเท่าที่พอใช้ — ยังไม่มี cache / retry / dedupe
 * ถ้าวันหนึ่งหน้าจอเยอะขึ้นจนต้องใช้ของพวกนั้น ค่อยเปลี่ยนไปใช้ TanStack Query ทีเดียว
 */
export function useApiData<T>(path: string | null): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null });

  useEffect(() => {
    if (!path) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState({ data: null, loading: true, error: null });

    apiFetch<T>(path)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : 'โหลดข้อมูลไม่สำเร็จ';
        setState({ data: null, loading: false, error: message });
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  return state;
}
