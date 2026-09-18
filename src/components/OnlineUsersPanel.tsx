import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { useNarrowScreen } from '@/hooks/useNarrowScreen';
import { apiFetch } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { CUBE_TYPE_LABEL } from '@/types/leaderboard';
import {
  ACTIVITY_LABEL,
  ONLINE_USERS_LIMIT,
  type OnlineActivity,
  type OnlineUsers,
} from '@/types/online';
import { Avatar } from './Avatar';
import { BottomSheet } from './BottomSheet';

/** ดึงรายชื่อใหม่ถี่เท่านี้ **เฉพาะตอนแผงเปิดอยู่** (ADR-086 ข้อ 4) */
const REFRESH_MS = 15_000;
/** พิมพ์ค้นหาแล้วรอเท่านี้ก่อนยิง — ไม่งั้นยิงทุกตัวอักษร */
const SEARCH_DEBOUNCE_MS = 300;

const ACTIVITY_TONE: Record<OnlineActivity, string> = {
  playing: 'border-brand-500/50 bg-brand-500/15 text-brand-300',
  spectating: 'border-gold-400/40 bg-gold-400/10 text-gold-400',
  in_room: 'border-line bg-navy-800 text-slate-300',
  queue: 'border-win/40 bg-win/10 text-win',
  idle: 'border-transparent text-slate-500',
};

/**
 * แผงรายชื่อสมาชิกออนไลน์ (`GET /users/online` · ADR-086)
 *
 * จอกว้างเป็นกล่องกลางจอ · จอแคบเป็น `BottomSheet` ตัวเดียวของแอป (ADR-083 ข้อ 9)
 * **กล่องจอกว้างต้องวาดผ่าน portal** — ตัวเปิดอยู่ใน `AppHeader` ที่มี `backdrop-blur`
 * ซึ่งทำให้ `position: fixed` ของลูกยึดกับแถบบนแทนจอ (กล่องจะไปโผล่ในแถบสูง 64 px)
 * ถูก mount เฉพาะตอนเปิด — ปิดแล้วตัวจับเวลาดึงข้อมูลหายไปด้วย ไม่มีใครยิงค้างอยู่เบื้องหลัง
 */
export function OnlineUsersPanel({ onClose }: { onClose: () => void }) {
  const narrow = useNarrowScreen();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [data, setData] = useState<OnlineUsers | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    const path = debounced ? `/users/online?q=${encodeURIComponent(debounced)}` : '/users/online';

    const load = () => {
      apiFetch<OnlineUsers>(path)
        .then((result) => {
          if (cancelled) return;
          setData(result);
          setError(null);
        })
        .catch((err: unknown) => {
          // ข้อมูลรอบก่อนยังโชว์ต่อได้ — แค่บอกว่ารอบนี้ดึงไม่ได้
          if (!cancelled) setError(errorMessage(err, 'โหลดรายชื่อไม่สำเร็จ'));
        });
    };

    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [debounced]);

  // จอกว้างปิดด้วย Esc เอง — จอแคบ `BottomSheet` จัดการให้แล้ว
  useEffect(() => {
    if (narrow) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [narrow, onClose]);

  const summary =
    data === null
      ? 'กำลังโหลด…'
      : debounced
        ? `พบ ${data.total} คนจาก ${data.online} คนที่ออนไลน์`
        : `สมาชิกออนไลน์ ${data.online} คน`;

  const body = (
    <div className="flex min-h-0 flex-col gap-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        maxLength={50}
        placeholder="ค้นหาชื่อผู้ใช้หรือชื่อเล่น"
        aria-label="ค้นหาสมาชิกที่ออนไลน์"
        className="w-full rounded-xl border border-line bg-navy-950/60 px-4 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand-500"
      />

      <p className="text-xs text-slate-500" aria-live="polite">
        {summary}
      </p>
      {error && <p className="text-xs text-loss">{error}</p>}

      <ul className="-mx-1 max-h-[55vh] min-h-0 overflow-y-auto md:max-h-96">
        {data?.users.map((u) => {
          const name = u.nickname ?? u.username;
          const isMe = u.userId === user?.userId;
          return (
            <li key={u.userId}>
              <Link
                to={`/users/${u.userId}`}
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl px-1 py-2 transition hover:bg-navy-800"
              >
                <span className="relative">
                  <Avatar name={name} />
                  <span
                    aria-hidden
                    className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full border-2 border-navy-850 bg-win"
                  />
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-sm font-medium text-slate-100">
                    {name}
                    {isMe && <span className="ml-1.5 text-xs text-slate-500">(คุณ)</span>}
                  </span>
                  {u.nickname && (
                    <span className="block truncate text-xs text-slate-500">@{u.username}</span>
                  )}
                </span>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${ACTIVITY_TONE[u.activity]}`}
                >
                  {ACTIVITY_LABEL[u.activity]}
                  {u.cubeType && ` · ${CUBE_TYPE_LABEL[u.cubeType]}`}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {data && data.users.length === 0 && (
        <p className="py-4 text-center text-sm text-slate-500">
          {debounced ? 'ไม่พบสมาชิกที่ตรงกับคำค้นหา' : 'ยังไม่มีใครออนไลน์'}
        </p>
      )}
      {data && data.total > data.users.length && (
        <p className="text-center text-xs text-slate-500">
          แสดง {ONLINE_USERS_LIMIT} จาก {data.total} คน · พิมพ์ค้นหาเพื่อหาคนที่เหลือ
        </p>
      )}
    </div>
  );

  if (narrow) {
    return (
      <BottomSheet open onClose={onClose} title="สมาชิกออนไลน์">
        {body}
      </BottomSheet>
    );
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="สมาชิกออนไลน์"
      className="fixed inset-0 z-50 grid place-items-center bg-navy-950/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-line bg-navy-850 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-semibold text-slate-100">สมาชิกออนไลน์</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-navy-800 hover:text-slate-100"
          >
            ✕
          </button>
        </header>
        <div className="px-5 py-4">{body}</div>
      </div>
    </div>,
    document.body,
  );
}
