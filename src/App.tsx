import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthProvider';
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import NotFoundPage from '@/pages/NotFoundPage';
import PracticePage from '@/pages/PracticePage';
import CreateRoomPage from '@/pages/CreateRoomPage';
import JoinRoomPage from '@/pages/JoinRoomPage';
import RoomPage from '@/pages/RoomPage';
import LeaderboardPage from '@/pages/LeaderboardPage';
import ProfilePage from '@/pages/ProfilePage';
import SettingsPage from '@/pages/SettingsPage';
import SkinsPage from '@/pages/SkinsPage';
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
import { ReadyCheckModal } from '@/queue/ReadyCheckModal';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ServerGate } from '@/components/ServerGate';
import { TutorialProvider } from '@/tutorial/TutorialProvider';

/** เส้นทางทั้งหมดของแอป — ต้องล็อกอินเป็นค่าเริ่มต้น เปิดสาธารณะแค่ 3 หน้าบนสุด (ADR-073) */
export default function App() {
  return (
    // รอ server + DB ตื่นก่อน mount อะไรทั้งนั้น — auth ยิงใส่ server ที่ยังหลับแล้วผู้ใช้โดนเด้งออกผิด ๆ (ADR-072)
    <ServerGate>
      <AuthProvider>
        {/* socket ต่อได้ต่อเมื่อล็อกอินแล้ว จึงต้องอยู่ใต้ AuthProvider เสมอ */}
        <SocketProvider>
          {/* คิวจับคู่ต้องฟังทั้งแอป เพราะ server พาเรากลับเข้าคิวเองได้ (ADR-040 ข้อ 1) */}
          <QueueProvider>
            {/* คู่มือการใช้งานเปิดจากหน้าไหนก็ได้ + เด้งเองครั้งแรก จึงต้องครอบทุกเส้นทาง (ADR-053) */}
            <TutorialProvider>
              <Routes>
                {/* ── เปิดสาธารณะ 3 หน้าเท่านั้น — ไม่ล็อกอินไปหน้าเข้าสู่ระบบเลย แม้แต่หน้าหลัก (ADR-073 ข้อ 1) ── */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                {/* ลืมรหัสผ่าน — กรอก username + อีเมลแล้วตั้งรหัสใหม่ ไม่มีลิงก์ (ADR-069) */}
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                {/* ── ที่เหลือทั้งหมดต้องล็อกอิน — ครอบด้วย layout route ตัวเดียว หน้าที่เพิ่มใหม่
                    วางไว้ในนี้ก็ต้องล็อกอินเองโดยไม่ต้องจำ · 404 ก็อยู่ในนี้ด้วย (ADR-073 ข้อ 1)
                    API ของหลายหน้าในนี้ยังเปิดสาธารณะอยู่ — การกันตรงนี้เป็นเรื่องหน้าจอ (ADR-073 ข้อ 5) ── */}
                <Route element={<RequireAuth />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/leaderboard" element={<LeaderboardPage />} />
                  <Route path="/news" element={<NewsPage />} />
                  <Route path="/news/:newsId" element={<NewsDetailPage />} />
                  <Route path="/users/:userId" element={<ProfilePage />} />
                  {/* ทางลัดไปโปรไฟล์ตัวเอง — เด้งไป /users/:id ให้ URL แชร์ได้เสมอ (ADR-047 ข้อ 5) */}
                  <Route path="/profile" element={<ProfilePage />} />
                  {/* ผลแมตช์แบบมี URL ของตัวเอง — ปลายทางของลิงก์ที่แชร์ออกไป (ADR-048 ข้อ 5)
                      คนที่รับลิงก์ต้องล็อกอินก่อน แล้ว RequireAuth พากลับมาที่นี่ (ADR-073 ข้อ 1) */}
                  <Route path="/matches/:matchId" element={<MatchResultPage kind="1v1" />} />
                  <Route
                    path="/multiplayer-matches/:multiplayerMatchId"
                    element={<MatchResultPage kind="multiplayer" />}
                  />
                  <Route path="/settings" element={<SettingsPage />} />
                  {/* สกินสีคิวบ์ — ปลายทางคือคอลัมน์ของบัญชี ไม่ใช่ค่าในเครื่องแบบมุมกล้อง/layout (ADR-064 ข้อ 1) */}
                  <Route path="/skins" element={<SkinsPage />} />
                  {/* ห้องฝึกซ้อมขอ scramble จาก server ซึ่งต้องมี token (api-contract.md ข้อ 6) */}
                  <Route path="/practice" element={<PracticePage />} />
                  <Route path="/room/new" element={<CreateRoomPage />} />
                  <Route path="/room/join" element={<JoinRoomPage />} />
                  <Route path="/room/:roomId" element={<RoomPage />} />
                  {/* ส่วนผู้ดูแลระบบ — `RequireAdmin` เช็กบทบาทต่อ แค่ซ่อนหน้าจอ ตัวกันจริงคือ `requireAdmin` ฝั่ง server */}
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
                </Route>
              </Routes>
              <QueueBanner />
              {/* เจอคู่แล้วต้องกดยืนยันก่อน — เด้งทับทุกหน้า ไม่ใช่แค่หน้าแรก (ADR-077) */}
              <ReadyCheckModal />
              {/* เครื่องหลุดเน็ต — เตือนทับทุกหน้า เพราะทุกหน้าใช้งานต่อไม่ได้เหมือนกันหมด */}
              <OfflineBanner />
            </TutorialProvider>
          </QueueProvider>
        </SocketProvider>
      </AuthProvider>
    </ServerGate>
  );
}
