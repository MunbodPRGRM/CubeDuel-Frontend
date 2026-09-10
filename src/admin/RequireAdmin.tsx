import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { PageSpinner } from '@/components/PageSpinner';

/**
 * ห่อหน้าที่เป็นของแอดมินเท่านั้น
 *
 * **นี่เป็นแค่การซ่อนหน้าจอ ไม่ใช่ระบบความปลอดภัย** — ของจริงคือ `requireAdmin` ฝั่ง server
 * ที่กันไว้ทั้ง router (`/admin/*` ตอบ 403 ให้สมาชิกธรรมดาเสมอ) · ต่อให้ใครแก้ `role` ในหน่วยความจำ
 * ของเบราว์เซอร์แล้วเปิดหน้านี้ได้ ทุก request ก็ยังถูกปฏิเสธอยู่ดี
 *
 * คนที่ไม่ใช่แอดมินเด้งไปหน้าแรก ไม่ใช่หน้า login — เพราะล็อกอินใหม่ก็ไม่ได้ทำให้เข้าได้
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <PageSpinner />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;

  return <>{children}</>;
}
