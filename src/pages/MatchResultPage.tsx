import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { AppHeader } from '@/components/AppHeader';
import { ErrorNotice } from '@/components/ErrorScreen';
import { MatchDetailBody } from '@/components/MatchDetailBody';
import { ShareCardDialog } from '@/components/share/ShareCardDialog';
import { buildMatchCard } from '@/components/share/share-card-data';
import { useApiData } from '@/hooks/useApiData';
import type { MatchDetail, MultiplayerMatchDetail } from '@/types/match';

/**
 * ผลของแมตช์เก่าหนึ่งแมตช์แบบ **หน้าเต็มที่มี URL ของตัวเอง** — ปลายทางของ "แชร์ผลการแข่งขัน"
 *
 * ในแอปเรายังเปิดผลย้อนหลังเป็น modal เหมือนเดิม (ADR-047 ข้อ 6 — คนไล่ดูหลายแมตช์ติดกัน)
 * หน้านี้มีไว้ให้ **ลิงก์ที่แชร์ออกไปข้างนอก** เปิดได้ และใช้เนื้อในชุดเดียวกับ modal (ADR-048 ข้อ 4)
 *
 * เลข id ของสองตารางชนกันได้ → เส้นทางแยกกันคนละอัน ห้ามเดาจากตัวเลข (ADR-044 ข้อ 1)
 */
export default function MatchResultPage({ kind }: { kind: '1v1' | 'multiplayer' }) {
  const params = useParams();
  const [sharing, setSharing] = useState(false);
  const raw = kind === '1v1' ? params.matchId : params.multiplayerMatchId;
  const id = Number(raw);
  const { user } = useAuth();

  const duel = useApiData<MatchDetail>(kind === '1v1' && id > 0 ? `/matches/${id}` : null);
  const multi = useApiData<MultiplayerMatchDetail>(
    kind === 'multiplayer' && id > 0 ? `/multiplayer-matches/${id}` : null,
  );

  if (!Number.isInteger(id) || id <= 0) return <Navigate to="/404" replace />;

  const loading = duel.loading || multi.loading;
  const error = duel.error ?? multi.error;
  const detail = duel.data ?? multi.data ?? null;

  return (
    <div className="min-h-app bg-navy-900">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">
              {kind === '1v1' ? 'ห้อง 1 ต่อ 1' : 'ห้องผู้เล่นหลายคน'} · #{id}
            </p>
            <h1 className="text-2xl font-bold text-white">ผลการแข่งขัน</h1>
          </div>
          {/* แชร์เป็นการ์ดรูปภาพ — ต้องรอผลโหลดเสร็จก่อนถึงจะมีอะไรวาด (ADR-074) */}
          <button
            type="button"
            disabled={!detail}
            onClick={() => setSharing(true)}
            className="rounded-xl border border-line bg-navy-800 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-navy-700 hover:text-white disabled:opacity-50"
          >
            🖼 แชร์การ์ด
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-line bg-navy-850/80">
          {loading && <p className="px-5 py-12 text-center text-sm text-slate-500">กำลังโหลด…</p>}
          {error && (
            <ErrorNotice
              message={error}
              onRetry={kind === '1v1' ? duel.reload : multi.reload}
              className="border-0 bg-transparent"
            />
          )}
          {/* ไม่ได้ล็อกอินก็เปิดดูได้ (endpoint เป็น 🌐) — แค่ไม่มีแถวไหนถูกไฮไลต์ */}
          {duel.data && <MatchDetailBody detail={duel.data} highlightUserId={user?.userId ?? 0} />}
          {multi.data && (
            <MatchDetailBody detail={multi.data} highlightUserId={user?.userId ?? 0} />
          )}
        </div>

        {sharing && detail && (
          <ShareCardDialog
            data={buildMatchCard(detail, user?.userId ?? 0)}
            title="ผลการแข่งขัน CubeDuel"
            onClose={() => setSharing(false)}
          />
        )}

        <Link
          to="/"
          className="mt-6 inline-block text-sm text-slate-400 transition hover:text-slate-200"
        >
          ← กลับหน้าแรก
        </Link>
      </main>
    </div>
  );
}
