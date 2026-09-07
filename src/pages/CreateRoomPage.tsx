import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { CubeTypePicker } from '@/components/CubeTypePicker';
import { FormAlert } from '@/components/FormAlert';
import { SocketGate } from '@/socket/SocketGate';
import { emitAck, socketErrorMessage } from '@/socket/socket-client';
import { useSocket } from '@/socket/useSocket';
import type { RoomCreateResult } from '@/socket/types';
import type { CubeType } from '@/types/cube';

/**
 * สร้างห้องสร้างเอง 1v1 แล้วเข้าห้องทันที (`socket-events.md` ข้อ 5)
 *
 * ห้องผู้เล่นหลายคน 3–4 คนเป็นงานเฟส 6 — ฝั่ง server ยังตอบ `E_VALIDATION` อยู่
 * จึงยังไม่มีช่องให้เลือกจำนวนผู้เล่นที่นี่
 */
export default function CreateRoomPage() {
  return (
    <div className="min-h-screen bg-navy-900">
      <AppHeader />
      <main className="mx-auto max-w-xl px-4 py-10">
        <SocketGate>
          <CreateRoomForm />
        </SocketGate>
      </main>
    </div>
  );
}

function CreateRoomForm() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [cubeType, setCubeType] = useState<CubeType>('3x3x3');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!socket || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await emitAck<RoomCreateResult>(socket, 'room:create', {
        cubeType,
        kind: 'custom',
        maxPlayers: 2,
      });
      // server พาเราเข้าห้องให้แล้วตั้งแต่ตอน create — หน้าห้องแค่ขอ snapshot ต่อ
      navigate(`/room/${result.roomId}`, { replace: true });
    } catch (err: unknown) {
      setError(socketErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-navy-850 px-6 py-7 sm:px-8">
      <h1 className="text-xl font-bold text-white">สร้างห้อง</h1>
      <p className="mt-1.5 text-sm text-slate-400">
        ห้องแบบ 1 ต่อ 1 สำหรับเล่นกับเพื่อน — แชร์รหัสห้องให้อีกฝ่ายกด “ใส่เลขห้อง” เพื่อเข้ามา
      </p>

      <div className="mt-7">
        <p className="text-sm text-slate-300">ประเภทรูบิค</p>
        <div className="mt-2">
          <CubeTypePicker value={cubeType} onChange={setCubeType} />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          scramble จะถูกสุ่มจากฝั่งเซิร์ฟเวอร์ให้ตรงกับประเภทที่เลือก
        </p>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3 rounded-xl border border-line-soft bg-navy-900/60 px-4 py-3.5 text-sm">
        <div>
          <dt className="text-xs text-slate-500">จำนวนผู้เล่น</dt>
          <dd className="mt-0.5 text-slate-200">2 คน (1 ต่อ 1)</dd>
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

      <div className="mt-7 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void create()}
          disabled={submitting}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-500/40"
        >
          {submitting && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          )}
          สร้างห้อง
        </button>
        <Link
          to="/room/join"
          className="rounded-xl border border-line bg-navy-800 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-navy-700"
        >
          มีรหัสห้องอยู่แล้ว
        </Link>
      </div>
    </section>
  );
}
