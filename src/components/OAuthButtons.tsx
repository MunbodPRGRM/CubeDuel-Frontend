import type { ReactNode } from 'react';
import { oauthLoginUrl, type OAuthProviderSlug } from '@/lib/api';

interface OAuthButtonProps {
  label: string;
  /** หน้าที่จะพากลับไปหลังล็อกอินเสร็จ — ไม่ใส่ = หน้าแรก */
  returnTo?: string;
}

/**
 * ปุ่มเข้าสู่ระบบด้วย Google (ADR-058 ข้อ 7) / Facebook (ADR-070) — ไม่มีในภาพ `design/` จึงวางใต้ฟอร์มคั่นด้วย "หรือ"
 * ขนาดเท่า `SubmitButton` · สีกับโลโก้ตามแนวทางแบรนด์ของแต่ละเจ้า (ห้ามเปลี่ยนสีโลโก้)
 *
 * เป็น `<a>` ไม่ใช่ `<button>` — ต้องพาทั้งหน้าไปหา provider ไม่ใช่ fetch
 */
function OAuthLink({
  provider,
  returnTo,
  className,
  children,
}: {
  provider: OAuthProviderSlug;
  returnTo?: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <a
      href={oauthLoginUrl(provider, returnTo)}
      className={`flex w-full items-center justify-center gap-3 rounded-xl px-4 py-3.5 text-sm font-semibold
        transition focus:outline-none focus:ring-2 focus:ring-brand-500/40 ${className}`}
    >
      {children}
    </a>
  );
}

/** พื้นขาว + โลโก้ G สี่สี */
export function GoogleButton({ label, returnTo }: OAuthButtonProps) {
  return (
    <OAuthLink provider="google" returnTo={returnTo} className="bg-white text-slate-800 hover:bg-slate-100">
      <GoogleLogo />
      {label}
    </OAuthLink>
  );
}

/** พื้นน้ำเงิน Facebook `#1877F2` + โลโก้ f สีขาว */
export function FacebookButton({ label, returnTo }: OAuthButtonProps) {
  return (
    <OAuthLink
      provider="facebook"
      returnTo={returnTo}
      className="bg-[#1877F2] text-white hover:bg-[#166FE5]"
    >
      <FacebookLogo />
      {label}
    </OAuthLink>
  );
}

/** เส้นคั่น "หรือ" ระหว่างฟอร์มรหัสผ่านกับปุ่ม OAuth */
export function OrDivider() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-slate-500">
      <span className="h-px flex-1 bg-line" />
      หรือ
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function FacebookLogo() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="#FFFFFF"
        d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.971H15.83c-1.491 0-1.956.93-1.956 1.886v2.264h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"
      />
    </svg>
  );
}
