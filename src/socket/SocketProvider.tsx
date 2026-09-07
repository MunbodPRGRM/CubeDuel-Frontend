import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/auth/useAuth';
import { getAccessToken, refreshSession } from '@/lib/api';
import { ServerClock } from './clock';
import { connectErrorCode, createSocket, type TypedClientSocket } from './socket-client';
import { SocketContext, type SocketContextValue, type SocketStatus } from './socket-context';
import type { AckError } from './types';

/** ความถี่ของ `net:ping` ตาม `socket-events.md` ข้อ 2 */
const PING_INTERVAL_MS = 10_000;

/**
 * connection เดียวของทั้งแอป — ต่อเมื่อล็อกอินแล้วเท่านั้น (handshake ต้องมี access token)
 *
 * หน้าที่ของ provider มีแค่ 3 อย่าง ที่เหลือเป็นของ `useRoom`:
 *   1. ถือ socket ตัวเดียวไว้ให้ทุกหน้าใช้ร่วมกัน (ห้องเป็นของ server ถ้าต่อหลายเส้นจะกลายเป็นหลายแท็บ)
 *   2. `net:ping` ทุก 10 วินาที → sync นาฬิกา + รายงาน RTT กลับให้ server ชดเชยเวลา
 *   3. access token หมดอายุตอนจะต่อ → ต่ออายุแล้วต่อใหม่ให้เอง ผู้ใช้ไม่ต้องล็อกอินซ้ำ
 *
 * ⚠️ token หมดอายุ **ระหว่างที่ต่ออยู่ไม่ตัดสาย** (ADR-034 ข้อ 7) ที่นี่จึงต่ออายุเฉพาะจังหวะ handshake
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, user } = useAuth();
  const userId = user?.userId ?? null;

  const clockRef = useRef<ServerClock>(new ServerClock());
  const [socket, setSocket] = useState<TypedClientSocket | null>(null);
  const [status, setStatus] = useState<SocketStatus>('idle');
  const [error, setError] = useState<AckError | null>(null);
  const [rttMs, setRttMs] = useState<number | null>(null);
  /** เพิ่มค่าเพื่อบังคับให้ effect สร้าง connection ใหม่ (ปุ่ม "ลองเชื่อมต่อใหม่") */
  const [retryToken, setRetryToken] = useState(0);

  const reconnect = useCallback(() => setRetryToken((n) => n + 1), []);

  useEffect(() => {
    const token = authStatus === 'ready' && userId !== null ? getAccessToken() : null;
    if (!token) {
      setSocket(null);
      setStatus('idle');
      setError(null);
      return;
    }

    const clock = clockRef.current;
    clock.reset();
    setRttMs(null);
    setStatus('connecting');
    setError(null);

    const s = createSocket(token);
    let disposed = false;
    /** ต่ออายุ token ได้ครั้งเดียวต่อการต่อหนึ่งรอบ — กันวนไม่รู้จบตอน refresh token ตายจริง ๆ */
    let tokenRetried = false;
    let pingTimer: ReturnType<typeof setInterval> | null = null;

    const fail = (ackError: AckError) => {
      if (disposed) return;
      setError(ackError);
      setStatus('error');
    };

    const ping = () => {
      const clientTs = Date.now();
      const lastRttMs = clock.lastRttMs;
      // ping ครั้งแรกยังไม่มี RTT ให้รายงาน — ห้ามส่งฟิลด์นี้ไปเป็น undefined/null
      const payload =
        lastRttMs === null ? { clientTs } : { clientTs, lastRttMs: Math.round(lastRttMs) };

      s.emit('net:ping', payload, (response) => {
        if (disposed || !response.ok) return;
        const sample = clock.addSample(clientTs, response.data.serverTs, Date.now());
        setRttMs(Math.round(sample.rttMs));
      });
    };

    s.on('connect', () => {
      if (disposed) return;
      tokenRetried = false;
      setStatus('connected');
      setError(null);
      ping();
      pingTimer = setInterval(ping, PING_INTERVAL_MS);
    });

    s.on('disconnect', (reason) => {
      if (disposed) return;
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = null;
      // เส้นทางเน็ตอาจเปลี่ยนตอนต่อใหม่ ค่า offset เดิมเชื่อไม่ได้แล้ว
      clock.reset();
      setRttMs(null);

      if (reason === 'io server disconnect') {
        fail({ code: 'E_INTERNAL', message: 'เซิร์ฟเวอร์ตัดการเชื่อมต่อ' });
        return;
      }
      // เหตุผลอื่น Socket.IO ต่อใหม่ให้เองอยู่แล้ว
      setStatus('connecting');
    });

    s.on('connect_error', (err) => {
      if (disposed) return;
      const code = connectErrorCode(err);

      if (code === 'E_UNAUTHENTICATED' && !tokenRetried) {
        tokenRetried = true;
        // หยุดวงจร retry ของ Socket.IO ก่อน ไม่งั้นมันจะยิง token เดิมซ้ำระหว่างที่เรากำลังต่ออายุ
        s.disconnect();
        void refreshSession().then((renewed) => {
          if (disposed) return;
          const fresh = getAccessToken();
          if (!renewed || !fresh) {
            fail({ code: 'E_UNAUTHENTICATED', message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
            return;
          }
          s.auth = { token: fresh };
          s.connect();
        });
        return;
      }

      if (code === 'E_UNAUTHENTICATED' || code === 'E_ACCOUNT_SUSPENDED') {
        s.disconnect();
        fail({ code, message: err.message });
        return;
      }

      // ต่อไม่ติดเพราะเน็ตหรือ server ยังไม่ขึ้น — ปล่อยให้ Socket.IO ลองใหม่เอง
      setStatus('connecting');
    });

    // error ที่ไม่ได้ผูกกับ ack (เช่น `solve:move` ที่ผิดกติกา) — หน้าที่ใช้จะดักเองอีกที
    s.on('error', (payload) => {
      console.warn('[socket]', payload.code, payload.message);
    });

    setSocket(s);
    s.connect();

    return () => {
      disposed = true;
      if (pingTimer) clearInterval(pingTimer);
      s.removeAllListeners();
      s.disconnect();
      setSocket(null);
    };
  }, [authStatus, userId, retryToken]);

  const value = useMemo<SocketContextValue>(
    () => ({ socket, status, error, clock: clockRef.current, rttMs, reconnect }),
    [socket, status, error, rttMs, reconnect],
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}
