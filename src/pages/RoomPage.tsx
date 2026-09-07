import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/Avatar';
import { FormAlert } from '@/components/FormAlert';
import { PageSpinner } from '@/components/PageSpinner';
import { ConnectionBanner, ConnectionErrorCard } from '@/socket/SocketGate';
import { ROOM_STATE_LABEL, SOLVE_STATUS_LABEL } from '@/socket/room-labels';
import { useRoom } from '@/socket/useRoom';
import { useSocket } from '@/socket/useSocket';
import { playerName, type PlayerPublic, type RoomSnapshot } from '@/socket/types';
import { CUBE_TYPE_LABEL } from '@/types/leaderboard';

/**
 * ห้องสร้างเอง 1v1 — ก้อนที่ 3 ทำเฉพาะ **ล็อบบี้** (state `WAITING`)
 *
 * โครงสามคอลัมน์ตามภาพ `design/Match - Join.png` — ช่องคิวบ์ซ้าย/ขวากับตัวจับเวลา
 * เป็นงานของก้อนที่ 4 ที่จะเอา `CubeCanvas` มาใส่แทนที่ตรงนี้
 */
export default function RoomPage() {
  const { roomId: roomIdParam } = useParams<{ roomId: string }>();
  const roomId = Number(roomIdParam);
  const valid = Number.isInteger(roomId) && roomId > 0;

  return (
    <div className="min-h-screen bg-navy-900">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-6">
        {valid ? <RoomView roomId={roomId} /> : <RoomGoneCard message="เลขห้องในลิงก์ไม่ถูกต้อง" />}
      </main>
    </div>
  );
}

/**
 * ห้ามครอบด้วย `SocketGate` — หน้านี้ต้องคาอยู่ระหว่างเน็ตกระตุก ไม่ใช่ถูก unmount
 * ที่นั่งในห้องผูกกับ `userId` ไม่ใช่ socket ต่อกลับมาแล้ว `room:rejoin` เอง (ADR-034 ข้อ 3)
 */
function RoomView({ roomId }: { roomId: number }) {
  const navigate = useNavigate();
  const room = useRoom(roomId);
  const { status: socketStatus } = useSocket();
  const { snapshot, status, goneMessage, me, others, isSpectator, isHost } = room;

  if (status === 'gone') return <RoomGoneCard message={goneMessage ?? 'ไม่ได้อยู่ในห้องนี้แล้ว'} />;
  // ยังไม่เคยได้ snapshot แรก — แยกให้ชัดว่าติดที่การเชื่อมต่อหรือแค่รอ ack
  if (!snapshot) return socketStatus === 'error' ? <ConnectionErrorCard /> : <PageSpinner />;

  // ผู้ชมไม่มีที่นั่ง จึงเรียงผู้เล่นตามลำดับที่เข้าห้องแทนที่จะยึด "ฝั่งเรา / ฝั่งคู่แข่ง"
  const leftPlayer = isSpectator ? (snapshot.players[0] ?? null) : me;
  const rightPlayer = isSpectator ? (snapshot.players[1] ?? null) : (others[0] ?? null);
  const roomIsFull = snapshot.players.length >= snapshot.maxPlayers;

  const leave = async () => {
    if (await room.leave()) navigate('/', { replace: true });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px_1fr]">
      {socketStatus !== 'connected' && (
        <div className="lg:col-span-3">
          <ConnectionBanner />
        </div>
      )}
      <PlayerPanel
        player={leftPlayer}
        snapshot={snapshot}
        emptyLabel={isSpectator ? 'รอผู้เล่นเข้าห้อง' : 'ที่นั่งของคุณ'}
      />

      <div className="flex flex-col gap-4 lg:order-none">
        <RoomHeaderCard snapshot={snapshot} left={leftPlayer} right={rightPlayer} />

        <section className="rounded-2xl border border-line bg-navy-850 px-5 py-6 text-center">
          <p className="text-xs text-slate-400">สถานะการเล่น</p>
          <p className="mt-1 text-2xl font-bold text-brand-400">
            {ROOM_STATE_LABEL[snapshot.state]}
          </p>

          <p className="mt-6 text-sm leading-7 text-slate-400">
            {snapshot.state === 'WAITING' ? (
              roomIsFull ? (
                'ผู้เล่นครบแล้ว รอหัวห้องกดเริ่มการแข่งขัน'
              ) : (
                <>
                  รอผู้เล่นอีก {snapshot.maxPlayers - snapshot.players.length} คน
                  <br />
                  ส่งรหัสห้องด้านบนให้เพื่อนกด “ใส่เลขห้อง”
                </>
              )
            ) : (
              'หน้าจอการแข่งขันจะมาในก้อนที่ 4 ของเฟส 4'
            )}
          </p>

          <ScrambleBox scramble={snapshot.scramble} />

          <dl className="mt-5 space-y-1.5 text-left text-sm">
            <Row label="ประเภทรูบิค" value={CUBE_TYPE_LABEL[snapshot.cubeType]} />
            <Row label="ผู้เล่น" value={`${snapshot.players.length}/${snapshot.maxPlayers} คน`} />
            <Row label="ผู้ชม" value={`${snapshot.spectatorCount} คน`} />
            <Row label="ผลต่อคะแนน ELO" value="ไม่มีผล (ห้องสร้างเอง)" />
          </dl>

          {room.actionError && (
            <div className="mt-4 text-left">
              <FormAlert message={room.actionError} />
            </div>
          )}

          <div className="mt-5 flex flex-col gap-2.5">
            {isSpectator ? (
              <p className="rounded-xl border border-line-soft bg-navy-900/60 px-4 py-2.5 text-sm text-slate-400">
                คุณกำลังดูอยู่ในฐานะผู้ชม
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={room.busy || snapshot.state !== 'WAITING'}
                  onClick={() => void room.setReady(!me?.isReady)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    me?.isReady
                      ? 'border border-line bg-navy-800 text-slate-200 hover:bg-navy-700'
                      : 'bg-win/90 text-navy-950 hover:bg-win'
                  }`}
                >
                  {me?.isReady ? 'ยกเลิกพร้อม' : 'พร้อม'}
                </button>

                {/* `room:start` + หน้าจอแข่งเป็นงานก้อนที่ 4 — ยังไม่ผูกปุ่มนี้เข้ากับ socket */}
                <button
                  type="button"
                  disabled
                  title="ยังไม่เปิดใช้งาน — จะมาในเฟส 4 ก้อนที่ 4"
                  className="cursor-not-allowed rounded-xl border border-line bg-navy-800 px-4 py-2.5 text-sm font-semibold text-slate-500"
                >
                  {isHost ? 'เริ่มการแข่งขัน' : 'รอหัวห้องเริ่ม'}
                </button>
              </div>
            )}

            <button
              type="button"
              disabled={room.busy}
              onClick={() => void leave()}
              className="rounded-xl border border-line bg-navy-800 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ออกจากห้อง
            </button>
          </div>
        </section>
      </div>

      <PlayerPanel player={rightPlayer} snapshot={snapshot} emptyLabel="รอผู้เล่นเข้าห้อง" />
    </div>
  );
}

// ---------------------------------------------------------------- ชิ้นส่วนย่อย

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-200">{value}</dd>
    </div>
  );
}

function ScrambleBox({ scramble }: { scramble: string | null }) {
  return (
    <div className="mt-6 rounded-xl border border-line-soft bg-navy-950/60 px-4 py-3.5 text-left">
      <p className="text-[10px] tracking-[0.2em] text-slate-500">SCRAMBLE</p>
      <p className="mt-1.5 break-words text-sm text-slate-200">
        {scramble ?? <span className="text-slate-600">จะแสดงเมื่อเริ่มการแข่งขัน</span>}
      </p>
    </div>
  );
}

/** การ์ดหัวห้อง: ผู้เล่นสองฝั่ง + รหัสห้องตรงกลาง (กดเพื่อคัดลอก) */
function RoomHeaderCard({
  snapshot,
  left,
  right,
}: {
  snapshot: RoomSnapshot;
  left: PlayerPublic | null;
  right: PlayerPublic | null;
}) {
  return (
    <section className="grid grid-cols-3 items-center gap-2 rounded-2xl border border-line bg-navy-850 px-4 py-5">
      <PlayerChip player={left} />
      <div className="text-center">
        <p className="text-xs text-slate-400">เลขห้อง</p>
        <RoomCodeButton roomCode={snapshot.roomCode} />
      </div>
      <PlayerChip player={right} />
    </section>
  );
}

function PlayerChip({ player }: { player: PlayerPublic | null }) {
  if (!player) {
    return (
      <div className="flex flex-col items-center gap-1.5 text-center opacity-40">
        <span className="grid h-10 w-10 place-items-center rounded-full border border-dashed border-line text-slate-600">
          ?
        </span>
        <p className="text-sm text-slate-500">ว่าง</p>
      </div>
    );
  }

  const name = playerName(player);
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <Avatar name={name} />
      <div>
        <p className="max-w-[9rem] truncate text-sm font-medium text-slate-100">{name}</p>
        <p className="tabular text-xs text-brand-400">{player.eloRating}</p>
      </div>
    </div>
  );
}

function RoomCodeButton({ roomCode }: { roomCode: string | null }) {
  const [copied, setCopied] = useState(false);

  if (!roomCode) return <p className="tabular text-2xl font-bold text-slate-600">—</p>;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // เบราว์เซอร์ไม่ให้สิทธิ์คลิปบอร์ด (หรือหน้าไม่ได้อยู่บน https) — ผู้ใช้ยังอ่านรหัสเองได้อยู่
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      title="คลิกเพื่อคัดลอกรหัสห้อง"
      className="tabular text-2xl font-bold tracking-widest text-brand-400 transition hover:text-brand-300"
    >
      {copied ? 'คัดลอกแล้ว' : roomCode}
    </button>
  );
}

/**
 * ช่องของผู้เล่นหนึ่งคน — ตอนนี้มีแค่แถบสรุปด้านล่างตามดีไซน์
 * พื้นที่ว่างด้านบนคือที่ของ `CubeCanvas` ในก้อนที่ 4
 */
function PlayerPanel({
  player,
  snapshot,
  emptyLabel,
}: {
  player: PlayerPublic | null;
  snapshot: RoomSnapshot;
  emptyLabel: string;
}) {
  const progress = player ? snapshot.progress.find((p) => p.userId === player.userId) : undefined;
  const inLobby = snapshot.state === 'WAITING';

  const statusText = !player
    ? '—'
    : inLobby
      ? player.isReady
        ? 'พร้อม'
        : 'ไม่พร้อม'
      : SOLVE_STATUS_LABEL[progress?.status ?? 'solving'];

  const statusClass = !player
    ? 'text-slate-600'
    : inLobby
      ? player.isReady
        ? 'text-win'
        : 'text-loss'
      : 'text-slate-200';

  return (
    <section className="flex min-h-[22rem] flex-col rounded-2xl border border-line bg-navy-850/60 p-4">
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        {player ? (
          <>
            <Avatar name={playerName(player)} size="lg" />
            <p className="font-medium text-slate-100">{playerName(player)}</p>
            {player.isHost && <span className="text-xs text-gold-400">หัวห้อง</span>}
            {!player.connected && (
              <span className="text-xs text-loss">หลุดการเชื่อมต่อ — กำลังรอกลับมา</span>
            )}
            <p className="mt-4 text-xs text-slate-600">คิวบ์ 3 มิติจะมาในก้อนที่ 4</p>
          </>
        ) : (
          <p className="text-sm text-slate-600">{emptyLabel}</p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 items-end gap-2 rounded-xl border border-line-soft bg-navy-900/60 px-4 py-3">
        <div>
          <p className="text-[10px] tracking-[0.15em] text-slate-500">MOVES</p>
          <p className="tabular text-lg text-slate-200">{progress?.moveCount ?? 0}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-500">สถานะ</p>
          <p className={`text-sm ${statusClass}`}>{statusText}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-500">เวลา</p>
          <p className="tabular text-lg text-brand-400">
            {progress?.solveTimeMs != null ? (progress.solveTimeMs / 1000).toFixed(2) : '0.00'}
          </p>
        </div>
      </div>
    </section>
  );
}

function RoomGoneCard({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-line bg-navy-850 px-6 py-8 text-center">
      <p className="font-semibold text-slate-100">ไม่ได้อยู่ในห้องนี้แล้ว</p>
      <p className="mt-2 text-sm text-slate-400">{message}</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          to="/room/new"
          className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
        >
          สร้างห้องใหม่
        </Link>
        <Link
          to="/"
          className="rounded-xl border border-line bg-navy-800 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-navy-700"
        >
          กลับหน้าแรก
        </Link>
      </div>
    </div>
  );
}
