import type { AuthSession } from '@/types/auth';
import { ERROR_MESSAGES, type AppErrorCode } from './errors';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

/**
 * ตัวห่อ fetch ของทั้งแอป — จัดการ 3 เรื่องที่ทุกหน้าต้องใช้เหมือนกัน
 *   1. แกะ envelope `{ data }` / `{ error }` ตาม docs/api-contract.md ข้อ 1
 *   2. แนบ access token ให้อัตโนมัติ
 *   3. access token หมดอายุ (15 นาที) → ต่ออายุด้วย refresh token แล้วยิงซ้ำให้เอง ผู้ใช้ไม่รู้สึก
 *
 * ADR-010: access token เก็บใน **ตัวแปรในหน่วยความจำ** ห้ามลง localStorage
 * ส่วน refresh token อยู่ใน httpOnly cookie → ต้องส่ง `credentials: 'include'` ทุกครั้ง
 */

/**
 * โดเมนของ **API server** (ตัด `/api/v1` ทิ้ง) — ไฟล์ที่อัปโหลด (รูปข่าว) เสิร์ฟจากที่นี่
 * ไม่ใช่จากโดเมนของเว็บ ตอน deploy สองอย่างนี้อยู่คนละที่กัน (ADR-049 ข้อ 2)
 */
const FILE_BASE_URL = BASE_URL.replace(/\/api\/v\d+\/?$/, '');

/** พาธที่ API คืนมา (`/uploads/news/…`) → URL ที่ `<img>` ใช้ได้จริง */
export function fileUrl(path: string): string {
  return path.startsWith('/') ? `${FILE_BASE_URL}${path}` : path;
}

export class ApiError extends Error {
  /**
   * รหัสตาม `docs/api-contract.md` ข้อ 1 — แต่ประกาศเป็น `AppErrorCode` เพราะตัวห่อนี้
   * สร้าง error ของฝั่ง client เองด้วยตอนยิงไม่ถึง server (`E_NETWORK`)
   */
  readonly code: AppErrorCode;
  readonly status: number;
  /** ข้อความรายฟิลด์จาก server เช่น { email: 'อีเมลนี้ถูกใช้ไปแล้ว' } */
  readonly fields?: Record<string, string>;

  constructor(
    status: number,
    code: AppErrorCode,
    message: string,
    fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

// ---------------------------------------------------------------- access token

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** ให้ AuthContext รู้ตัวเมื่อ token ถูกต่ออายุเอง หรือเซสชันหมดอายุจริง ๆ */
type SessionListener = (session: AuthSession | null) => void;
let sessionListener: SessionListener | null = null;

export function setSessionListener(fn: SessionListener | null): void {
  sessionListener = fn;
}

// ---------------------------------------------------------------- ตัว fetch

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** ปิดการต่ออายุอัตโนมัติ (ใช้กับ endpoint ที่ 401 แปลว่า "รหัสผ่านผิด" ไม่ใช่ "token หมดอายุ") */
  retryOnExpired?: boolean;
}

async function rawFetch(path: string, options: FetchOptions): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  return fetch(`${BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    // refresh token เป็น httpOnly cookie — ไม่ใส่บรรทัดนี้ browser จะไม่ส่งไปให้
    credentials: 'include',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

async function toApiError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as {
      error?: { code: AppErrorCode; message: string; fields?: Record<string, string> };
    };
    if (body.error)
      return new ApiError(res.status, body.error.code, body.error.message, body.error.fields);
  } catch {
    // server ตอบไม่ใช่ JSON (เช่น proxy พัง) — ตกไปใช้ข้อความกลางด้านล่าง
  }
  return new ApiError(res.status, 'E_INTERNAL', ERROR_MESSAGES.E_INTERNAL);
}

// ---------------------------------------------------------------- ต่ออายุ token

/** ถ้ามีหลาย request เจอ 401 พร้อมกัน ต้องต่ออายุแค่ครั้งเดียว ไม่ใช่ยิง /auth/refresh พร้อมกันหลายรอบ */
let refreshInFlight: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: '{}',
    });
    if (!res.ok) {
      accessToken = null;
      sessionListener?.(null);
      return false;
    }
    const body = (await res.json()) as { data: AuthSession };
    accessToken = body.data.accessToken;
    sessionListener?.(body.data);
    return true;
  } catch {
    // เน็ตหลุด — ไม่ถือว่าเซสชันตาย ปล่อยให้ผู้ใช้ลองใหม่
    return false;
  }
}

/** ขอ access token ใหม่จาก refresh token ที่อยู่ใน cookie */
export function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

// ---------------------------------------------------------------- API หลัก

/** meta ของ endpoint ที่แบ่งหน้า (api-contract.md ข้อ 1) */
export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  [key: string]: unknown;
}

async function request<T>(
  path: string,
  options: FetchOptions,
): Promise<{ data: T; meta?: PageMeta }> {
  let res: Response;
  try {
    res = await rawFetch(path, options);
  } catch {
    // ยิงไม่ถึง server เลย (เน็ตหลุด / backend ไม่ได้รัน) — คนละเรื่องกับ server ตอบ 500
    throw new ApiError(0, 'E_NETWORK', ERROR_MESSAGES.E_NETWORK);
  }

  // 401 บน endpoint ทั่วไป = access token หมดอายุ → ต่ออายุแล้วยิงซ้ำหนึ่งครั้ง
  const canRetry = options.retryOnExpired !== false && accessToken !== null;
  if (res.status === 401 && canRetry) {
    const renewed = await refreshSession();
    if (renewed) res = await rawFetch(path, options);
  }

  if (!res.ok) throw await toApiError(res);

  return (await res.json()) as { data: T; meta?: PageMeta };
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  return (await request<T>(path, options)).data;
}

/**
 * ส่ง `multipart/form-data` (ฟอร์มข่าวที่แนบรูป — api-contract.md ข้อ 7)
 *
 * **ห้ามตั้ง `Content-Type` เอง** — เบราว์เซอร์ต้องเป็นคนใส่พร้อม `boundary` ให้ ถ้าตั้งทับ
 * ฝั่ง server จะแกะ multipart ไม่ออก · นอกนั้นเหมือน `apiFetch` ทุกอย่าง (แนบ token · ต่ออายุแล้วยิงซ้ำ)
 */
export async function apiUpload<T>(
  path: string,
  form: FormData,
  method: 'POST' | 'PATCH' = 'POST',
): Promise<T> {
  const send = () => {
    const headers: Record<string, string> = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(`${BASE_URL}${path}`, { method, headers, credentials: 'include', body: form });
  };

  let res: Response;
  try {
    res = await send();
  } catch {
    // ยิงไม่ถึง server เลย (เน็ตหลุด / backend ไม่ได้รัน) — คนละเรื่องกับ server ตอบ 500
    throw new ApiError(0, 'E_NETWORK', ERROR_MESSAGES.E_NETWORK);
  }

  if (res.status === 401 && accessToken !== null && (await refreshSession())) res = await send();
  if (!res.ok) throw await toApiError(res);

  return ((await res.json()) as { data: T }).data;
}

/** สำหรับ endpoint ที่คืน `meta` มาด้วย (กระดานอันดับ ประวัติการแข่ง ฯลฯ) */
export async function apiFetchPage<T>(
  path: string,
  options: FetchOptions = {},
): Promise<{ data: T; meta: PageMeta }> {
  const body = await request<T>(path, options);
  return { data: body.data, meta: body.meta as PageMeta };
}
