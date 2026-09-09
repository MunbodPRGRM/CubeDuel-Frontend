import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { FormAlert } from '@/components/FormAlert';
import { SocketGate } from '@/socket/SocketGate';
import { emitAck, socketErrorMessage } from '@/socket/socket-client';
import { useSocket } from '@/socket/useSocket';
import { useQueue } from '@/socket/useQueue';
import type { RoomSnapshotResult } from '@/socket/types';

/**
 * รหัสห้อง 6 หลัก ตัด `0 O 1 I` ทิ้งเพราะคนอ่านสับสน (`game-rules.md` ข้อ 9)
 * ต้องตรงกับ regex ฝั่ง server ที่ `backend/src/schemas/socket.schema.ts`
 */
const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;
const ROOM_CODE_LENGTH = 6;

/** ตัดตัวที่พิมพ์ไม่ได้ทิ้งตั้งแต่ตอนพิมพ์ ผู้ใช้จะได้รู้ทันทีว่าคีย์ไหนใช้ไม่ได้ */
function sanitizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-HJ-NP-Z2-9]/g, '')
    .slice(0, ROOM_CODE_LENGTH);
}

export default function JoinRoomPage() {
  return (
    <div className="min-h-screen bg-navy-900">
      <AppHeader />
      <main className="mx-auto max-w-xl px-4 py-10">
        <SocketGate>
          <JoinRoomForm />
        </SocketGate>
      </main>
    </div>
  );
}

function JoinRoomForm() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const queue = useQueue();
  const [code, setCode] = useState('');
  const [as, setAs] = useState<'player' | 'spectator'>('player');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = ROOM_CODE_PATTERN.test(code);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!socket || submitting || !valid) return;
    setSubmitting(true);
    setError(null);
    try {
      // เหตุผลเดียวกับหน้าสร้างห้อง — อยู่ในห้องพร้อมกับอยู่ในคิวไม่ได้
      await queue.leave();
      const result = await emitAck<RoomSnapshotResult>(socket, 'room:join', {
        roomCode: code,
        as,
      });
      navigate(`/room/${result.snapshot.roomId}`, { replace: true });
    } catch (err: unknown) {
      setError(socketErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="rounded-2xl border border-line bg-navy-850 px-6 py-7 sm:px-8"
    >
      <h1 className="text-xl font-bold text-white">ใส่เลขห้อง</h1>
      <p className="mt-1.5 text-sm text-slate-400">
        กรอกรหัส {ROOM_CODE_LENGTH} หลักที่ได้จากคนสร้างห้อง (ไม่มีตัว O, I และเลข 0, 1)
      </p>

      <label htmlFor="room-code" className="mt-7 block text-sm text-slate-300">
        รหัสห้อง
      </label>
      <input
        id="room-code"
        value={code}
        onChange={(event) => setCode(sanitizeCode(event.target.value))}
        autoFocus
        autoComplete="off"
        spellCheck={false}
        inputMode="text"
        placeholder="ABC234"
        aria-describedby="room-code-hint"
        className="tabular mt-2 w-full rounded-xl border border-line bg-navy-950/60 px-4 py-3.5 text-center text-2xl font-bold tracking-[0.5em] text-slate-100 outline-none transition placeholder:text-slate-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
      />
      <p id="room-code-hint" className="mt-2 text-xs text-slate-500">
        {code.length}/{ROOM_CODE_LENGTH} ตัวอักษร
      </p>

      <fieldset className="mt-6">
        <legend className="text-sm text-slate-300">เข้าห้องในฐานะ</legend>
        <div className="mt-2 inline-flex gap-1 rounded-xl border border-line bg-navy-900/60 p-1">
          {(
            [
              { value: 'player', label: 'ผู้เล่น' },
              { value: 'spectator', label: 'ผู้ชม' },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={as === option.value}
              onClick={() => setAs(option.value)}
              className={`rounded-lg px-4 py-1.5 text-sm transition ${
                as === option.value
                  ? 'bg-brand-500 font-semibold text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {as === 'player'
            ? 'เข้าไปเล่นด้วย — ห้องเต็มหรือเริ่มแข่งไปแล้วจะเข้าไม่ได้'
            : 'เข้าไปดูอย่างเดียว เข้าได้ทุกจังหวะแม้ระหว่างแข่ง (สูงสุด 50 คน)'}
        </p>
      </fieldset>

      {error && (
        <div className="mt-5">
          <FormAlert message={error} />
        </div>
      )}

      <div className="mt-7 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={!valid || submitting}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-500/40"
        >
          {submitting && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          )}
          เข้าห้อง
        </button>
        <Link
          to="/room/new"
          className="rounded-xl border border-line bg-navy-800 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-navy-700"
        >
          สร้างห้องใหม่แทน
        </Link>
      </div>
    </form>
  );
}
