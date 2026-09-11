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
import { useMatchResult } from '@/room/useMatchResult';
import { useQueue } from '@/socket/useQueue';
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
 * ห้องแข่งทุกชนิด (1v1 และ 3–4 คน) — ล็อบบี้ + หน้าจอแข่ง + หน้าผลการแข่งขัน อยู่ในหน้าเดียวกัน
 *
 * โครงสามคอลัมน์ตามภาพ `design/Match - Join.png` / `Match - Playing.png` / `Match - Result.png`
 * ทั้งสามภาพใช้โครงเดียวกันเป๊ะ ต่างกันแค่เนื้อในคอลัมน์กลาง จึงไม่แยกเป็นคนละ route
 * (ADR-037 ข้อ 1) — เปลี่ยน route กลางแมตช์ = คิวบ์ถูก unmount แล้วสร้าง WebGL ใหม่
 *
 * ห้อง 3–4 คนใช้โครงเดียวกันนี้: **คิวบ์ที่ยึด 1 ตัวทางซ้าย + แถบคู่แข่ง N−1 ตัวทางขวา**
 * ห้อง 1v1 คือกรณีที่แถบมีตัวเดียว จึงได้ DOM ชุดเดิมทุกตัว (ADR-041 ข้อ 4 · ADR-044 ข้อ 3)
 */
export default function RoomPage() {
  const { roomId: roomIdParam } = useParams<{ roomId: string }>();
  const roomId = Number(roomIdParam);
  const valid = Number.isInteger(roomId) && roomId > 0;

  return (
    // จอ `lg` ขึ้นไปล็อกความสูงเท่าจอ หน้าไม่เลื่อน · จอแคบคอลัมน์ซ้อนกันจึงยังเลื่อนได้ (ADR-059 ข้อ 3)
    <div className="min-h-screen bg-navy-900 lg:flex lg:h-[calc(100dvh-var(--offline-banner-h,0px))] lg:min-h-0 lg:flex-col lg:overflow-hidden">
      <AppHeader />
      <main className="page-wide px-4 py-4 lg:min-h-0 lg:flex-1">
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
  const queue = useQueue();
  const { status: socketStatus } = useSocket();
  const { snapshot, status, goneMessage, me, others, isSpectator, isHost } = room;
  // เข้ามาหลังรอบจบ (กด F5 / ผู้ชมเพิ่งเข้า) จะไม่มี `match:finished` — ขอย้อนหลังแทน
  const result = useMatchResult(snapshot, match.result);

  if (status === 'gone') return <RoomGoneCard message={goneMessage ?? 'ไม่ได้อยู่ในห้องนี้แล้ว'} />;
  // ยังไม่เคยได้ snapshot แรก — แยกให้ชัดว่าติดที่การเชื่อมต่อหรือแค่รอ ack
  if (!snapshot) return socketStatus === 'error' ? <ConnectionErrorCard /> : <PageSpinner />;

  /**
   * คิวบ์ก้อนใหญ่ทางซ้าย = ที่นั่งของเรา · **ผู้ชมไม่มีที่นั่ง จึงยึด `players[0]` แทน**
   * ซึ่งตรงกับพฤติกรรมเดิมของห้อง 1v1 ที่ผู้ชมเห็น `players[0]` ซ้าย `players[1]` ขวา
   */
  const focusPlayer = isSpectator ? (snapshot.players[0] ?? null) : me;
  const rivals = isSpectator ? snapshot.players.slice(1) : others;
  /** ห้องที่ยังไม่ครบต้องเห็นช่องว่างด้วย ไม่งั้นล็อบบี้ 4 คนจะดูเหมือนห้องเล็กลง */
  const rivalSlots: (PlayerPublic | null)[] = [...rivals];
  while (rivalSlots.length < Math.max(1, snapshot.maxPlayers - 1)) rivalSlots.push(null);
  const compactRivals = rivalSlots.length > 1;

  const leave = async () => {
    if (await room.leave()) navigate('/', { replace: true });
  };

  /**
   * ห้องที่มาจากคิวไม่มี "เล่นอีกครั้ง" — คู่แข่งคนใหม่ต้องมาจากคิว (ADR-040 ข้อ 4 · ADR-043 ข้อ 4)
   * กลับเข้า **ช่องคิวเดิม** ที่พาเรามาที่ห้องนี้ ไม่ใช่ช่อง 1v1 เสมอไป
   */
  const requeue = async () => {
    if (!(await room.leave())) return;
    navigate('/', { replace: true });
    await queue.join(
      snapshot.cubeType,
      snapshot.roomKind === 'multiplayer' ? 'multiplayer' : 'competitive',
    );
  };

  return (
    <div className="flex flex-col gap-4 lg:h-full">
      {socketStatus !== 'connected' && <ConnectionBanner />}

      {/* layout สามคอลัมน์ "แบบเดิม" — ก้อนที่ 6 ของเฟส 12 จะเป็นตัวเลือกหนึ่ง ห้ามลบ (ADR-059 ข้อ 5) */}
      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[1fr_360px_1fr]">
        <PlayerCubePanel
          player={focusPlayer}
          snapshot={snapshot}
          isMe={!isSpectator && focusPlayer?.userId === me?.userId}
          emptyLabel={isSpectator ? 'รอผู้เล่นเข้าห้อง' : 'ที่นั่งของคุณ'}
          match={match}
        />

        {/* จอเตี้ยกว่าเนื้อหา → เลื่อนในคอลัมน์นี้เอง ปุ่มยอมแพ้/ออกจากห้องต้องกดถึงเสมอ */}
        <div className="flex flex-col gap-4 lg:min-h-0 lg:overflow-y-auto">
          <RoomHeaderCard snapshot={snapshot} focus={focusPlayer} rivals={rivals} />
          <MatchPanel
            snapshot={snapshot}
            match={match}
            result={result}
            me={me}
            focusPlayer={focusPlayer}
            isSpectator={isSpectator}
            isHost={isHost}
            roomBusy={room.busy}
            roomError={room.actionError}
            onSetReady={room.setReady}
            onLeave={leave}
            onRequeue={requeue}
            queueBusy={queue.busy}
          />
        </div>

        {/*
          แถบคู่แข่ง — ห้อง 1v1 มีแผงเดียว จึงได้กล่องเดิมที่ล็อกความสูงเอง (`compact = false`)
          ห้อง 3–4 คนให้คอลัมน์นี้ล็อกความสูงแทน แล้วหารให้แผงย่อยเท่า ๆ กัน (ADR-044 ข้อ 3)
        */}
        <div
          className={
            compactRivals ? 'flex h-[30rem] flex-col gap-3 lg:h-auto lg:min-h-0' : 'lg:min-h-0'
          }
        >
          {rivalSlots.map((rival, index) => (
            <PlayerCubePanel
              key={rival?.userId ?? `empty-${index}`}
              player={rival}
              snapshot={snapshot}
              isMe={false}
              emptyLabel="รอผู้เล่นเข้าห้อง"
              match={match}
              compact={compactRivals}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- คอลัมน์กลาง

interface MatchPanelProps {
  snapshot: RoomSnapshot;
  match: UseMatchResult;
  /** ผลรอบล่าสุด — จาก `match:finished` หรือขอย้อนหลังทาง REST */
  result: MatchResult | null;
  me: PlayerPublic | null;
  /** ผู้เล่นที่ตัวเลขเวลาตรงกลางยึดเป็นหลัก — ผู้ชมยึดคนซ้าย */
  focusPlayer: PlayerPublic | null;
  isSpectator: boolean;
  isHost: boolean;
  roomBusy: boolean;
  roomError: string | null;
  onSetReady: (ready: boolean) => Promise<void>;
  onLeave: () => Promise<void>;
  /** ออกจากห้องแข่งขันแล้วเข้าคิวหาคู่ใหม่ทันที */
  onRequeue: () => Promise<void>;
  queueBusy: boolean;
}

function MatchPanel({
  snapshot,
  match,
  result,
  me,
  focusPlayer,
  isSpectator,
  isHost,
  roomBusy,
  roomError,
  onSetReady,
  onLeave,
  onRequeue,
  queueBusy,
}: MatchPanelProps) {
  const { state } = snapshot;
  const inLobby = state === 'WAITING';
  const finished = state === 'FINISHED';
  const racing = state === 'SOLVING' || state === 'FINAL_COUNTDOWN';
  /**
   * **ห้องที่มาจากคิว** (แข่งขัน 1v1 + หลายคนโหมด auto) เดินเองทั้งหมด — ไม่มี host
   * ไม่มีปุ่มเริ่ม ไม่มี "พร้อม" และเล่นซ้ำในห้องเดิมไม่ได้ เพราะสองห้องนี้ปรับคะแนนจริง
   * ถ้าเล่นซ้ำได้จะกลายเป็นช่องปั๊มคะแนน (`socket-events.md` ข้อ 4 · ADR-043 ข้อ 4)
   * — ตรงกับ `isQueueRoom()` ฝั่ง server เป๊ะ · `isHost` ของห้องพวกนี้ไม่มีความหมาย
   */
  const fromQueue =
    snapshot.roomKind === 'competitive' ||
    (snapshot.roomKind === 'multiplayer' && snapshot.roomMode === 'auto');

  const myProgress = me ? findProgress(snapshot, me.userId) : null;
  const focusProgress = focusPlayer ? findProgress(snapshot, focusPlayer.userId) : null;
  const canSurrender = racing && myProgress?.status === 'solving';

  const roomIsFull = snapshot.players.length >= snapshot.maxPlayers;
  const everyoneConnected = snapshot.players.every((player) => player.connected);
  const canStart =
    !fromQueue &&
    isHost &&
    (inLobby || finished) &&
    roomIsFull &&
    everyoneConnected &&
    !match.busy &&
    !roomBusy;

  const error = match.actionError ?? roomError;

  return (
    <section className="rounded-2xl border border-line bg-navy-850 px-5 py-6 text-center">
      <p className="text-xs text-slate-400">สถานะการเล่น</p>
      <p className="mt-1 text-2xl font-bold text-brand-400">{headline(snapshot, result)}</p>

      <MatchClockBlock snapshot={snapshot} progress={focusProgress} />

      <p className="mt-5 min-h-[3.5rem] text-sm leading-6 text-slate-400">
        {hintText(snapshot, roomIsFull, isSpectator, fromQueue)}
      </p>

      <ScrambleBox scramble={snapshot.scramble} />

      <EloRows snapshot={snapshot} result={result} />

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
            {fromQueue ? (
              // ห้องจากคิว: มีแค่ "ยอมแพ้" ระหว่างแข่ง กับ "เข้าคิวใหม่" ตอนจบ
              <div className="grid gap-2.5">
                {racing ? (
                  <SurrenderButton
                    disabled={!canSurrender}
                    onConfirm={() => void match.surrender()}
                  />
                ) : (
                  finished && (
                    <button
                      type="button"
                      disabled={roomBusy || queueBusy}
                      onClick={() => void onRequeue()}
                      className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-500/40"
                    >
                      {snapshot.roomKind === 'multiplayer' ? 'เข้าคิวรอบใหม่' : 'หาคู่ใหม่'}
                    </button>
                  )
                )}
              </div>
            ) : (
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
            )}

            {/* ปุ่มทดสอบ — โผล่เฉพาะเมื่อ server เปิดสวิตช์ · เวลาหยุด ณ ตอนกด (ADR-060)
                ⚠️ ถอดออกก่อน deploy · เงื่อนไขกดได้เท่ากับปุ่มยอมแพ้ (ผู้เล่นที่ยังแก้อยู่) */}
            {snapshot.devInstantFinish && racing && (
              <button
                type="button"
                disabled={!canSurrender || match.busy}
                onClick={() => void match.devFinish()}
                className="rounded-xl border border-dashed border-gold-400/60 px-4 py-2.5 text-sm font-semibold text-gold-400 transition hover:bg-gold-400/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                เสร็จทันที (ทดสอบ)
              </button>
            )}

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
        {/* ห้องผู้เล่นหลายคนไม่รองรับผู้ชม (game-rules.md ข้อ 9) — โชว์ "0 คน" ชวนเข้าใจผิด */}
        {snapshot.roomKind !== 'multiplayer' && (
          <Row label="ผู้ชม" value={`${snapshot.spectatorCount} คน`} />
        )}
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

/** ที่มาของชื่อบนแถวผล — คนที่ออกจากห้องไปแล้วเหลือแค่ `username` จากผลแมตช์ */
type NameSource = Pick<PlayerPublic, 'username' | 'nickname'>;

/**
 * "NTK ได้แต้ม +15" ตามภาพ `design/Match - Result.png`
 * ห้องที่ปรับคะแนนเพิ่มคะแนน **ก่อน → หลัง** ต่อท้ายด้วย เพราะเป็นตัวเลขที่ผู้เล่นมาลุ้นจริง ๆ
 *
 * ห้อง 3–4 คนเรียงตาม `rankNo` แล้วเติมเลขอันดับข้างหน้า **เมื่อมีแถวเกิน 2 แถวเท่านั้น**
 * เพราะที่ 4 คนต้องรู้ว่าใครที่ 1–4 ส่วนห้อง 1v1 ต้องได้หน้าตาเดิมเป๊ะ (ADR-044 ข้อ 5)
 */
function EloRows({ snapshot, result }: { snapshot: RoomSnapshot; result: MatchResult | null }) {
  // ห้องสร้างเองไม่ปรับคะแนนเลย (CLAUDE.md ข้อ 7) — ห้องแข่งขัน + หลายคนโหมด auto ปรับจริง
  const ratingApplied = result
    ? result.ratingApplied
    : snapshot.roomKind === 'competitive' ||
      (snapshot.roomKind === 'multiplayer' && snapshot.roomMode === 'auto');

  /**
   * ก่อนจบรอบยังไม่มีอันดับให้เรียง จึงเรียงตามลำดับที่นั่งไปก่อน
   * พอมีผลแล้วยึดลำดับของ `result.results` ซึ่ง server เรียงตาม `rankNo` มาให้แล้ว
   */
  const rows: { userId: number; entry: MatchResultEntry | null; name: NameSource }[] = result
    ? result.results.map((entry) => ({
        userId: entry.userId,
        entry,
        // คนที่ออกจากห้องไปแล้วหลังจบรอบยังต้องมีชื่อในตาราง — ใช้ username จากผลแทน
        name: snapshot.players.find((p) => p.userId === entry.userId) ?? {
          username: entry.username,
          nickname: null,
        },
      }))
    : snapshot.players.map((player) => ({ userId: player.userId, entry: null, name: player }));

  // นับจากแถวที่จะวาดจริง — คนที่ออกจากห้องหลังจบรอบยังมีแถว แต่หายไปจาก `snapshot.players`
  const showRank = rows.length > 2;

  return (
    <dl className="mt-5 space-y-1.5 text-left text-sm">
      {rows.map(({ userId, entry, name }) => {
        const change = entry?.eloChange ?? null;
        return (
          <div key={userId} className="flex items-center justify-between gap-3">
            <dt className="truncate text-slate-500">
              {showRank && entry && (
                <span className="tabular mr-1.5 text-slate-400">#{entry.rankNo}</span>
              )}
              {playerName(name)} ได้แต้ม
            </dt>
            <dd className="flex shrink-0 items-center gap-2">
              {ratingApplied && entry?.eloBefore != null && entry.eloAfter != null && (
                <span className="tabular text-xs text-slate-500">
                  {entry.eloBefore} → <span className="text-slate-300">{entry.eloAfter}</span>
                </span>
              )}
              <span
                className={`tabular ${
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
              </span>
            </dd>
          </div>
        );
      })}
      {!ratingApplied && (
        <p className="pt-1 text-xs text-slate-600">ห้องสร้างเองไม่มีผลต่อคะแนน ELO</p>
      )}
      {ratingApplied && snapshot.state === 'FINISHED' && !result && (
        <p className="pt-1 text-xs text-slate-600">กำลังโหลดคะแนนของรอบนี้…</p>
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

function hintText(
  snapshot: RoomSnapshot,
  roomIsFull: boolean,
  isSpectator: boolean,
  fromQueue: boolean,
): string {
  const many = snapshot.maxPlayers > 2;
  switch (snapshot.state) {
    case 'WAITING':
      if (isSpectator) return 'กำลังรอหัวห้องเริ่มการแข่งขัน';
      return roomIsFull
        ? 'ผู้เล่นครบแล้ว รอหัวห้องกดเริ่มการแข่งขัน'
        : `รอผู้เล่นอีก ${snapshot.maxPlayers - snapshot.players.length} คน · ส่งรหัสห้องด้านบนให้เพื่อนกด “ใส่เลขห้อง”`;
    case 'MATCHED':
      return many
        ? `รวมกลุ่มได้ ${snapshot.players.length} คนแล้ว · ระบบจะเริ่มให้เองในอีก 2 วินาที`
        : 'เจอคู่แข่งแล้ว · ดูคะแนนของอีกฝ่ายไว้ แล้วระบบจะเริ่มให้เองในอีก 2 วินาที';
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
      return fromQueue
        ? `จบรอบแล้ว · คะแนน ELO ถูกปรับให้เรียบร้อย — กดปุ่มด้านล่างเพื่อเข้าคิวรอบต่อไป${
            many ? ' (คะแนนคิดแบบจับทุกคู่ในห้อง)' : ''
          }`
        : 'จบรอบแล้ว · หัวห้องกด “เล่นอีกครั้ง” เพื่อสุ่ม scramble ใหม่ในห้องเดิมได้';
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

/**
 * การ์ดหัวห้อง: เรา + รหัสห้องตรงกลาง + คู่แข่ง (กดรหัสเพื่อคัดลอก)
 * ห้องที่มาจากคิวไม่มีรหัสห้องและเข้าด้วยรหัสไม่ได้ (ADR-039 ข้อ 5) — ช่องกลางบอกชนิดห้องแทน
 *
 * ห้อง 3–4 คนวางคู่แข่งเรียงกันในช่องขวาช่องเดียว — ที่ 1 คนได้ผลเหมือนของเดิมเป๊ะ
 */
function RoomHeaderCard({
  snapshot,
  focus,
  rivals,
}: {
  snapshot: RoomSnapshot;
  focus: PlayerPublic | null;
  rivals: PlayerPublic[];
}) {
  const noCode = snapshot.roomCode === null;

  return (
    <section className="grid grid-cols-3 items-center gap-2 rounded-2xl border border-line bg-navy-850 px-4 py-5">
      <PlayerChip player={focus} />
      <div className="text-center">
        <p className="text-xs text-slate-400">{noCode ? roomKindLabel(snapshot) : 'เลขห้อง'}</p>
        {noCode ? (
          <p className="mt-0.5 text-sm font-semibold text-gold-400">มีผลต่อคะแนน ELO</p>
        ) : (
          <RoomCodeButton roomCode={snapshot.roomCode} />
        )}
      </div>
      {rivals.length > 1 ? (
        <div className="flex flex-wrap items-start justify-center gap-3">
          {rivals.map((rival) => (
            <PlayerChip key={rival.userId} player={rival} />
          ))}
        </div>
      ) : (
        <PlayerChip player={rivals[0] ?? null} />
      )}
    </section>
  );
}

/** ชนิดห้องสำหรับช่องกลางของการ์ดหัวห้อง — ใช้เฉพาะห้องที่ไม่มีรหัสห้อง (มาจากคิว) */
function roomKindLabel(snapshot: RoomSnapshot): string {
  return snapshot.roomKind === 'multiplayer'
    ? `ห้องผู้เล่นหลายคน ${snapshot.maxPlayers} คน`
    : 'ห้องแข่งขัน';
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
