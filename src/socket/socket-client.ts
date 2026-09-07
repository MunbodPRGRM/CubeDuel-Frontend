/**
 * ตัวช่วยระดับล่างของ Socket.IO — สร้าง connection กับยิง event แบบรอ ack
 *
 * ส่วนที่เป็น React (provider / hook) อยู่ที่ `SocketProvider.tsx`
 * ไฟล์นี้ไม่พึ่ง React เลย จะได้เอาไปใช้ในสคริปต์ทดสอบได้ด้วย
 */
import { io, type Socket } from 'socket.io-client';
import type { Ack, AckError, ClientToServerEvents, ServerToClientEvents } from './types';

export type TypedClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000';

/** รอ ack นานสุดเท่านี้ก่อนถือว่าเน็ตมีปัญหา — handler ฝั่ง server ทุกตัวตอบภายในหลัก ms */
const ACK_TIMEOUT_MS = 10_000;

/** error ที่มาจาก ack ของ socket — คนละคลาสกับ `ApiError` ของ REST (ADR-034 ข้อ 5) */
export class SocketAckError extends Error {
  readonly code: AckError['code'];

  constructor(error: AckError) {
    super(error.message);
    this.name = 'SocketAckError';
    this.code = error.code;
  }
}

/**
 * สร้าง socket ที่ยัง **ไม่ต่อ** — ผู้เรียกเป็นคนตั้ง token แล้วสั่ง `connect()` เอง
 * (ต้องตั้ง token ทีหลังได้ เพราะ access token ถูกต่ออายุใหม่ได้ทุกเมื่อ — ADR-010)
 */
export function createSocket(token: string): TypedClientSocket {
  return io(SOCKET_URL, {
    auth: { token },
    autoConnect: false,
    withCredentials: true,
    // ต่อใหม่เองไม่มีวันยอมแพ้ — เน็ตมือถือหลุดกลางแมตช์แล้วต้องกลับมาทัน grace 30 วิ
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5_000,
  });
}

/**
 * ยิง event แล้วรอ ack — สำเร็จได้ `data` ผิดพลาดโยน `SocketAckError`
 *
 * ต้อง cast เพราะ type ของ Socket.IO บังคับ signature ของแต่ละ event ตายตัว
 * (ฝั่ง server ก็ cast ที่ `sockets/ack.ts` ด้วยเหตุผลเดียวกัน)
 */
export function emitAck<R>(
  socket: TypedClientSocket,
  event: keyof ClientToServerEvents & string,
  payload: unknown = {},
  timeoutMs = ACK_TIMEOUT_MS,
): Promise<R> {
  return new Promise<R>((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(
        new SocketAckError({
          code: 'E_INTERNAL',
          message: 'เซิร์ฟเวอร์ไม่ตอบกลับ ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่',
        }),
      );
    }, timeoutMs);

    const done = (response: Ack<R>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (response.ok) resolve(response.data);
      else reject(new SocketAckError(response.error));
    };

    (socket as unknown as { emit: (e: string, p: unknown, ack: (r: Ack<R>) => void) => void }).emit(
      event,
      payload,
      done,
    );
  });
}

/** ข้อความที่เอาไปโชว์ได้เลย ไม่ว่า error จะมาจากทางไหน */
export function socketErrorMessage(error: unknown): string {
  if (error instanceof SocketAckError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'เกิดข้อผิดพลาดที่ไม่รู้จัก กรุณาลองใหม่อีกครั้ง';
}

/** `connect_error` ของ Socket.IO แนบ `data` ที่ server ส่งมาไว้ใน error object */
export function connectErrorCode(error: unknown): AckError['code'] | null {
  const data = (error as { data?: { code?: string } } | null)?.data;
  return (data?.code as AckError['code'] | undefined) ?? null;
}
