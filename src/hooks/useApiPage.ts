import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetchPage, type PageMeta } from '@/lib/api';
import { errorCode, errorMessage, type AppErrorCode } from '@/lib/errors';

export interface AsyncPage<T, M extends PageMeta = PageMeta> {
  data: T[] | null;
  meta: M | null;
  loading: boolean;
  error: string | null;
  /** รหัสของ error ล่าสุด — เหมือน `useApiData` (ADR-054 ข้อ 3) */
  errorCode: AppErrorCode | null;
  /** ยิงซ้ำเส้นเดิม — ต่อกับปุ่ม "ลองใหม่" บนกล่อง error */
  reload: () => void;
}

type PageState<T, M extends PageMeta> = Omit<AsyncPage<T, M>, 'reload'>;

/**
 * เหมือน `useApiData` แต่ใช้กับ endpoint ที่คืน `meta` มาด้วย (กระดานอันดับ · ประวัติการแข่ง)
 *
 * ต่างกันอีกอย่างเดียวคือ **ระหว่างโหลดหน้าใหม่ยังคาข้อมูลเดิมไว้บนจอ** — กดเปลี่ยนหน้าหรือ
 * สลับประเภทคิวบ์แล้วตารางกะพริบเป็นช่องว่างทุกครั้งอ่านยากกว่าตารางที่จางลงเฉย ๆ
 * (`loading` ยังเป็น `true` ให้หน้าจอเอาไปหรี่ตารางเองได้)
 *
 * ยังไม่มี cache ข้ามหน้า — เส้นที่จะย้ายไป TanStack Query อยู่ใน ADR-047 ข้อ 7
 */
export function useApiPage<T, M extends PageMeta = PageMeta>(path: string | null): AsyncPage<T, M> {
  const [state, setState] = useState<PageState<T, M>>({
    data: null,
    meta: null,
    loading: path !== null,
    error: null,
    errorCode: null,
  });

  /** เพิ่มค่าเพื่อบังคับให้ effect ยิงซ้ำ — ใช้ state ไม่ได้เพราะ path เดิมไม่ได้เปลี่ยน */
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  // เก็บผลล่าสุดไว้โชว์ระหว่างรอผลของ path ใหม่
  const last = useRef<{ data: T[] | null; meta: M | null }>({ data: null, meta: null });

  useEffect(() => {
    if (!path) {
      last.current = { data: null, meta: null };
      setState({ data: null, meta: null, loading: false, error: null, errorCode: null });
      return;
    }

    let cancelled = false;
    setState({ ...last.current, loading: true, error: null, errorCode: null });

    apiFetchPage<T[]>(path)
      .then(({ data, meta }) => {
        if (cancelled) return;
        last.current = { data, meta: meta as M };
        setState({ data, meta: meta as M, loading: false, error: null, errorCode: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        last.current = { data: null, meta: null };
        setState({
          data: null,
          meta: null,
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
