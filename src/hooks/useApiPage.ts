import { useEffect, useRef, useState } from 'react';
import { ApiError, apiFetchPage, type PageMeta } from '@/lib/api';

export interface AsyncPage<T, M extends PageMeta = PageMeta> {
  data: T[] | null;
  meta: M | null;
  loading: boolean;
  error: string | null;
}

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
  const [state, setState] = useState<AsyncPage<T, M>>({
    data: null,
    meta: null,
    loading: path !== null,
    error: null,
  });

  // เก็บผลล่าสุดไว้โชว์ระหว่างรอผลของ path ใหม่
  const last = useRef<{ data: T[] | null; meta: M | null }>({ data: null, meta: null });

  useEffect(() => {
    if (!path) {
      last.current = { data: null, meta: null };
      setState({ data: null, meta: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState({ ...last.current, loading: true, error: null });

    apiFetchPage<T[]>(path)
      .then(({ data, meta }) => {
        if (cancelled) return;
        last.current = { data, meta: meta as M };
        setState({ data, meta: meta as M, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : 'โหลดข้อมูลไม่สำเร็จ';
        last.current = { data: null, meta: null };
        setState({ data: null, meta: null, loading: false, error: message });
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  return state;
}
