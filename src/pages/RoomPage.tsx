import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/Avatar';
import { FormAlert } from '@/components/FormAlert';
import { PageSpinner } from '@/components/PageSpinner';
import { formatEloChange } from '@/lib/format';
import { LiveTime, type LiveTimeMode } from '@/room/LiveTime';
import { PlayerCubePanel } from '@/room/PlayerCubePanel';
import { ConnectionBanner, ConnectionErrorCard } from '@/socket/SocketGate';
import { ROOM_STATE_LABEL } from '@/socket/room-labels';
import { useMatch, type UseMatchResult } from '@/socket/useMatch';
import { useRoom } from '@/socket/useRoom';
import { useSocket } from '@/socket/useSocket';
import {
  playerName,
  type MatchResult,
  type MatchResultEntry,
  type PlayerProgress,
  type PlayerPublic,
  type RoomSnapshot,
} from '@/socket/types';
import { CUBE_TYPE_LABEL } from '@/types/leaderboard';

/**
 * ห้องสร้างเอง 1v1 — ล็อบบี้ + หน้าจอแข่ง + หน้าผลการแข่งขัน อยู่ในหน้าเดียวกัน
 *
 * โครงสามคอลัมน์ตามภาพ `design/Match - Join.png` / `Match - Playing.png` / `Match - Result.png`
 * ทั้งสามภาพใช้โครงเดียวกันเป๊ะ ต่างกันแค่เนื้อในคอลัมน์กลาง จึงไม่แยกเป็นคนละ route
 * (ADR-037 ข้อ 1) — เปลี่ยน route กลางแมตช์ = คิวบ์สองลูกถูก unmount แล้วสร้าง WebGL ใหม่
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
  const match = useMatch(room.snapshot);
  const { status: socketStatus } = useSocket();
  const { snapshot, status, goneMessage, me, others, isSpectator, isHost } = room;

  if (status === 'gone') return <RoomGoneCard message={goneMessage ?? 'ไม่ได้อยู่ในห้องนี้แล้ว'} />;
  // ยังไม่เคยได้ snapshot แรก — แยกให้ชัดว่าติดที่การเชื่อมต่อหรือแค่รอ ack
  if (!snapshot) return socketStatus === 'error' ? <ConnectionErrorCard /> : <PageSpinner />;

  // ผู้ชมไม่มีที่นั่ง จึงเรียงผู้เล่นตามลำดับที่เข้าห้องแทนที่จะยึด "ฝั่งเรา / ฝั่งคู่แข่ง"
  const leftPlayer = isSpectator ? (snapshot.players[0] ?? null) : me;
  const rightPlayer = isSpectator ? (snapshot.players[1] ?? null) : (others[0] ?? null);

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

      <PlayerCubePanel
        player={leftPlayer}
        snapshot={snapshot}
        isMe={!isSpectator && leftPlayer?.userId === me?.userId}
        emptyLabel={isSpectator ? 'รอผู้เล่นเข้าห้อง' : 'ที่นั่งของคุณ'}
        match={match}
      />

      <div className="flex flex-col gap-4">
        <RoomHeaderCard snapshot={snapshot} left={leftPlayer} right={rightPlayer} />
        <MatchPanel
          snapshot={snapshot}
          match={match}
          me={me}
          focusPlayer={isSpectator ? leftPlayer : me}
          isSpectator={isSpectator}
          isHost={isHost}
          roomBusy={room.busy}
          roomError={room.actionError}
          onSetReady={room.setReady}
          onLeave={leave}
        />
      </div>

      <PlayerCubePanel
        player={rightPlayer}
        snapshot={snapshot}
        isMe={!isSpectator && rightPlayer?.userId === me?.userId}
        emptyLabel="รอผู้เล่นเข้าห้อง"
        match={match}
      />
    </div>
  );
}

// ---------------------------------------------------------------- คอลัมน์กลาง

interface MatchPanelProps {
  snapshot: RoomSnapshot;
  match: UseMatchResult;
  me: PlayerPublic | null;
  /** ผู้เล่นที่ตัวเลขเวลาตรงกลางยึดเป็นหลัก — ผู้ชมยึดคนซ้าย */
  focusPlayer: PlayerPublic | null;
  isSpectator: boolean;
  isHost: boolean;
  roomBusy: boolean;
  roomError: string | null;
  onSetReady: (ready: boolean) => Promise<void>;
  onLeave: () => Promise<void>;
}

function MatchPanel({
  snapshot,
  match,
  me,
  focusPlayer,
  isSpectator,
  isHost,
  roomBusy,
  roomError,
  onSetReady,
  onLeave,
}: MatchPanelProps) {
  const { state } = snapshot;
  const inLobby = state === 'WAITING';
  const finished = state === 'FINISHED';
  const racing = state === 'SOLVING' || state === 'FINAL_COUNTDOWN';

  const myProgress = me ? findProgress(snapshot, me.userId) : null;
  const focusProgress = focusPlayer ? findProgress(snapshot, focusPlayer.userId) : null;
  const canSurrender = racing && myProgress?.status === 'solving';

  const roomIsFull = snapshot.players.length >= snapshot.maxPlayers;
  const everyoneConnected = snapshot.players.every((player) => player.connected);
  const canStart =
    isHost && (inLobby || finished) && roomIsFull && everyoneConnected && !match.busy && !roomBusy;

  const error = match.actionError ?? roomError;

  return (
    <section className="rounded-2xl border border-line bg-navy-850 px-5 py-6 text-center">
      <p className="text-xs text-slate-400">สถานะการเล่น</p>
      <p className="mt-1 text-2xl font-bold text-brand-400">{headline(snapshot, match.result)}</p>

      <MatchClockBlock snapshot={snapshot} progress={focusProgress} />

      <p className="mt-5 min-h-[3.5rem] text-sm leading-6 text-slate-400">
        {hintText(snapshot, roomIsFull, isSpectator)}
      </p>

      <ScrambleBox scramble={snapshot.scramble} />

      <EloRows snapshot={snapshot} result={match.result} />

      {match.desynced && racing && (
        <p className="mt-4 rounded-xl border border-loss/40 bg-loss/10 px-3 py-2 text-left text-xs leading-5 text-loss">
          {match.reloadedMidSolve
            ? 'รีเฟรชหน้าระหว่างรอบ — คิวบ์กลับไปที่ scramble แต่เซิร์ฟเวอร์ยังจำท่าที่หมุนไปแล้ว รอบนี้จึงแก้ต่อให้จบไม่ได้ กดยอมแพ้แล้วเริ่มรอบใหม่'
            : 'การหมุนของคุณกับเซิร์ฟเวอร์ไม่ตรงกันแล้ว — รอบนี้จะยืนยันผลไม่ได้ แนะนำให้กดยอมแพ้แล้วเริ่มรอบใหม่'}
        </p>
      )}

      {error && (
        <div className="mt-4 text-left">
          <FormAlert message={error} />
        </div>
      )}

      <div className="mt-5 flex flex-col gap-2.5">
        {isSpectator ? (
          <p className="rounded-xl border border-line-soft bg-navy-900/60 px-4 py-2.5 text-sm text-slate-400">
            คุณกำลังดูอยู่ในฐานะผู้ชม
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={roomBusy || !inLobby}
                onClick={() => void onSetReady(!me?.isReady)}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  me?.isReady
                    ? 'border border-line bg-navy-800 text-slate-200 hover:bg-navy-700'
                    : 'bg-win/90 text-navy-950 hover:bg-win'
                }`}
              >
                {me?.isReady ? 'ยกเลิกพร้อม' : 'พร้อม'}
              </button>

              {racing ? (
                <SurrenderButton
                  disabled={!canSurrender}
                  onConfirm={() => void match.surrender()}
                />
              ) : (
                <button
                  type="button"
                  disabled={!canStart}
                  onClick={() => void match.start()}
                  className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-navy-800 disabled:text-slate-500"
                >
                  {startButtonLabel(isHost, finished, roomIsFull, everyoneConnected)}
                </button>
              )}
            </div>

            {/* ระหว่างโหลด/นับถอยหลัง/ตรวจสอบ ยังยอมแพ้ไม่ได้ (server ปฏิเสธ) — บอกไว้ให้ชัด */}
            {(state === 'LOADING' || state === 'COUNTDOWN' || state === 'INSPECTION') && (
              <p className="text-xs text-slate-500">ยอมแพ้ได้เมื่อเริ่มจับเวลาแล้วเท่านั้น</p>
            )}
          </>
        )}

        <button
          type="button"
          disabled={roomBusy}
          onClick={() => void onLeave()}
          className="rounded-xl border border-line bg-navy-800 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ออกจากห้อง
        </button>
      </div>

      <dl className="mt-5 space-y-1.5 text-left text-sm">
        <Row label="ประเภทรูบิค" value={CUBE_TYPE_LABEL[snapshot.cubeType]} />
        <Row label="ผู้เล่น" value={`${snapshot.players.length}/${snapshot.maxPlayers} คน`} />
        <Row label="ผู้ชม" value={`${snapshot.spectatorCount} คน`} />
      </dl>
    </section>
  );
}

/** ตัวเลขเวลาก้อนใหญ่ตรงกลาง + บรรทัดนับถอยหลัง 10 วินาทีตอนมีคนแก้เสร็จแล้ว */
function MatchClockBlock({
  snapshot,
  progress,
}: {
  snapshot: RoomSnapshot;
  progress: PlayerProgress | null;
}) {
  const { state, phaseEndsAtTs, serverStartTs } = snapshot;
  const counting = state === 'COUNTDOWN' || state === 'INSPECTION';

  let mode: LiveTimeMode = 'idle';
  let ts: number | null = null;
  let frozenMs: number | null = null;

  if (counting) {
    mode = 'countdown';
    ts = phaseEndsAtTs;
  } else if (progress && progress.status !== 'solving') {
    // จบรอบของตัวเองแล้ว (เสร็จ / DNF / ยอมแพ้) → ค้างค่าที่ server ตัดสินไว้
    mode = 'frozen';
    frozenMs = progress.solveTimeMs;
  } else if (serverStartTs !== null && (state === 'SOLVING' || state === 'FINAL_COUNTDOWN')) {
    mode = 'elapsed';
    ts = serverStartTs;
  }

  const label = counting
    ? state === 'COUNTDOWN'
      ? 'เริ่มใน (วินาที)'
      : 'เวลาตรวจสอบ (วินาที)'
    : 'เวลา';

  return (
    <div className="mt-6">
      <p className="text-xs text-slate-400">{label}</p>
      <LiveTime
        mode={mode}
        ts={ts}
        frozenMs={frozenMs}
        className={`tabular block text-5xl font-bold ${
          counting
            ? 'text-gold-400'
            : mode === 'frozen' && frozenMs === null
              ? 'text-loss'
              : 'text-white'
        }`}
      />
      {state === 'FINAL_COUNTDOWN' && phaseEndsAtTs !== null && (
        <p className="mt-2 text-sm font-semibold text-loss">
          เหลืออีก <LiveTime mode="countdown" ts={phaseEndsAtTs} className="tabular" /> วินาที
        </p>
      )}
    </div>
  );
}

/** "NTK ได้แต้ม +15" ตามภาพ `design/Match - Result.png` */
function EloRows({ snapshot, result }: { snapshot: RoomSnapshot; result: MatchResult | null }) {
  // ห้องสร้างเองไม่ปรับคะแนนเลย (CLAUDE.md ข้อ 7) — ห้องแข่งขันเปิดจริงในเฟส 5
  const ratingApplied = result ? result.ratingApplied : snapshot.roomKind === 'competitive';

  return (
    <dl className="mt-5 space-y-1.5 text-left text-sm">
      {snapshot.players.map((player) => {
        const entry = result?.results.find((row) => row.userId === player.userId);
        const change = entry?.eloChange ?? null;
        return (
          <div key={player.userId} className="flex items-center justify-between gap-3">
            <dt className="truncate text-slate-500">{playerName(player)} ได้แต้ม</dt>
            <dd
              className={`tabular shrink-0 ${
                !ratingApplied || change === null
                  ? 'text-slate-500'
                  : change > 0
                    ? 'text-win'
                    : change < 0
                      ? 'text-loss'
                      : 'text-slate-200'
              }`}
            >
              {!ratingApplied ? 'ไม่มีผล' : change === null ? '—' : formatEloChange(change)}
            </dd>
          </div>
        );
      })}
      {!ratingApplied && (
        <p className="pt-1 text-xs text-slate-600">ห้องสร้างเองไม่มีผลต่อคะแนน ELO</p>
      )}
    </dl>
  );
}

/**
 * ยอมแพ้ = DNF ทันทีและกู้คืนไม่ได้ (game-rules.md ข้อ 5) จึงต้องกดยืนยันอีกครั้ง
 * ในห้องแข่งขันของเฟส 5 การกดพลาดหนึ่งครั้งมีราคาเป็นคะแนน Elo จริง ๆ
 */
function SurrenderButton({ disabled, onConfirm }: { disabled: boolean; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (armed) onConfirm();
        else setArmed(true);
      }}
      onBlur={() => setArmed(false)}
      className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-navy-800 disabled:text-slate-500 ${
        armed ? 'bg-loss text-white' : 'bg-loss/80 text-white hover:bg-loss'
      }`}
    >
      {armed ? 'กดอีกครั้งเพื่อยืนยัน' : 'ยอมแพ้'}
    </button>
  );
}

// ---------------------------------------------------------------- ข้อความ

function findProgress(snapshot: RoomSnapshot, userId: number): PlayerProgress | null {
  return snapshot.progress.find((entry) => entry.userId === userId) ?? null;
}

/** ผู้ชนะ = คนเดียวที่ได้อันดับ 1 และแก้เสร็จจริง (ตรงกับ `findWinnerId` ฝั่ง server) */
function winnerOf(results: readonly MatchResultEntry[]): MatchResultEntry | null {
  const first = results.filter((row) => row.rankNo === 1 && row.solveTimeMs !== null);
  return first.length === 1 ? (first[0] ?? null) : null;
}

function headline(snapshot: RoomSnapshot, result: MatchResult | null): string {
  if (snapshot.state !== 'FINISHED') return ROOM_STATE_LABEL[snapshot.state];

  if (result) {
    const winner = winnerOf(result.results);
    if (winner) {
      const player = snapshot.players.find((entry) => entry.userId === winner.userId);
      return `${player ? playerName(player) : winner.username} ชนะ`;
    }
    return result.results.every((row) => row.solveTimeMs === null) ? 'ไม่มีผู้ชนะ (DNF)' : 'เสมอ';
  }

  // เข้ามาหลังรอบจบ (กด F5 / ผู้ชมเพิ่งเข้า) จึงไม่มี `match:finished` ให้ฟัง —
  // snapshot ยังเก็บเวลาของทุกคนไว้ พอตัดสินผู้ชนะได้เอง แต่ไม่มีข้อมูล Elo
  const solved = snapshot.progress.filter((entry) => entry.solveTimeMs !== null);
  if (solved.length === 0) return 'ไม่มีผู้ชนะ (DNF)';
  const best = Math.min(...solved.map((entry) => entry.solveTimeMs!));
  const leaders = solved.filter((entry) => entry.solveTimeMs === best);
  if (leaders.length !== 1) return 'เสมอ';
  const player = snapshot.players.find((entry) => entry.userId === leaders[0]!.userId);
  return player ? `${playerName(player)} ชนะ` : 'จบการแข่งขัน';
}

function hintText(snapshot: RoomSnapshot, roomIsFull: boolean, isSpectator: boolean): string {
  switch (snapshot.state) {
    case 'WAITING':
      if (isSpectator) return 'กำลังรอหัวห้องเริ่มการแข่งขัน';
      return roomIsFull
        ? 'ผู้เล่นครบแล้ว รอหัวห้องกดเริ่มการแข่งขัน'
        : `รอผู้เล่นอีก ${snapshot.maxPlayers - snapshot.players.length} คน · ส่งรหัสห้องด้านบนให้เพื่อนกด “ใส่เลขห้อง”`;
    case 'LOADING':
      return 'กำลังโหลดคิวบ์ให้ทุกคน · เริ่มพร้อมกันเมื่อทุกเครื่องพร้อม';
    case 'COUNTDOWN':
      return 'เตรียมตัว — อีกไม่กี่วินาทีจะเข้าช่วงตรวจสอบ';
    case 'INSPECTION':
      return 'พลิกดูคิวบ์ได้ แต่หมุนหน้าคิวบ์ไม่ได้ · ครบ 15 วินาทีแล้วเริ่มจับเวลาพร้อมกันทุกคน';
    case 'SOLVING':
      return 'หมุนให้ครบทุกหน้า — ระบบจะหยุดเวลาให้เองทันทีที่คิวบ์ถูกแก้';
    case 'FINAL_COUNTDOWN':
      return 'มีผู้เล่นแก้เสร็จแล้ว · แก้ไม่ทันภายใน 10 วินาทีนี้จะเป็น DNF';
    case 'FINISHED':
      return 'จบรอบแล้ว · หัวห้องกด “เล่นอีกครั้ง” เพื่อสุ่ม scramble ใหม่ในห้องเดิมได้';
    default:
      return '';
  }
}

function startButtonLabel(
  isHost: boolean,
  finished: boolean,
  roomIsFull: boolean,
  everyoneConnected: boolean,
): string {
  if (!isHost) return finished ? 'รอหัวห้องเริ่มรอบใหม่' : 'รอหัวห้องเริ่ม';
  if (!roomIsFull) return 'รอผู้เล่นให้ครบ';
  if (!everyoneConnected) return 'รอผู้เล่นกลับมา';
  return finished ? 'เล่นอีกครั้ง' : 'เริ่มการแข่งขัน';
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
      <p className="tabular mt-1.5 break-words text-sm leading-6 text-slate-200">
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
