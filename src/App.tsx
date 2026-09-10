import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthProvider';
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import NotFoundPage from '@/pages/NotFoundPage';
import PracticePage from '@/pages/PracticePage';
import CreateRoomPage from '@/pages/CreateRoomPage';
import JoinRoomPage from '@/pages/JoinRoomPage';
import RoomPage from '@/pages/RoomPage';
import LeaderboardPage from '@/pages/LeaderboardPage';
import ProfilePage from '@/pages/ProfilePage';
import { RequireAuth } from '@/auth/RequireAuth';
import { SocketProvider } from '@/socket/SocketProvider';
import { QueueProvider } from '@/socket/QueueProvider';
import { QueueBanner } from '@/queue/QueueBanner';

/** เส้นทางทั้งหมดของแอป — หน้าที่ต้องล็อกอินก่อนให้ห่อด้วย <RequireAuth> */
export default function App() {
  return (
    <AuthProvider>
      {/* socket ต่อได้ต่อเมื่อล็อกอินแล้ว จึงต้องอยู่ใต้ AuthProvider เสมอ */}
      <SocketProvider>
        {/* คิวจับคู่ต้องฟังทั้งแอป เพราะ server พาเรากลับเข้าคิวเองได้ (ADR-040 ข้อ 1) */}
        <QueueProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            {/* กระดานอันดับกับโปรไฟล์เปิดสาธารณะ (api-contract.md ข้อ 3 และ 5) ไม่ต้องล็อกอิน */}
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/users/:userId" element={<ProfilePage />} />
            {/* ทางลัดไปโปรไฟล์ตัวเอง — เด้งไป /users/:id ให้ URL แชร์ได้เสมอ (ADR-047 ข้อ 5) */}
            <Route path="/profile" element={<ProfilePage />} />
            {/* ห้องฝึกซ้อมขอ scramble จาก server ซึ่งต้องมี token (api-contract.md ข้อ 6) */}
            <Route
              path="/practice"
              element={
                <RequireAuth>
                  <PracticePage />
                </RequireAuth>
              }
            />
            <Route
              path="/room/new"
              element={
                <RequireAuth>
                  <CreateRoomPage />
                </RequireAuth>
              }
            />
            <Route
              path="/room/join"
              element={
                <RequireAuth>
                  <JoinRoomPage />
                </RequireAuth>
              }
            />
            <Route
              path="/room/:roomId"
              element={
                <RequireAuth>
                  <RoomPage />
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          <QueueBanner />
        </QueueProvider>
      </SocketProvider>
    </AuthProvider>
  );
}
