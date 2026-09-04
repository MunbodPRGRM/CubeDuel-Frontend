import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthProvider';
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import NotFoundPage from '@/pages/NotFoundPage';

/**
 * เส้นทางทั้งหมดของแอป
 * หน้าที่ต้องล็อกอินก่อน ให้ห่อด้วย <RequireAuth> (ยังไม่มีหน้าไหนต้องใช้จนกว่าจะถึงเฟส 3)
 */
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}
