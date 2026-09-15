import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import { PageSpinner } from '@/components/PageSpinner';

/**
 * ห่อหน้าที่ต้องล็อกอินก่อน — ยังไม่ล็อกอินให้เด้งไปหน้าเข้าสู่ระบบ แล้วกลับมาที่เดิมหลังล็อกอินเสร็จ
 *
 * ไม่ส่ง `children` = ใช้เป็น **layout route** ครอบหลายเส้นทาง แล้ว render `<Outlet />` แทน
 * (`App.tsx` ใช้แบบนี้ตัวเดียวครอบทุกหน้าที่ไม่ใช่ 4 หน้าสาธารณะ — ADR-073 ข้อ 1)
 */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const { status, user } = useAuth();
  const location = useLocation();

  // ต้องรอให้กู้เซสชันเสร็จก่อน ไม่งั้นรีเฟรชหน้าทีไรจะเด้งไปหน้า login ทุกครั้ง
  if (status === 'loading') return <PageSpinner />;
  if (!user) {
    // เก็บ query ด้วย ไม่ใช่แค่ pathname — ลิงก์ที่แชร์มาต้องกลับไปที่เดิมเป๊ะหลังล็อกอิน
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }

  return <>{children ?? <Outlet />}</>;
}
