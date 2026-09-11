import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { errorCode, errorMessage, type AppErrorCode } from '@/lib/errors';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** รหัสของ error ล่าสุด — หน้าจอใช้แยกว่า "โหลดไม่ได้เพราะเน็ต" กับ "ไม่พบข้อมูล" (ADR-054 ข้อ 3) */
  errorCode: AppErrorCode | null;
  /** ยิงซ้ำเส้นเดิม — ต่อกับปุ่ม "ลองใหม่" บนกล่อง error */
  reload: () => void;
}

/**
 * ดึงข้อมูลแบบอ่านอย่างเดียวมาแสดงบนหน้าจอ
 *
 * ตั้งใจให้เล็กที่สุดเท่าที่พอใช้ — ยังไม่มี cache / retry อัตโนมัติ / dedupe
 * ถ้าวันหนึ่งหน้าจอเยอะขึ้นจนต้องใช้ของพวกนั้น ค่อยเปลี่ยนไปใช้ TanStack Query ทีเดียว
 */
export function useApiData<T>(path: string | null): AsyncState<T> {
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: string | null;
    errorCode: AppErrorCode | null;
  }>({ data: null, loading: true, error: null, errorCode: null });

  /** เพิ่มค่าเพื่อบังคับให้ effect ยิงซ้ำ — ใช้ state ไม่ได้เพราะ path เดิมไม่ได้เปลี่ยน */
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!path) {
      setState({ data: null, loading: false, error: null, errorCode: null });
      return;
    }

    let cancelled = false;
    setState({ data: null, loading: true, error: null, errorCode: null });

    apiFetch<T>(path)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null, errorCode: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          data: null,
          loading: false,
          error: errorMessage(err, 'โหลดข้อมูลไม่สำเร็จ'),
          errorCode: errorCode(err),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [path, attempt]);

  return { ...state, reload };
}
