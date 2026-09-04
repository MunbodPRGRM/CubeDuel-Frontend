import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import { PageSpinner } from '@/components/PageSpinner';

/** ห่อหน้าที่ต้องล็อกอินก่อน — ยังไม่ล็อกอินให้เด้งไปหน้าเข้าสู่ระบบ แล้วกลับมาที่เดิมหลังล็อกอินเสร็จ */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const location = useLocation();

  // ต้องรอให้กู้เซสชันเสร็จก่อน ไม่งั้นรีเฟรชหน้าทีไรจะเด้งไปหน้า login ทุกครั้ง
  if (status === 'loading') return <PageSpinner />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;

  return <>{children}</>;
}
