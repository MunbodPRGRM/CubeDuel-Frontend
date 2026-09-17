import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { CubeTypePicker } from '@/components/CubeTypePicker';
import { CubeTypeSelect } from '@/components/CubeTypeSelect';
import { FormAlert } from '@/components/FormAlert';
import { SocketGate } from '@/socket/SocketGate';
import { emitAck, socketErrorMessage } from '@/socket/socket-client';
import { useSocket } from '@/socket/useSocket';
import { useQueue } from '@/socket/useQueue';
import type { RoomCreateResult } from '@/socket/types';
import type { CubeType } from '@/types/cube';

/**
 * สร้างห้องที่มีรหัสห้อง แล้วเข้าห้องทันที (`socket-events.md` ข้อ 5)
 *
 * รองรับสองขนาด: **2 คน** (`kind: 'custom'` — 1 ต่อ 1) กับ **3–4 คน** (`kind: 'multiplayer'`)
 * · ทั้งคู่มีผู้ชมได้ (ADR-079) และเป็นห้องที่ **ไม่ปรับคะแนน ELO** เพราะ
 * ห้องที่เข้าด้วยรหัสเป็นโหมด `custom` เสมอ ไม่มีฟิลด์ให้ client เลือกเอง (ADR-043 ข้อ 5)
 */
export default function CreateRoomPage() {
  return (
    <div className="min-h-app bg-navy-900">
      <AppHeader />
      <main className="mx-auto max-w-xl px-4 py-4 sm:py-10">
        <SocketGate>
          <CreateRoomForm />
        </SocketGate>
      </main>
    </div>
  );
}

/** `kind` กับ `maxPlayers` ต้องเข้าคู่กัน ไม่งั้น server ตอบ `E_VALIDATION` */
const SIZES = [
  { players: 2, kind: 'custom', label: '2 คน', note: '1 ต่อ 1 · มีผู้ชมได้' },
  { players: 3, kind: 'multiplayer', label: '3 คน', note: 'แข่งพร้อมกัน · มีผู้ชมได้' },
  { players: 4, kind: 'multiplayer', label: '4 คน', note: 'แข่งพร้อมกัน · มีผู้ชมได้' },
] as const;

type RoomSize = (typeof SIZES)[number];

function CreateRoomForm() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const queue = useQueue();
  const [cubeType, setCubeType] = useState<CubeType>('3x3x3');
  const [size, setSize] = useState<RoomSize>(SIZES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!socket || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // อยู่ในห้องพร้อมกับอยู่ในคิวไม่ได้ (socket-events.md ข้อ 4) — server ล้างให้อยู่แล้ว
      // แต่ต้องบอกจอฝั่งเราด้วย ไม่งั้นแถบ "กำลังหาคู่" จะค้างอยู่ทั้งที่ออกจากคิวไปแล้ว
      await queue.leave();
      const result = await emitAck<RoomCreateResult>(socket, 'room:create', {
        cubeType,
        kind: size.kind,
        maxPlayers: size.players,
      });
      // server พาเราเข้าห้องให้แล้วตั้งแต่ตอน create — หน้าห้องแค่ขอ snapshot ต่อ
      navigate(`/room/${result.roomId}`, { replace: true });
    } catch (err: unknown) {
      setError(socketErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-navy-850 px-4 py-5 sm:px-8 sm:py-7">
      <h1 className="text-xl font-bold text-white">สร้างห้อง</h1>
      <p className="mt-1.5 text-sm text-slate-400">
        ห้องสำหรับเล่นกับเพื่อน — แชร์รหัสห้องให้อีกฝ่ายกด “ใส่เลขห้อง” เพื่อเข้ามา
      </p>

      <div className="mt-6 sm:mt-7">
        <p className="text-sm text-slate-300">ประเภทรูบิค</p>
        {/* จอแคบเป็น dropdown แบบหน้าอื่น (ADR-083 ข้อ 4.2) — ปุ่ม 4 ช่องตัดสองแถวที่ 360 px
            ทั้งสองตัวไม่มีสถานะในตัว ซ่อนด้วย CSS ได้ ไม่ต้องเลือกด้วย hook */}
        <div className="mt-2 md:hidden">
          <CubeTypeSelect value={cubeType} onChange={setCubeType} />
        </div>
        <div className="mt-2 hidden md:block">
          <CubeTypePicker value={cubeType} onChange={setCubeType} />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          scramble จะถูกสุ่มจากฝั่งเซิร์ฟเวอร์ให้ตรงกับประเภทที่เลือก
        </p>
      </div>

      <div className="mt-6">
        <p className="text-sm text-slate-300">จำนวนผู้เล่น</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {SIZES.map((option) => {
            const active = option.players === size.players;
            return (
              <button
                key={option.players}
                type="button"
                onClick={() => setSize(option)}
                aria-pressed={active}
                className={`rounded-xl border px-3 py-2.5 text-center transition ${
                  active
                    ? 'border-brand-500 bg-brand-500/10 text-brand-300'
                    : 'border-line bg-navy-800 text-slate-300 hover:bg-navy-700'
                }`}
              >
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="mt-0.5 block text-[11px] text-slate-500">{option.note}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          ห้องเริ่มได้เมื่อผู้เล่นครบตามจำนวนที่เลือก · หัวห้องเป็นคนกดเริ่ม
        </p>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3 rounded-xl border border-line-soft bg-navy-900/60 px-4 py-3.5 text-sm">
        <div>
          <dt className="text-xs text-slate-500">รูปแบบห้อง</dt>
          <dd className="mt-0.5 text-slate-200">
            {size.players === 2 ? '1 ต่อ 1 (มีผู้ชมได้)' : `${size.players} คน (มีผู้ชมได้)`}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">ผลต่อคะแนน ELO</dt>
          <dd className="mt-0.5 text-slate-200">ไม่มีผล (ห้องสร้างเอง)</dd>
        </div>
      </dl>

      {error && (
        <div className="mt-5">
          <FormAlert message={error} />
        </div>
      )}

      {/* จอแคบ: ปุ่มเต็มความกว้างซ้อนกัน กดถึงด้วยนิ้วโป้ง (ADR-083 ข้อ 8 · ก้อน 20) */}
      <div className="mt-6 grid gap-2.5 sm:mt-7 sm:flex sm:flex-wrap sm:gap-3">
        <button
          type="button"
          onClick={() => void create()}
          disabled={submitting}
          className="flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-500/40 sm:py-2.5"
        >
          {submitting && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          )}
          สร้างห้อง
        </button>
        <Link
          to="/room/join"
          className="rounded-xl border border-line bg-navy-800 px-5 py-3 text-center text-sm font-semibold text-slate-200 transition hover:bg-navy-700 sm:py-2.5"
        >
          มีรหัสห้องอยู่แล้ว
        </Link>
      </div>
    </section>
  );
}
