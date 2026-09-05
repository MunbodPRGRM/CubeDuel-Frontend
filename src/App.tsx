import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthProvider';
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import NotFoundPage from '@/pages/NotFoundPage';
import PracticePage from '@/pages/PracticePage';
import { RequireAuth } from '@/auth/RequireAuth';

/** เส้นทางทั้งหมดของแอป — หน้าที่ต้องล็อกอินก่อนให้ห่อด้วย <RequireAuth> */
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        {/* ห้องฝึกซ้อมขอ scramble จาก server ซึ่งต้องมี token (api-contract.md ข้อ 6) */}
        <Route
          path="/practice"
          element={
            <RequireAuth>
              <PracticePage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}
