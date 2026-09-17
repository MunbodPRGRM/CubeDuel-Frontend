import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Avatar } from '@/components/Avatar';
import { CubeCanvas, type CubeCanvasHandle } from '@/components/CubeCanvas';
import type { CubeMoveEvent, CubeState } from '@/cube';
import { SOLVE_STATUS_LABEL } from '@/socket/room-labels';
import {
  isCameraRelayState,
  playerName,
  type OpponentCameraPayload,
  type PlayerPublic,
  type RoomSnapshot,
  type SolveStatus,
} from '@/socket/types';
import type { UseMatchResult } from '@/socket/useMatch';
import { useSocket } from '@/socket/useSocket';
import { LiveTime, type LiveTimeMode } from './LiveTime';

/**
 * ช่องคิวบ์ของผู้เล่นหนึ่งคน (ซ้าย/ขวาตามภาพ `design/Match - Playing.png`)
 *
 * ช่องของ **เรา** คือคิวบ์ที่หมุนได้จริงและเป็นตัวยิง `solve:move` / `solve:solved`
 * ช่องของ **คู่แข่ง** เป็นภาพสะท้อนที่เดินตาม `opponent:move` เท่านั้น หมุนเองไม่ได้
 *
 * ห้อง 3–4 คนใช้แผงตัวเดียวกันนี้ในโหมด `compact` สำหรับแถบคู่แข่ง (ADR-044 ข้อ 3)
 * · แผงคู่แข่งที่ลอยมุมจอบนมือถือใช้โหมด `pip` (ADR-081)
 */

/**
 * หน้าตาของแผง
 * - `full` — หัวแผง + คิวบ์ + แถวตัวเลขล่าง (คิวบ์ของเราทุกห้อง · คู่แข่งห้อง 1v1 ที่ไม่ลอยมุมจอ)
 * - `compact` — ย้ายแถวตัวเลขล่างขึ้นไปบนหัวแผง (แถบคู่แข่งห้อง 3–4 คน · `focus` บนจอ `lg`)
 * - `pip` — คิวบ์เต็มกล่อง ข้อมูลเป็นป้ายทับ (`focus` บนจอแคบ · ADR-081 ข้อ 1)
 */
export type PlayerPanelVariant = 'full' | 'compact' | 'pip';

interface PlayerCubePanelProps {
  player: PlayerPublic | null;
  snapshot: RoomSnapshot;
  /** ช่องนี้เป็นของเราเองหรือไม่ — ผู้ชมได้ `false` ทุกช่อง */
  isMe: boolean;
  emptyLabel: string;
  match: UseMatchResult;
  /**
   * `compact` = แผงย่อสำหรับแถบคู่แข่งของห้อง 3–4 คน — **ย้ายแถวตัวเลขล่างขึ้นไปอยู่บนหัวแผง**
   * เพราะคิวบ์หลายลูกซ้อนในคอลัมน์เดียวเหลือความสูงลูกละ ~1/3 ถ้าคงแถวล่างไว้ด้วย
   * จะไม่เหลือที่ให้คิวบ์เลย · ห้อง 1v1 ที่ไม่ลอยมุมจอต้องเป็น `full` (หน้าตาต้องเหมือนเดิมเป๊ะ)
   *
   * `pip` = กล่อง ~150 px บนมือถือ ที่หัวแผงอย่างเดียวก็กินไปครึ่งกล่องแล้ว (ADR-081)
   */
  variant?: PlayerPanelVariant;
  /** แผง `pip` ถูกย่อเหลือชิป (ADR-081 ข้อ 2) — ใช้กับ `pip` เท่านั้น */
  collapsed?: boolean;
  /** ของที่วาดทับกรอบคิวบ์ — ตอนนี้คือ `PipDock` ของคู่แข่งบนจอแคบ (ADR-081 ข้อ 2) · ใช้กับ `full` เท่านั้น */
  overlay?: ReactNode;
}

/** state ที่คิวบ์หมุนได้จริง — ตรงกับฝั่ง server (`match.ts`) */
function isSolvingState(state: RoomSnapshot['state']): boolean {
  return state === 'SOLVING' || state === 'FINAL_COUNTDOWN';
}

export function PlayerCubePanel({
  player,
  snapshot,
  isMe,
  emptyLabel,
  match,
  variant = 'full',
  collapsed = false,
  overlay,
}: PlayerCubePanelProps) {
  const compact = variant === 'compact';
  const pip = variant === 'pip';
  const progress = player ? snapshot.progress.find((p) => p.userId === player.userId) : undefined;
  const inLobby = snapshot.state === 'WAITING';
  /** ช่วงตรวจสอบบอกว่าใครกด "พร้อม" แล้ว (ADR-078) — ยังไม่มีใครแก้ ป้าย "กำลังแก้" ไม่มีความหมาย */
  const inspecting = snapshot.state === 'INSPECTION' && progress?.status === 'solving';
  /** จำนวน move ที่นับได้ทันทีฝั่งเรา — ของ server มาทุก 500 ms ซึ่งช้าเกินกว่าจะดูลื่น */
  const [liveMoveCount, setLiveMoveCount] = useState(0);

  useEffect(() => {
    setLiveMoveCount(0);
  }, [snapshot.scramble]);

  const moveCount = Math.max(progress?.moveCount ?? 0, liveMoveCount);

  const statusText = !player
    ? '—'
    : inLobby
      ? player.isReady
        ? 'พร้อม'
        : 'ไม่พร้อม'
      : inspecting
        ? player.inspectionReady
          ? 'พร้อมแล้ว'
          : 'กำลังตรวจสอบ'
        : SOLVE_STATUS_LABEL[progress?.status ?? 'solving'];

  const statusClass = !player
    ? 'text-slate-600'
    : inLobby
      ? player.isReady
        ? 'text-win'
        : 'text-loss'
      : inspecting
        ? player.inspectionReady
          ? 'text-win'
          : 'text-slate-200'
        : progress?.status === 'solved'
          ? 'text-win'
          : progress?.status === 'solving'
            ? 'text-slate-200'
            : 'text-loss';

  // จบรอบไปแล้วให้ค้างเลขไว้ · ยังแก้อยู่และนาฬิกาเดินแล้วให้นับขึ้น · นอกนั้นเป็น 0
  let timeMode: LiveTimeMode = 'idle';
  let frozenMs: number | null = null;
  if (progress && progress.status !== 'solving') {
    timeMode = 'frozen';
    frozenMs = progress.solveTimeMs;
  } else if (progress && isSolvingState(snapshot.state) && snapshot.serverStartTs !== null) {
    timeMode = 'elapsed';
  }

  const liveTime = (
    <LiveTime
      mode={timeMode}
      ts={snapshot.serverStartTs}
      frozenMs={frozenMs}
      className={`tabular text-brand-400 ${pip ? 'text-[10px]' : compact ? 'text-sm' : 'text-lg'}`}
    />
  );

  const cube = player ? (
    isMe ? (
      <SelfCube
        snapshot={snapshot}
        match={match}
        status={progress?.status}
        canTurn={
          snapshot.state === 'WAITING' ||
          (isSolvingState(snapshot.state) && progress?.status === 'solving')
        }
        onMoveCount={setLiveMoveCount}
      />
    ) : (
      <MirrorCube
        snapshot={snapshot}
        userId={player.userId}
        status={progress?.status}
        serverMoveCount={progress?.moveCount ?? 0}
        pip={pip}
      />
    )
  ) : null;

  if (pip) {
    if (!player) {
      return (
        <section
          className={`grid place-items-center border border-dashed border-line bg-navy-900/85 text-slate-500 ${
            collapsed
              ? 'rounded-full px-2 py-1 text-[10px]'
              : 'h-full w-full rounded-xl text-[11px]'
          }`}
        >
          รอผู้เล่น
        </section>
      );
    }
    const badge = pipBadge(player, snapshot.state, progress?.status, inspecting);
    const border =
      badge?.tone === 'win' ? 'border-win' : badge?.tone === 'loss' ? 'border-loss' : 'border-line';

    /*
      ⚠️ กล่องห่อคิวบ์ต้องเป็น **ลูกตัวแรกเสมอทั้งตอนกางและตอนย่อ** — React จะได้เก็บ `CubeCanvas` ตัวเดิมไว้
      ย่อแล้วแค่ซ่อน (`invisible`) ไม่ unmount เพราะ move ที่พลาดไประหว่างย่อเอาคืนไม่ได้ (ADR-081 ข้อ 2)
    */
    if (collapsed) {
      return (
        <section
          aria-label={`${playerName(player)} · ${statusText}`}
          className={`relative flex max-w-[11rem] items-center gap-1.5 rounded-full border-2 bg-navy-900/95 px-2 py-1 text-[10px] leading-3 shadow-lg shadow-black/40 ${border}`}
        >
          <div className="invisible absolute h-24 w-24">{cube}</div>
          <span className="min-w-0 truncate font-medium text-slate-100">{playerName(player)}</span>
          {/* ช่องเวลาของคน DNF ขึ้นคำว่า DNF อยู่แล้ว — ป้ายซ้ำในชิปแคบ ๆ อ่านเป็น "DNF DNF" */}
          {badge && badge.label !== 'DNF' && (
            <span
              className={`shrink-0 font-medium ${badge.tone === 'win' ? 'text-win' : 'text-loss'}`}
            >
              {badge.label}
            </span>
          )}
          <span className="shrink-0">{liveTime}</span>
        </section>
      );
    }

    return (
      // ขอบสีบอกสถานะ + ป้ายคำเสมอ — สีอย่างเดียวคนตาบอดสีแยกไม่ออก (ADR-081 ข้อ 1)
      <section
        aria-label={`${playerName(player)} · ${statusText}`}
        className={`@container relative h-full w-full overflow-hidden rounded-xl border-2 bg-navy-900/90 shadow-lg shadow-black/40 ${border}`}
      >
        <div className="contents">{cube}</div>
        {badge && (
          <span
            className={`pointer-events-none absolute left-1.5 top-1.5 rounded bg-navy-900/85 px-1.5 py-0.5 text-[10px] font-medium leading-3 ${
              badge.tone === 'win' ? 'text-win' : 'text-loss'
            }`}
          >
            {badge.label}
          </span>
        )}
        {/*
          กล่องกว้างตั้งแต่ 7rem (ห้อง 1v1 / 3 คน): ชื่อบรรทัดหนึ่ง เวลา + จำนวนท่าบรรทัดสอง
          กล่องแคบกว่านั้น (ห้อง 4 คนบนจอ ~360 px เหลือ ~90 px): **บรรทัดเดียว** ชื่อ + เวลา ตัดจำนวนท่า
          ไม่งั้นป้ายสองบรรทัดกินไปหนึ่งในสามของกล่อง · ใช้ container query เพราะขนาดกล่องไม่ผูกกับจอ
        */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-baseline gap-x-1 bg-navy-900/80 px-1.5 py-0.5 text-[10px] leading-3 backdrop-blur @min-[7rem]:px-2 @min-[7rem]:py-1">
          <span className="min-w-0 flex-1 truncate font-medium text-slate-100 @min-[7rem]:basis-full">
            {playerName(player)}
          </span>
          <span className="shrink-0 text-slate-400">
            {liveTime}
            <span className="hidden @min-[7rem]:inline">
              {' '}
              · <span className="tabular">{moveCount}</span> ท่า
            </span>
          </span>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`flex flex-col rounded-2xl border border-line bg-navy-850/60 ${
        // แผงย่อไม่ล็อกความสูงเอง — ปล่อยให้คอลัมน์แม่หารความสูงให้เท่า ๆ กัน
        // แผงเต็มบนจอ `lg` สูงเท่าแถวของ grid ที่ล็อกไว้เท่าจอแล้ว (ADR-059 ข้อ 3)
        compact ? 'min-h-0 flex-1 p-3' : 'h-[30rem] p-4 lg:h-full lg:min-h-0'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        {player ? (
          <>
            <div className="flex min-w-0 items-center gap-2">
              <Avatar name={playerName(player)} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-100">{playerName(player)}</p>
                <p className="text-[11px] text-slate-500">
                  {/* ห้องแข่งขันไม่มี host จริง ๆ — `isHost` ใน snapshot ของห้องนั้นไม่มีความหมาย
                      (socket-events.md ข้อ 4) จึงห้ามเอามาแสดง */}
                  {snapshot.roomKind !== 'competitive' && player.isHost ? 'หัวห้อง' : 'ผู้เล่น'} ·{' '}
                  {player.eloRating} ELO
                </p>
              </div>
            </div>
            {/* แผงย่อไม่มีแถวตัวเลขด้านล่าง จึงย้ายตัวเลขที่ต้องเห็นตลอดมาไว้บนหัวแทน */}
            {compact && (
              <div className="shrink-0 text-right">
                <p className={`text-[11px] ${statusClass}`}>{statusText}</p>
                <p className="text-[11px] text-slate-500">
                  {liveTime} · <span className="tabular">{moveCount}</span> ท่า
                </p>
              </div>
            )}
            {!player.connected && (
              <span className="shrink-0 rounded-lg border border-loss/40 bg-loss/10 px-2 py-1 text-[11px] text-loss">
                {compact ? 'หลุด' : 'หลุดการเชื่อมต่อ'}
              </span>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-600">{emptyLabel}</p>
        )}
      </div>

      {/*
        `min-h-0` สำคัญมาก: ถ้าไม่ใส่ กล่อง flex จะยอมให้ลูกดันความสูงได้ไม่จำกัด แล้ว
        canvas (ที่ renderer ตั้งขนาดตามกล่อง) จะดันกล่องให้สูงขึ้นเรื่อย ๆ ทุกเฟรม
        ด้วยเหตุผลเดียวกัน `CubeCanvas` ข้างในต้องถูกวางแบบ absolute — ดู `SelfCube`
      */}
      <div className="relative mt-3 min-h-0 flex-1 overflow-hidden rounded-xl bg-navy-900/40">
        {cube ?? (
          <div className="grid h-full place-items-center text-sm text-slate-600">{emptyLabel}</div>
        )}
        {overlay}
      </div>

      {!compact && (
        <div className="mt-3 grid grid-cols-3 items-end gap-2 rounded-xl border border-line-soft bg-navy-900/60 px-4 py-3">
          <div>
            <p className="text-[10px] tracking-[0.15em] text-slate-500">MOVES</p>
            <p className="tabular text-lg text-slate-200">{moveCount}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-500">สถานะ</p>
            <p className={`text-sm ${statusClass}`}>{statusText}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-500">เวลา</p>
            {liveTime}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * ป้ายสั้นมุมซ้ายบนของแผง `pip` — ยังแก้อยู่/ยังไม่พร้อม = ไม่มีป้าย (ขอบเทาเฉย ๆ)
 * หลุดการเชื่อมต่อมาก่อนทุกอย่าง เพราะเป็นเรื่องที่คนดูต้องรู้ตอนนี้ และอาจกลับมาได้เอง
 */
function pipBadge(
  player: PlayerPublic,
  state: RoomSnapshot['state'],
  status: SolveStatus | undefined,
  inspecting: boolean,
): { label: string; tone: 'win' | 'loss' } | null {
  if (!player.connected) return { label: 'หลุด', tone: 'loss' };
  if (state === 'WAITING') return player.isReady ? { label: 'พร้อม', tone: 'win' } : null;
  if (inspecting) return player.inspectionReady ? { label: 'พร้อม', tone: 'win' } : null;
  if (status === 'solved') return { label: 'เสร็จ', tone: 'win' };
  if (status === 'dnf') return { label: 'DNF', tone: 'loss' };
  if (status === 'surrendered') return { label: 'ยอมแพ้', tone: 'loss' };
  return null;
}

/**
 * server บอกว่าคนนี้ **แก้เสร็จแล้ว** แต่ภาพคิวบ์ยังไม่ครบสี → เล่นอนิเมชันแก้ให้ดู
 *
 * ทางปกติไม่เข้าเงื่อนไขนี้เลย — ท่าสุดท้ายลงบัญชีของคิวบ์ก่อน server ตัดสินเสมอ
 * ที่เข้าได้คือปุ่ม "เสร็จทันที (ทดสอบ)" ที่ server ตัดสินโดยไม่มี move (ADR-060 ข้อ 5)
 * · ท่าที่ `solve()` เล่นเป็น `source: 'program'` ซึ่ง `sendMove` ทิ้งอยู่แล้ว ไม่หลุดขึ้น server
 */
function useSolveWhenServerSaysSolved(
  cubeRef: { current: CubeCanvasHandle | null },
  status: SolveStatus | undefined,
): void {
  useEffect(() => {
    if (status !== 'solved') return;
    const cube = cubeRef.current;
    if (cube?.getState()?.solved === false) void cube.solve();
  }, [cubeRef, status]);
}

// ---------------------------------------------------------------- คิวบ์ของเราเอง

interface SelfCubeProps {
  snapshot: RoomSnapshot;
  match: UseMatchResult;
  /** สถานะรอบนี้ของเราตาม server — ใช้กับ `useSolveWhenServerSaysSolved` */
  status: SolveStatus | undefined;
  canTurn: boolean;
  onMoveCount: (count: number) => void;
}

/**
 * คิวบ์ที่ผู้เล่นหมุนเอง — ต้นทางของ `solve:move` และ `solve:solved`
 *
 * ⚠️ ห้ามส่ง `animateScramble` เด็ดขาด (ADR-032 ข้อ 1) ห้องแข่งต้องได้ scramble ทันที
 * ไม่งั้นเครื่องเร็วจะเห็นลูกที่พร้อมแก้ก่อนเครื่องช้า
 */
function SelfCube({ snapshot, match, status, canTurn, onMoveCount }: SelfCubeProps) {
  const cubeRef = useRef<CubeCanvasHandle>(null);
  const { sendMove, reportSolved, reportCubeReady, sendCamera } = match;
  useSolveWhenServerSaysSolved(cubeRef, status);

  // เข้า INSPECTION = คู่แข่งเริ่มตามมุมกล้องเรา → ส่งท่าปัจจุบันไปหนึ่งครั้งแม้ยังไม่ได้ขยับ
  // (ช่วง LOADING/COUNTDOWN อาจหมุนไว้แล้วแต่ยังไม่ถึงช่วงที่ส่ง — ADR-062 ข้อ 3)
  useEffect(() => {
    if (snapshot.state !== 'INSPECTION') return;
    const pose = cubeRef.current?.getCameraPose();
    if (pose) sendCamera(pose);
  }, [snapshot.state, sendCamera]);

  /**
   * เข้ารอบใหม่ → ล้างบัญชี move ของคิวบ์ให้แน่ใจว่า `seq` เริ่มที่ 1 ตรงกับ server
   *
   * ปกติ `setScramble` ของ `CubeCanvas` ล้างให้อยู่แล้ว แต่ effect ตัวนั้นดูที่ **ค่าของ
   * scramble** ถ้ารอบใหม่สุ่มได้ชุดเดิมเป๊ะ (หรือผู้เล่นหมุนเล่นตอนรออยู่ในล็อบบี้)
   * มันจะไม่ทำงาน แล้ว `seq` จะเหลื่อมกับ server ทั้งรอบโดยกู้ไม่ได้
   */
  useEffect(() => {
    if (snapshot.state !== 'LOADING') return;
    cubeRef.current?.reset();
    onMoveCount(0);
  }, [snapshot.state, onMoveCount]);

  const handleMove = useCallback(
    (event: CubeMoveEvent) => {
      if (event.source !== 'player') return;
      onMoveCount(event.seq);
      sendMove(event);
    },
    [sendMove, onMoveCount],
  );

  /**
   * แก้ครบทุกหน้าแล้ว → แจ้ง server ทันที **ไม่ต้องรอผู้เล่นกดอะไร**
   *
   * เวลาที่ได้เป็นของ server (`solveTimeMs` ใน ack) ตัวเลขบนจอเป็นแค่ภาพ
   */
  const handleState = useCallback(
    (state: CubeState) => {
      if (state.solved) reportSolved(state.moves.length);
    },
    [reportSolved],
  );

  const handleScrambleApplied = useCallback(() => reportCubeReady(), [reportCubeReady]);

  return (
    // absolute เพื่อไม่ให้ canvas มีส่วนกำหนดความสูงของกล่องแม่ (ดูหมายเหตุที่กล่องคิวบ์)
    <div className="absolute inset-0">
      <CubeCanvas
        ref={cubeRef}
        cubeType={snapshot.cubeType}
        scramble={snapshot.scramble}
        turnsEnabled={canTurn}
        onMove={handleMove}
        onState={handleState}
        onScrambleApplied={handleScrambleApplied}
        onCameraChange={sendCamera}
      />
    </div>
  );
}

// ---------------------------------------------------------------- คิวบ์ของคู่แข่ง

interface MirrorCubeProps {
  snapshot: RoomSnapshot;
  userId: number;
  /** สถานะรอบนี้ของคนนี้ตาม server — ใช้กับ `useSolveWhenServerSaysSolved` */
  status: SolveStatus | undefined;
  /** จำนวน move ที่ server บอกว่าคนนี้หมุนไปแล้ว — ใช้จับว่าภาพของเราตกหล่นหรือยัง */
  serverMoveCount: number;
  /** อยู่ในกล่อง PiP — ป้ายสองตัวข้างล่างต้องย่อ ไม่งั้นบังคิวบ์ทั้งลูก (ADR-081 ข้อ 1) */
  pip: boolean;
}

/**
 * คิวบ์ของคู่แข่ง — เดินตาม `opponent:move` ที่ server broadcast มาทีละท่า
 *
 * **ข้อจำกัดที่ยอมรับ (ADR-037 ข้อ 4):** ถ้าเราเข้ามากลางรอบ (กด F5 / เน็ตหลุดแล้วกลับมา /
 * ผู้ชมเข้าระหว่างแข่ง) จะไม่มีทางรู้ move ที่คู่แข่งหมุนไปก่อนหน้า — snapshot มีแต่ตัวเลข
 * `moveCount` ไม่มี move stream ภาพจึงค้างอยู่ที่ scramble ต้องบอกผู้ใช้ตรง ๆ ว่าไม่ครบ
 */
function MirrorCube({ snapshot, userId, status, serverMoveCount, pip }: MirrorCubeProps) {
  const { socket } = useSocket();
  const cubeRef = useRef<CubeCanvasHandle>(null);
  useSolveWhenServerSaysSolved(cubeRef, status);
  /** จำนวนท่าที่เราสะท้อนสำเร็จในรอบนี้ */
  const mirroredRef = useRef(0);
  const [incomplete, setIncomplete] = useState(false);
  const serverMoveCountRef = useRef(serverMoveCount);
  serverMoveCountRef.current = serverMoveCount;

  // รอบใหม่ (scramble เปลี่ยน) = เริ่มนับใหม่ · ถ้าตอนเริ่มดู server บอกว่าเขาหมุนไปแล้ว
  // แปลว่าเราพลาดของเก่าไปแล้วตั้งแต่ต้น ภาพจะไม่มีวันตรง
  useEffect(() => {
    mirroredRef.current = 0;
    setIncomplete(serverMoveCountRef.current > 0);
  }, [snapshot.scramble]);

  useEffect(() => {
    if (!socket) return;

    const onMove = (payload: { userId: number; seq: number; move: string }) => {
      if (payload.userId !== userId) return;
      // ท่าที่ข้ามลำดับ = เราพลาดของก่อนหน้าไป ลงต่อไปก็ยิ่งเพี้ยน
      if (payload.seq !== mirroredRef.current + 1) {
        setIncomplete(true);
        return;
      }
      if (cubeRef.current?.applyMove(payload.move)) mirroredRef.current = payload.seq;
      else setIncomplete(true);
    };

    socket.on('opponent:move', onMove);
    return () => {
      socket.off('opponent:move', onMove);
    };
  }, [socket, userId]);

  /**
   * มุมกล้องของคนนี้ (ADR-062) — ตามบังคับตลอดช่วงที่ server ส่งต่อ แล้วคืนการคุมกล้องให้เรา
   * `tracking` = ได้ท่าของเขามาแล้วในช่วงนี้ ใช้โชว์ป้ายบอกว่าทำไมลากกล้องเองไม่ได้
   */
  const [tracking, setTracking] = useState(false);
  useEffect(() => {
    if (!socket) return;
    const onCamera = (payload: OpponentCameraPayload) => {
      if (payload.userId !== userId) return;
      cubeRef.current?.followCamera({ quaternion: payload.q, distance: payload.d });
      setTracking(true);
    };
    socket.on('opponent:camera', onCamera);
    return () => {
      socket.off('opponent:camera', onCamera);
    };
  }, [socket, userId]);

  const relaying = isCameraRelayState(snapshot.state);
  useEffect(() => {
    if (relaying) return;
    cubeRef.current?.stopFollowingCamera();
    setTracking(false);
  }, [relaying]);

  return (
    <>
      {/* PiP: คิวบ์ไม่รับนิ้ว — นิ้วที่แตะกล่องคือการลากกล่องเสมอ (ADR-081 ข้อ 2) */}
      <div className={`absolute inset-0 ${pip ? 'pointer-events-none' : ''}`}>
        <CubeCanvas
          ref={cubeRef}
          cubeType={snapshot.cubeType}
          scramble={snapshot.scramble}
          // คู่แข่งหมุนให้ดูเอง — เราหมุนแทนเขาไม่ได้ · กล้องลากเองได้เฉพาะนอกช่วงที่ตามมุมของเขา
          turnsEnabled={false}
        />
      </div>
      {tracking &&
        (pip ? (
          <span
            role="img"
            aria-label="มุมกล้องของผู้เล่นคนนี้"
            // ใต้มุมขวาบน — มุมบนสุดเป็นที่ของปุ่มย่อใน `PipDock`
            className="pointer-events-none absolute right-1.5 top-6 grid h-5 w-5 place-items-center rounded-full bg-navy-900/80 text-slate-300"
          >
            <CameraIcon />
          </span>
        ) : (
          <p className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-navy-900/80 px-2 py-0.5 text-[10px] text-slate-400 backdrop-blur">
            มุมกล้องของผู้เล่นคนนี้
          </p>
        ))}
      {incomplete &&
        snapshot.scramble !== null &&
        (pip ? (
          // ใต้แถวป้ายสถานะ — กล่องห้อง 4 คนกว้างแค่ ~90 px วางแถวเดียวกันจะทับกัน
          <span
            role="img"
            aria-label="ภาพคิวบ์ของคู่แข่งไม่ครบ (เข้ามากลางรอบ)"
            className="pointer-events-none absolute left-1.5 top-6 whitespace-nowrap rounded border border-gold-400/40 bg-navy-900/85 px-1.5 py-0.5 text-[10px] leading-3 text-gold-400"
          >
            <span aria-hidden className="@min-[7rem]:hidden">
              !
            </span>
            <span aria-hidden className="hidden @min-[7rem]:inline">
              ภาพไม่ครบ
            </span>
          </span>
        ) : (
          <p className="pointer-events-none absolute inset-x-3 top-3 rounded-lg border border-gold-400/40 bg-navy-900/85 px-3 py-1.5 text-center text-[11px] text-gold-400 backdrop-blur">
            ภาพคิวบ์ของคู่แข่งไม่ครบ (เข้ามากลางรอบ) · ตัวเลขด้านล่างยังถูกต้อง
          </p>
        ))}
    </>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden>
      <rect x="1.5" y="4.5" width="9" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.5 7l4-2v6l-4-2" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
