import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/Avatar';
import { BottomSheet } from '@/components/BottomSheet';
import { FormAlert } from '@/components/FormAlert';
import { PageSpinner } from '@/components/PageSpinner';
import { PlaySettingsMenu } from '@/components/PlaySettings';
import { useWideScreen } from '@/hooks/useWideScreen';
import { formatEloChange, formatSolveTime, toSolveSeconds } from '@/lib/format';
import { usePlayPrefs, type ResolvedRoomLayout, type RoomLayout } from '@/lib/play-prefs';
import { LiveTime, type LiveTimeMode } from '@/room/LiveTime';
import { PlayerCubePanel, type PlayerPanelVariant } from '@/room/PlayerCubePanel';
import { PipDock } from '@/room/PipDock';
import { RoomStage } from '@/room/RoomStage';
import { ConnectionBanner, ConnectionErrorCard } from '@/socket/SocketGate';
import { ROOM_STATE_LABEL } from '@/socket/room-labels';
import { useMatch, type UseMatchResult } from '@/socket/useMatch';
import { useMatchResult } from '@/room/useMatchResult';
import { useQueue } from '@/socket/useQueue';
import { useRoom } from '@/socket/useRoom';
import { useSocket } from '@/socket/useSocket';
import { useTutorial } from '@/tutorial/useTutorial';
import {
  playerName,
  type MatchResult,
  type MatchResultEntry,
  type PlayerProgress,
  type PlayerPublic,
  type RoomSnapshot,
  type Seat,
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
 *
 * **ตั้งแต่เฟส 12 ก้อนที่ 6** โครงสามคอลัมน์กลายเป็นหนึ่งใน 4 แบบที่ผู้เล่นเลือกได้จากปุ่มเฟือง
 * (`RoomStage` เป็นคนวาง · ADR-063) — ของที่อยู่ในแต่ละช่องยังเป็นชิ้นเดิมทุกตัว
 */
export default function RoomPage() {
  const { roomId: roomIdParam } = useParams<{ roomId: string }>();
  const roomId = Number(roomIdParam);
  const valid = Number.isInteger(roomId) && roomId > 0;
  const wideScreen = useWideScreen();
  const { roomLayout } = usePlayPrefs();
  /**
   * จอแคบกว่า `lg` + layout `auto`/`focus` = **โครงแนวตั้งจบในจอเดียว** (ADR-083 ข้อ 5)
   * ผู้เล่นที่เลือก `classic`/`sides`/`stacked` เองบนจอแคบยังได้แผงซ้อนที่เลื่อนได้แบบเดิม (ADR-063 ข้อ 3)
   */
  const mobile = !wideScreen && (roomLayout === 'auto' || roomLayout === 'focus');

  return (
    // ⚠️ `RoomView` ต้องอยู่ตำแหน่งเดิมใน tree ทั้งสองโครง — สลับโครงแล้วห้องต้องไม่ถูก mount ใหม่
    <div
      className={
        mobile
          ? 'flex h-app flex-col overflow-hidden bg-navy-900'
          : // จอ `lg` ขึ้นไปล็อกความสูงเท่าจอ หน้าไม่เลื่อน · จอแคบคอลัมน์ซ้อนกันจึงยังเลื่อนได้ (ADR-059 ข้อ 3)
            'min-h-app bg-navy-900 lg:flex lg:h-app lg:min-h-0 lg:flex-col lg:overflow-hidden'
      }
    >
      {/* จอแคบใช้แถบหัวของห้องเองแทน (ออก · ห้อง · ? · เฟือง) — ประหยัดที่ให้คิวบ์ */}
      {(!mobile || !valid) && <AppHeader />}
      <main
        className={
          mobile ? 'flex min-h-0 flex-1 flex-col' : 'page-wide px-4 py-4 lg:min-h-0 lg:flex-1'
        }
      >
        {valid ? (
          <RoomView roomId={roomId} mobile={mobile} />
        ) : (
          <RoomGoneCard message="เลขห้องในลิงก์ไม่ถูกต้อง" />
        )}
      </main>
    </div>
  );
}

/**
 * ห้ามครอบด้วย `SocketGate` — หน้านี้ต้องคาอยู่ระหว่างเน็ตกระตุก ไม่ใช่ถูก unmount
 * ที่นั่งในห้องผูกกับ `userId` ไม่ใช่ socket ต่อกลับมาแล้ว `room:rejoin` เอง (ADR-034 ข้อ 3)
 */
function RoomView({ roomId, mobile }: { roomId: number; mobile: boolean }) {
  const navigate = useNavigate();
  const room = useRoom(roomId);
  const match = useMatch(room.snapshot);
  const queue = useQueue();
  const { status: socketStatus } = useSocket();
  const { roomLayout, pipCorner, pipCollapsed } = usePlayPrefs();
  const wideScreen = useWideScreen();
  const { snapshot, status, goneMessage, me, others, isSpectator, isHost } = room;
  // เข้ามาหลังรอบจบ (กด F5 / ผู้ชมเพิ่งเข้า) จะไม่มี `match:finished` — ขอย้อนหลังแทน
  const result = useMatchResult(snapshot, match.result);

  if (status === 'gone' || !snapshot) {
    const card =
      status === 'gone' ? (
        <RoomGoneCard message={goneMessage ?? 'ไม่ได้อยู่ในห้องนี้แล้ว'} />
      ) : // ยังไม่เคยได้ snapshot แรก — แยกให้ชัดว่าติดที่การเชื่อมต่อหรือแค่รอ ack
      socketStatus === 'error' ? (
        <ConnectionErrorCard />
      ) : (
        <PageSpinner />
      );
    // จอแคบไม่มีแถบหัวของเว็บ (ใช้ของห้องแทน) — ตอนยังไม่มีห้องให้ใส่คืน ไม่งั้นไม่มีทางกลับ
    return mobile ? (
      <>
        <AppHeader />
        <div className="px-4 py-4">{card}</div>
      </>
    ) : (
      card
    );
  }

  /**
   * คิวบ์ก้อนใหญ่ทางซ้าย = ที่นั่งของเรา · **ผู้ชมไม่มีที่นั่ง จึงยึด `players[0]` แทน**
   * ซึ่งตรงกับพฤติกรรมเดิมของห้อง 1v1 ที่ผู้ชมเห็น `players[0]` ซ้าย `players[1]` ขวา
   */
  const focusPlayer = isSpectator ? (snapshot.players[0] ?? null) : me;
  const rivals = isSpectator ? snapshot.players.slice(1) : others;
  /** ห้องที่ยังไม่ครบต้องเห็นช่องว่างด้วย ไม่งั้นล็อบบี้ 4 คนจะดูเหมือนห้องเล็กลง */
  const rivalSlots: (PlayerPublic | null)[] = [...rivals];
  while (rivalSlots.length < Math.max(1, snapshot.maxPlayers - 1)) rivalSlots.push(null);

  const layout = resolveLayout(roomLayout, wideScreen, snapshot.maxPlayers === 2);
  /** แผงคู่แข่งย่อเมื่อมีหลายคน **หรือ** ตอนลอยมุมจอ (เตี้ยเกินกว่าจะมีแถวตัวเลขล่าง) */
  const compactRivals = rivalSlots.length > 1 || layout === 'focus';
  /** ลอยมุมจอบนจอแคบ = PiP คิวบ์เต็มกล่อง — `compact` ในกล่องเล็กขนาดนั้นเหลือที่ให้คิวบ์ ~20 px (ADR-081) */
  const pipRivals = layout === 'focus' && !wideScreen;
  const rivalVariant: PlayerPanelVariant = pipRivals ? 'pip' : compactRivals ? 'compact' : 'full';

  const rivalPanels = rivalSlots.map((rival, index) => (
    <PlayerCubePanel
      key={rival?.userId ?? `empty-${index}`}
      player={rival}
      snapshot={snapshot}
      isMe={false}
      emptyLabel="รอผู้เล่นเข้าห้อง"
      match={match}
      variant={rivalVariant}
      collapsed={pipRivals && pipCollapsed}
    />
  ));

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

  const matchPanelProps: MatchPanelProps = {
    snapshot,
    match,
    result,
    me,
    focusPlayer,
    isSpectator,
    isHost,
    roomBusy: room.busy,
    roomError: room.actionError,
    onSetReady: room.setReady,
    onSwitchSeat: room.switchSeat,
    onLeave: leave,
    onRequeue: requeue,
    queueBusy: queue.busy,
  };

  const selfPanel = (variant: PlayerPanelVariant) => (
    <PlayerCubePanel
      player={focusPlayer}
      snapshot={snapshot}
      isMe={!isSpectator && focusPlayer?.userId === me?.userId}
      emptyLabel={isSpectator ? 'รอผู้เล่นเข้าห้อง' : 'ที่นั่งของคุณ'}
      match={match}
      variant={variant}
      // จอแคบ: คู่แข่งอยู่ในกรอบคิวบ์เรา ลากย้ายมุม/ย่อได้ (ADR-081 ข้อ 2)
      overlay={
        pipRivals ? (
          <PipDock corner={pipCorner} collapsed={pipCollapsed} panels={rivalPanels} />
        ) : undefined
      }
    />
  );

  if (mobile) {
    return (
      <MobileRoomLayout
        panelProps={matchPanelProps}
        socketConnected={socketStatus === 'connected'}
        stage={selfPanel('stage')}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:h-full">
      {socketStatus !== 'connected' && <ConnectionBanner />}

      {/* ปุ่มเฟือง — ที่เดียวของมุมกล้อง/ทิศคิวบ์/การจัดวาง · ผู้ชมใช้ได้ด้วย (ADR-063 ข้อ 1) */}
      <div className="flex shrink-0 items-center justify-end">
        <PlaySettingsMenu
          cubeType={snapshot.cubeType}
          layout={{
            allowStacked: snapshot.maxPlayers === 2,
            rivalCount: Math.max(1, snapshot.maxPlayers - 1),
          }}
        />
      </div>

      <RoomStage
        layout={layout}
        compactRivals={compactRivals}
        pipRivals={pipRivals}
        self={selfPanel('full')}
        rivals={pipRivals ? [] : rivalPanels}
        info={
          <>
            <RoomHeaderCard snapshot={snapshot} focus={focusPlayer} rivals={rivals} />
            <MatchPanel {...matchPanelProps} />
          </>
        }
      />
    </div>
  );
}

/**
 * **ห้องแข่งบนจอแคบ** (ADR-083 ข้อ 5) — เรียงแนวตั้งหนึ่งจอ ไม่มีการเลื่อนหน้า
 *
 * แถบหัวห้อง → scramble บรรทัดเดียว → สถานะ + นาฬิกา + คำแนะนำ → คิวบ์เรา (`flex-1` + PiP คู่แข่ง) → แผงปุ่มล่าง
 * ผลจบรอบเป็นแผ่นเลื่อนขึ้น **ในหน้าห้องเดิม** ปิดแล้วเปิดซ้ำได้จากแผงล่าง
 *
 * ทุกชิ้นเป็นตัวเดียวกับจอกว้าง (`MatchPanel` · `MatchClockBlock` · `PlayerCubePanel` · `PipDock`)
 * เปลี่ยนแค่ที่วาง — ลำดับ state · การจับเวลา · การส่ง move ไม่ได้แตะ
 * ไม่มีลิงก์ไปหน้าผลแมตช์ในแผ่นผล: เปลี่ยนหน้าโดยไม่ `room:leave` = ที่นั่งยังค้างในห้อง (ดูย้อนหลังได้จากประวัติในโปรไฟล์)
 */
function MobileRoomLayout({
  panelProps,
  socketConnected,
  stage,
}: {
  panelProps: MatchPanelProps;
  socketConnected: boolean;
  /** แผงคิวบ์ของเรา (`variant="stage"`) พร้อม PiP คู่แข่ง */
  stage: ReactNode;
}) {
  // ป้าย "กำลังดูในฐานะผู้ชม" อยู่ในแผงล่างแล้ว (`MatchPanel` dock) · ชื่อเจ้าของคิวบ์ใหญ่อยู่บนป้ายในกรอบคิวบ์
  const { snapshot, result, focusPlayer, isSpectator, isHost, roomBusy, onLeave } = panelProps;
  const tutorial = useTutorial();
  const [scrambleOpen, setScrambleOpen] = useState(false);
  /** รอบที่ผู้ใช้ปิดแผ่นผลไปแล้ว — จบรอบใหม่ (`finishedAtTs` ใหม่) แผ่นเปิดเองอีกครั้ง */
  const [dismissedRound, setDismissedRound] = useState<number | null>(null);

  const fromQueue = isQueueRoom(snapshot);
  const roomIsFull = snapshot.players.length >= snapshot.maxPlayers;
  const focusProgress = focusPlayer ? findProgress(snapshot, focusPlayer.userId) : null;
  const resultOpen =
    snapshot.state === 'FINISHED' && result !== null && dismissedRound !== result.finishedAtTs;

  const facts = [
    CUBE_TYPE_LABEL[snapshot.cubeType],
    `ผู้เล่น ${snapshot.players.length}/${snapshot.maxPlayers}`,
    // ห้องจากคิวไม่มีผู้ชม (ADR-079) — บอกว่ามีผลคะแนนแทน
    fromQueue ? 'มีผลต่อ ELO' : `ผู้ชม ${snapshot.spectatorCount}`,
    !fromQueue && snapshot.host
      ? `หัวห้อง ${playerName(snapshot.host)}${snapshot.host.seat === 'spectator' ? ' (ผู้ชม)' : ''}`
      : null,
  ].filter((fact) => fact !== null);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 px-3 pt-2 pb-3">
      <header className="flex shrink-0 items-center gap-2">
        {/* ปุ่มออกมีทุกเฟสเหมือนจอกว้าง — ตรรกะการออกกลางแข่งเป็นของ `useRoom`/server (ADR-083 ข้อ 5) */}
        <button
          type="button"
          disabled={roomBusy}
          onClick={() => void onLeave()}
          className="shrink-0 rounded-lg border border-line bg-navy-850 px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ออก
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-100">
            {fromQueue ? roomKindLabel(snapshot) : 'ห้องสร้างเอง'}
          </p>
          <p className="truncate text-[11px] text-slate-400">{facts.join(' · ')}</p>
        </div>
        {snapshot.roomCode && <RoomCodeButton roomCode={snapshot.roomCode} compact />}
        {/* คู่มือต้องกดได้จากทุกหน้า (ADR-053 ข้อ 4) — แถบหัวของเว็บถูกซ่อนในห้องจอแคบ */}
        <button
          type="button"
          onClick={tutorial.open}
          aria-label="เปิดคู่มือการใช้งาน"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-navy-850 text-sm font-semibold text-slate-400 transition hover:text-slate-100"
        >
          ?
        </button>
        <PlaySettingsMenu
          iconOnly
          cubeType={snapshot.cubeType}
          layout={{
            allowStacked: snapshot.maxPlayers === 2,
            rivalCount: Math.max(1, snapshot.maxPlayers - 1),
          }}
        />
      </header>

      {!socketConnected && <ConnectionBanner />}

      <button
        type="button"
        onClick={() => setScrambleOpen((open) => !open)}
        aria-expanded={scrambleOpen}
        disabled={snapshot.scramble === null}
        className="flex shrink-0 items-center gap-2.5 rounded-xl border border-line-soft bg-navy-950/60 px-3 py-2 text-left disabled:cursor-default"
      >
        <span className="shrink-0 text-[10px] tracking-[0.2em] text-slate-500">SCRAMBLE</span>
        <span
          className={`tabular min-w-0 flex-1 text-sm text-slate-200 ${
            scrambleOpen ? 'break-words' : 'truncate'
          }`}
        >
          {snapshot.scramble ?? <span className="text-slate-600">จะแสดงเมื่อเริ่มการแข่งขัน</span>}
        </span>
      </button>

      <div className="shrink-0 text-center">
        <p className="text-xs font-semibold text-brand-400">{headline(snapshot, result)}</p>
        <MatchClockBlock snapshot={snapshot} progress={focusProgress} compact />
        <p className="mx-auto line-clamp-2 min-h-8 max-w-sm text-[11px] leading-4 text-slate-500">
          {hintText(snapshot, roomIsFull, isSpectator, isHost, fromQueue)}
        </p>
      </div>

      {stage}

      <MatchPanel {...panelProps} variant="dock" onShowResult={() => setDismissedRound(null)} />

      <BottomSheet
        open={resultOpen}
        onClose={() => result && setDismissedRound(result.finishedAtTs)}
        title={headline(snapshot, result)}
      >
        <MatchPanel {...panelProps} variant="result" />
      </BottomSheet>
    </div>
  );
}

/**
 * ค่าที่ผู้เล่นตั้งไว้ → layout ที่วาดได้จริง (ADR-063 ข้อ 3)
 *
 * `auto` = **แบบเดิมบนจอกว้าง** (เจ้าของสั่ง 2026-09-12) · จอแคบใช้เราเด่น เพราะสามคอลัมน์
 * บนมือถือกลายเป็นสามแผงเรียงลงมา คิวบ์เราเหลือหนึ่งในสามจอ (roadmap เฟส 12 ก้อนที่ 6)
 * · **บน-ล่างใช้ได้เฉพาะ 1v1** ห้องหลายคนตกไปใช้แบบเดิมโดยไม่แก้ค่าที่เก็บไว้
 * (ออกจากห้องหลายคนแล้วต้องได้ของเดิมคืน)
 */
function resolveLayout(pref: RoomLayout, wide: boolean, duel: boolean): ResolvedRoomLayout {
  const chosen = pref === 'auto' ? (wide ? 'classic' : 'focus') : pref;
  return chosen === 'stacked' && !duel ? 'classic' : chosen;
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
  /** สลับผู้เล่น ↔ ผู้ชม — ห้องที่มีรหัส · ก่อนเริ่ม/หลังจบรอบเท่านั้น (ADR-082) */
  onSwitchSeat: (to: Seat) => Promise<void>;
  onLeave: () => Promise<void>;
  /** ออกจากห้องแข่งขันแล้วเข้าคิวหาคู่ใหม่ทันที */
  onRequeue: () => Promise<void>;
  queueBusy: boolean;
  /**
   * - `column` — คอลัมน์ข้อมูลเต็มชุดของจอกว้าง (ค่าเดิม)
   * - `dock` — แผงล่างของจอแคบ: ข้อผิดพลาด + ปุ่มตามเฟส ไม่มีปุ่มออก (อยู่แถบหัว) · จบรอบมีปุ่ม "ดูผล" (ADR-083 ข้อ 5)
   * - `result` — เนื้อในแผ่นผลจบรอบของจอแคบ: แถวคะแนน + ปุ่มตามชนิดห้อง + ปุ่มออก
   */
  variant?: 'column' | 'dock' | 'result';
  /** เปิดแผ่นผลจบรอบอีกครั้ง — ใช้กับ `dock` */
  onShowResult?: () => void;
}

/** ห้องจากคิว (แข่งขัน 1v1 + หลายคนโหมด auto) — ตรงกับ `isQueueRoom()` ฝั่ง server */
function isQueueRoom(snapshot: RoomSnapshot): boolean {
  return (
    snapshot.roomKind === 'competitive' ||
    (snapshot.roomKind === 'multiplayer' && snapshot.roomMode === 'auto')
  );
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
  onSwitchSeat,
  onLeave,
  onRequeue,
  queueBusy,
  variant = 'column',
  onShowResult,
}: MatchPanelProps) {
  const { state } = snapshot;
  const inLobby = state === 'WAITING';
  const finished = state === 'FINISHED';
  const racing = state === 'SOLVING' || state === 'FINAL_COUNTDOWN';
  const inspecting = state === 'INSPECTION';
  /**
   * **ห้องที่มาจากคิว** (แข่งขัน 1v1 + หลายคนโหมด auto) เดินเองทั้งหมด — ไม่มี host
   * ไม่มีปุ่มเริ่ม ไม่มี "พร้อม" และเล่นซ้ำในห้องเดิมไม่ได้ เพราะสองห้องนี้ปรับคะแนนจริง
   * ถ้าเล่นซ้ำได้จะกลายเป็นช่องปั๊มคะแนน (`socket-events.md` ข้อ 4 · ADR-043 ข้อ 4)
   * — ตรงกับ `isQueueRoom()` ฝั่ง server เป๊ะ · `isHost` ของห้องพวกนี้ไม่มีความหมาย
   */
  const fromQueue = isQueueRoom(snapshot);

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
  /** สลับผู้เล่น ↔ ผู้ชมได้เฉพาะห้องที่มีรหัส ก่อนเริ่มหรือหลังจบรอบ — ตรงกับ `switchSeat()` ฝั่ง server (ADR-082 ข้อ 2) */
  const canSwitchSeat = !fromQueue && (inLobby || finished);

  const startButton = (
    <button
      type="button"
      disabled={!canStart}
      onClick={() => void match.start()}
      className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-navy-800 disabled:text-slate-500"
    >
      {startButtonLabel(isHost, finished, roomIsFull, everyoneConnected)}
    </button>
  );

  const error = match.actionError ?? roomError;

  const statusBlock = (
    <>
      <p className="text-xs text-slate-400">สถานะการเล่น</p>
      <p className="mt-1 text-2xl font-bold text-brand-400">{headline(snapshot, result)}</p>

      <MatchClockBlock snapshot={snapshot} progress={focusProgress} />
    </>
  );

  const alerts = (
    <>
      {match.desynced && racing && (
        <p
          className={`rounded-xl border border-loss/40 bg-loss/10 px-3 py-2 text-left text-xs leading-5 text-loss ${
            variant === 'dock' ? 'mb-2' : 'mt-4'
          }`}
        >
          {match.reloadedMidSolve
            ? 'รีเฟรชหน้าระหว่างรอบ — คิวบ์กลับไปที่ scramble แต่เซิร์ฟเวอร์ยังจำท่าที่หมุนไปแล้ว รอบนี้จึงแก้ต่อให้จบไม่ได้ กดยอมแพ้แล้วเริ่มรอบใหม่'
            : 'การหมุนของคุณกับเซิร์ฟเวอร์ไม่ตรงกันแล้ว — รอบนี้จะยืนยันผลไม่ได้ แนะนำให้กดยอมแพ้แล้วเริ่มรอบใหม่'}
        </p>
      )}

      {error && (
        <div className={`text-left ${variant === 'dock' ? 'mb-2' : 'mt-4'}`}>
          <FormAlert message={error} />
        </div>
      )}
    </>
  );

  const detailBlock = (
    <>
      <p className="mt-5 min-h-[3.5rem] text-sm leading-6 text-slate-400">
        {hintText(snapshot, roomIsFull, isSpectator, isHost, fromQueue)}
      </p>

      <ScrambleBox scramble={snapshot.scramble} />

      <EloRows snapshot={snapshot} result={result} />

      {alerts}
    </>
  );

  const leaveButton = (
    <button
      type="button"
      disabled={roomBusy}
      onClick={() => void onLeave()}
      className="rounded-xl border border-line bg-navy-800 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      ออกจากห้อง
    </button>
  );

  const actionBlock = (
    <div className={`flex flex-col gap-2.5 ${variant === 'column' ? 'mt-5' : ''}`}>
      {isSpectator ? (
        <>
          <p className="rounded-xl border border-line-soft bg-navy-900/60 px-4 py-2.5 text-sm text-slate-400">
            {isHost ? 'คุณเป็นหัวห้อง · กำลังดูอยู่ในฐานะผู้ชม' : 'คุณกำลังดูอยู่ในฐานะผู้ชม'}
          </p>
          {canSwitchSeat && (
            // หัวห้องที่นั่งเป็นผู้ชมยังกดเริ่มได้ (ADR-082 ข้อ 3)
            <div className={`grid gap-2.5 ${isHost ? 'grid-cols-2' : ''}`}>
              <button
                type="button"
                disabled={roomBusy || roomIsFull}
                onClick={() => void onSwitchSeat('player')}
                className="rounded-xl bg-win/90 px-4 py-2.5 text-sm font-semibold text-navy-950 transition hover:bg-win disabled:cursor-not-allowed disabled:bg-navy-800 disabled:text-slate-500"
              >
                {roomIsFull ? 'ผู้เล่นเต็มแล้ว' : 'เข้าร่วมเป็นผู้เล่น'}
              </button>
              {isHost && startButton}
            </div>
          )}
        </>
      ) : (
        <>
          {inspecting ? (
            // ปุ่มพร้อมช่วงตรวจสอบ — ทุกห้องเหมือนกัน ทั้งห้องจากคิวและห้องสร้างเอง (ADR-078)
            <InspectionReadyControl
              snapshot={snapshot}
              me={me}
              busy={match.busy}
              onToggle={match.setInspectionReady}
            />
          ) : fromQueue ? (
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
                startButton
              )}
            </div>
          )}

          {canSwitchSeat && (
            <button
              type="button"
              disabled={roomBusy}
              onClick={() => void onSwitchSeat('spectator')}
              className="rounded-xl border border-line bg-navy-850 px-4 py-2 text-sm text-slate-300 transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ย้ายไปเป็นผู้ชม
            </button>
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

      {/* จอแคบ: แผงล่างไม่มีปุ่มออก (อยู่แถบหัวห้อง) · จบรอบแล้วเปิดแผ่นผลซ้ำได้ */}
      {variant === 'dock'
        ? finished &&
          onShowResult && (
            <button
              type="button"
              onClick={onShowResult}
              className="rounded-xl border border-brand-500/60 bg-navy-800 px-4 py-2.5 text-sm font-semibold text-brand-300 transition hover:bg-navy-700"
            >
              ดูผลรอบนี้
            </button>
          )
        : leaveButton}
    </div>
  );

  if (variant === 'dock') {
    return (
      <section className="shrink-0 rounded-2xl border border-line bg-navy-850 px-3 py-2.5 text-center">
        {alerts}
        {actionBlock}
      </section>
    );
  }

  if (variant === 'result') {
    return (
      <div className="flex flex-col gap-4">
        <EloRows snapshot={snapshot} result={result} className="" showTimes />
        {actionBlock}
      </div>
    );
  }

  const roomFacts = (
    <dl className="mt-5 space-y-1.5 text-left text-sm">
      <Row label="ประเภทรูบิค" value={CUBE_TYPE_LABEL[snapshot.cubeType]} />
      {/* หัวห้องที่นั่งเป็นผู้ชมไม่มีแผงผู้เล่นให้ติดป้าย — บอกชื่อไว้ที่นี่ (ADR-082 ข้อ 6) */}
      {!fromQueue && snapshot.host && (
        <Row
          label="หัวห้อง"
          value={`${playerName(snapshot.host)}${snapshot.host.seat === 'spectator' ? ' (ผู้ชม)' : ''}`}
        />
      )}
      <Row label="ผู้เล่น" value={`${snapshot.players.length}/${snapshot.maxPlayers} คน`} />
      {/* ห้องจากคิวไม่มีรหัสให้ผู้ชมเข้า (game-rules.md ข้อ 9 · ADR-079) — โชว์ "0 คน" ชวนเข้าใจผิด */}
      {!fromQueue && <Row label="ผู้ชม" value={`${snapshot.spectatorCount} คน`} />}
    </dl>
  );

  return (
    <section className="rounded-2xl border border-line bg-navy-850 px-5 py-6 text-center">
      {statusBlock}
      {detailBlock}
      {actionBlock}
      {roomFacts}
    </section>
  );
}

/** ตัวเลขเวลาก้อนใหญ่ตรงกลาง + บรรทัดนับถอยหลัง 10 วินาทีตอนมีคนแก้เสร็จแล้ว */
function MatchClockBlock({
  snapshot,
  progress,
  compact = false,
}: {
  snapshot: RoomSnapshot;
  progress: PlayerProgress | null;
  /** จอแคบ — ตัวเลขเล็กลงและไม่มีระยะห่างด้านบน (ADR-083 ข้อ 5) */
  compact?: boolean;
}) {
  const { state, phaseEndsAtTs, serverStartTs } = snapshot;
  const counting = state === 'COUNTDOWN' || state === 'INSPECTION';
  const readyToStart = state === 'INSPECTION' && isInspectionLocked(snapshot);

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
    ? state === 'COUNTDOWN' || readyToStart
      ? 'เริ่มใน (วินาที)'
      : 'เวลาตรวจสอบ (วินาที)'
    : 'เวลา';

  return (
    <div className={compact ? '' : 'mt-6'}>
      <p className={`text-slate-400 ${compact ? 'text-[11px]' : 'text-xs'}`}>{label}</p>
      <LiveTime
        mode={mode}
        ts={ts}
        frozenMs={frozenMs}
        className={`tabular block font-bold ${compact ? 'text-4xl leading-tight' : 'text-5xl'} ${
          counting
            ? 'text-gold-400'
            : mode === 'frozen' && frozenMs === null
              ? 'text-loss'
              : 'text-white'
        }`}
      />
      {state === 'FINAL_COUNTDOWN' && phaseEndsAtTs !== null && (
        <p className={`font-semibold text-loss ${compact ? 'text-xs' : 'mt-2 text-sm'}`}>
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
function EloRows({
  snapshot,
  result,
  className = 'mt-5',
  showTimes = false,
}: {
  snapshot: RoomSnapshot;
  result: MatchResult | null;
  /** ระยะห่างด้านบน — คอลัมน์จอกว้าง `mt-5` · แผ่นผลจอแคบส่ง `''` */
  className?: string;
  /**
   * เวลาของแต่ละคนหน้าคะแนน — แผ่นผลจอแคบ (ADR-083 ข้อ 5) · จอกว้างไม่ต้อง เพราะเวลาอยู่ในแผงคิวบ์ทุกช่องแล้ว
   * แต่จอแคบคู่แข่งเป็น PiP ย่อได้ ต้องบอกในแผ่นผลเอง
   */
  showTimes?: boolean;
}) {
  // ห้องสร้างเองไม่ปรับคะแนนเลย (CLAUDE.md ข้อ 7) — ห้องแข่งขัน + หลายคนโหมด auto ปรับจริง
  const ratingApplied = result ? result.ratingApplied : isQueueRoom(snapshot);

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
    <dl className={`space-y-1.5 text-left text-sm ${className}`}>
      {rows.map(({ userId, entry, name }) => {
        const change = entry?.eloChange ?? null;
        return (
          <div key={userId} className="flex items-center justify-between gap-3">
            <dt className="truncate text-slate-500">
              {showRank && entry && (
                <span className="tabular mr-1.5 text-slate-400">#{entry.rankNo}</span>
              )}
              {playerName(name)}
              {/* แผ่นผลจอแคบมีเวลาคั่นก่อนคะแนน — "ได้แต้ม 0:20.01" อ่านผิดความหมาย */}
              {!showTimes && ' ได้แต้ม'}
            </dt>
            <dd className="flex shrink-0 items-center gap-2">
              {showTimes && entry && (
                <span
                  className={`tabular mr-1 ${entry.solveTimeMs === null ? 'text-loss' : 'text-slate-200'}`}
                >
                  {entry.solveTimeMs === null
                    ? 'DNF'
                    : formatSolveTime(toSolveSeconds(entry.solveTimeMs))}
                </span>
              )}
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
/**
 * ผู้เล่นทุกคนกดพร้อมครบ = ล็อกแล้ว กำลังนับ 3 วินาทีสุดท้าย (ADR-078 ข้อ 4)
 * ค่าพร้อมไม่ถูกล้างหลังล็อกแม้มีคนหลุด จึงเช็กจาก snapshot ตรง ๆ ได้ ไม่ต้องมีฟิลด์ล็อกแยก
 */
function isInspectionLocked(snapshot: RoomSnapshot): boolean {
  return snapshot.players.length > 0 && snapshot.players.every((player) => player.inspectionReady);
}

/**
 * ปุ่ม "พร้อม" ช่วง inspection + ตัวนับว่าพร้อมกี่คนแล้ว (ADR-078 · game-rules.md ข้อ 2)
 *
 * ยกเลิกได้จนกว่าจะครบ · ครบแล้วแทนปุ่มด้วยป้าย เพราะ server ไม่รับการยกเลิกหลังล็อก
 */
function InspectionReadyControl({
  snapshot,
  me,
  busy,
  onToggle,
}: {
  snapshot: RoomSnapshot;
  me: PlayerPublic | null;
  busy: boolean;
  onToggle: (ready: boolean) => Promise<void>;
}) {
  const total = snapshot.players.length;
  const readyCount = snapshot.players.filter((player) => player.inspectionReady).length;

  if (isInspectionLocked(snapshot)) {
    return (
      <p className="rounded-xl border border-win/40 bg-win/10 px-4 py-2.5 text-sm font-semibold text-win">
        พร้อมครบทุกคน · กำลังเริ่ม
      </p>
    );
  }

  const mine = me?.inspectionReady ?? false;
  return (
    <div className="grid gap-1.5">
      <button
        type="button"
        disabled={busy || !me}
        onClick={() => void onToggle(!mine)}
        className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
          mine
            ? 'border border-line bg-navy-800 text-slate-200 hover:bg-navy-700'
            : 'bg-win/90 text-navy-950 hover:bg-win'
        }`}
      >
        {mine ? 'ยกเลิกพร้อม' : 'พร้อม'}
      </button>
      <p className="text-xs text-slate-500">
        พร้อมแล้ว {readyCount}/{total} คน · ต้องพร้อมครบทุกคนจึงจะเริ่มก่อนเวลา
      </p>
    </div>
  );
}

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
  isHost: boolean,
  fromQueue: boolean,
): string {
  const many = snapshot.maxPlayers > 2;
  switch (snapshot.state) {
    case 'WAITING':
      if (isSpectator && isHost) {
        return roomIsFull
          ? 'ผู้เล่นครบแล้ว · คุณเป็นหัวห้อง กดเริ่มการแข่งขันได้เลยโดยไม่ต้องลงเล่น'
          : `รอผู้เล่นอีก ${snapshot.maxPlayers - snapshot.players.length} คน · คุณเป็นหัวห้องที่นั่งดูอยู่ กดเริ่มได้เมื่อผู้เล่นครบ`;
      }
      if (isSpectator) return 'กำลังรอหัวห้องเริ่มการแข่งขัน';
      return roomIsFull
        ? 'ผู้เล่นครบแล้ว รอหัวห้องกดเริ่มการแข่งขัน'
        : `รอผู้เล่นอีก ${snapshot.maxPlayers - snapshot.players.length} คน · ส่งรหัสห้องด้านบนให้เพื่อนกด “ใส่เลขห้อง”`;
    case 'MATCHED':
      // ตั้งแต่ ADR-077 ไม่มีหน่วง 2 วินาทีแล้ว (เห็นคู่แข่งไปตั้งแต่หน้ายืนยัน) —
      // state นี้ผ่านแวบเดียว ข้อความจึงต้องไม่สัญญาเวลาที่ไม่มีอยู่จริง
      return many
        ? `รวมกลุ่มได้ ${snapshot.players.length} คนแล้ว · กำลังเริ่มให้`
        : 'ยืนยันครบทั้งสองฝ่ายแล้ว · กำลังเริ่มให้';
    case 'LOADING':
      return 'กำลังโหลดคิวบ์ให้ทุกคน · เริ่มพร้อมกันเมื่อทุกเครื่องพร้อม';
    case 'COUNTDOWN':
      return 'เตรียมตัว — อีกไม่กี่วินาทีจะเข้าช่วงตรวจสอบ';
    case 'INSPECTION':
      return isInspectionLocked(snapshot)
        ? 'ทุกคนพร้อมแล้ว · เริ่มจับเวลาพร้อมกันเมื่อนับถอยหลังจบ'
        : 'พลิกดูคิวบ์ได้ แต่หมุนหน้าคิวบ์ไม่ได้ · ครบ 15 วินาที หรือทุกคนกด “พร้อม” ครบ แล้วเริ่มจับเวลาพร้อมกันทุกคน';
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

function RoomCodeButton({
  roomCode,
  compact = false,
}: {
  roomCode: string | null;
  /** แถบหัวห้องของจอแคบ — ตัวเลขเล็กลง มีกรอบให้รู้ว่ากดได้ */
  compact?: boolean;
}) {
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
      className={`tabular font-bold tracking-widest text-brand-400 transition hover:text-brand-300 ${
        compact
          ? 'shrink-0 rounded-lg border border-dashed border-line px-2 py-1.5 text-sm'
          : 'text-2xl'
      }`}
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
