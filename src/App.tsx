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
import SettingsPage from '@/pages/SettingsPage';
import MatchResultPage from '@/pages/MatchResultPage';
import NewsPage from '@/pages/NewsPage';
import NewsDetailPage from '@/pages/NewsDetailPage';
import AdminDashboardPage from '@/admin/AdminDashboardPage';
import AdminUsersPage from '@/admin/AdminUsersPage';
import AdminReportsPage from '@/admin/AdminReportsPage';
import AdminFlagsPage from '@/admin/AdminFlagsPage';
import AdminNewsPage from '@/admin/AdminNewsPage';
import { RequireAdmin } from '@/admin/RequireAdmin';
import { RequireAuth } from '@/auth/RequireAuth';
import { SocketProvider } from '@/socket/SocketProvider';
import { QueueProvider } from '@/socket/QueueProvider';
import { QueueBanner } from '@/queue/QueueBanner';
import { OfflineBanner } from '@/components/OfflineBanner';
import { TutorialProvider } from '@/tutorial/TutorialProvider';

/** เส้นทางทั้งหมดของแอป — หน้าที่ต้องล็อกอินก่อนให้ห่อด้วย <RequireAuth> */
export default function App() {
  return (
    <AuthProvider>
      {/* socket ต่อได้ต่อเมื่อล็อกอินแล้ว จึงต้องอยู่ใต้ AuthProvider เสมอ */}
      <SocketProvider>
        {/* คิวจับคู่ต้องฟังทั้งแอป เพราะ server พาเรากลับเข้าคิวเองได้ (ADR-040 ข้อ 1) */}
        <QueueProvider>
          {/* คู่มือการใช้งานเปิดจากหน้าไหนก็ได้ + เด้งเองครั้งแรก จึงต้องครอบทุกเส้นทาง (ADR-053) */}
          <TutorialProvider>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              {/* กระดานอันดับกับโปรไฟล์เปิดสาธารณะ (api-contract.md ข้อ 3 และ 5) ไม่ต้องล็อกอิน */}
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              {/* ข่าวสารเปิดสาธารณะเหมือนกัน (api-contract.md ข้อ 7) */}
              <Route path="/news" element={<NewsPage />} />
              <Route path="/news/:newsId" element={<NewsDetailPage />} />
              <Route path="/users/:userId" element={<ProfilePage />} />
              {/* ทางลัดไปโปรไฟล์ตัวเอง — เด้งไป /users/:id ให้ URL แชร์ได้เสมอ (ADR-047 ข้อ 5) */}
              <Route path="/profile" element={<ProfilePage />} />
              {/* ผลแมตช์แบบมี URL ของตัวเอง — ปลายทางของลิงก์ที่แชร์ออกไป (ADR-048 ข้อ 4) */}
              <Route path="/matches/:matchId" element={<MatchResultPage kind="1v1" />} />
              <Route
                path="/multiplayer-matches/:multiplayerMatchId"
                element={<MatchResultPage kind="multiplayer" />}
              />
              <Route
                path="/settings"
                element={
                  <RequireAuth>
                    <SettingsPage />
                  </RequireAuth>
                }
              />
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
              {/* ส่วนผู้ดูแลระบบ — `RequireAdmin` แค่ซ่อนหน้าจอ ตัวกันจริงคือ `requireAdmin` ฝั่ง server */}
              <Route
                path="/admin"
                element={
                  <RequireAdmin>
                    <AdminDashboardPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <RequireAdmin>
                    <AdminUsersPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/reports"
                element={
                  <RequireAdmin>
                    <AdminReportsPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/flags"
                element={
                  <RequireAdmin>
                    <AdminFlagsPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/news"
                element={
                  <RequireAdmin>
                    <AdminNewsPage />
                  </RequireAdmin>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
            <QueueBanner />
            {/* เครื่องหลุดเน็ต — เตือนทับทุกหน้า เพราะทุกหน้าใช้งานต่อไม่ได้เหมือนกันหมด */}
            <OfflineBanner />
          </TutorialProvider>
        </QueueProvider>
      </SocketProvider>
    </AuthProvider>
  );
}
