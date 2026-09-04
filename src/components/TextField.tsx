import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> {
  label: string;
  /** ข้อความผิดพลาด — มาจาก validation ฝั่งนี้ หรือจาก `fields` ที่ server ตอบมา */
  error?: string;
  hint?: string;
  /** ไอคอนหน้าช่องกรอกตามดีไซน์ (รูปคน / กุญแจ) */
  icon?: ReactNode;
}

/** ปุ่มสลับซ่อน-แสดงรหัสผ่านจะโผล่เองเมื่อ `type="password"` */
export function TextField({ label, error, hint, icon, required, ...inputProps }: TextFieldProps) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const isPassword = inputProps.type === 'password';
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm text-slate-300">
        {label}
      </label>

      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 left-0 grid w-11 place-items-center text-slate-500">
            {icon}
          </span>
        )}

        <input
          {...inputProps}
          type={isPassword && revealed ? 'text' : inputProps.type}
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`w-full rounded-xl border bg-navy-950/60 py-3 text-sm text-slate-100
            outline-none transition placeholder:text-slate-600
            focus:ring-2 focus:ring-brand-500/25
            ${icon ? 'pl-11' : 'pl-4'} ${isPassword ? 'pr-11' : 'pr-4'}
            ${error ? 'border-loss/70 focus:border-loss' : 'border-line focus:border-brand-500'}`}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-500 transition hover:text-slate-300"
          >
            <EyeIcon off={revealed} />
          </button>
        )}
      </div>

      {error ? (
        <p id={`${id}-error`} className="text-xs text-loss">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.8" />
      {!off && <path d="m3 3 18 18" />}
    </svg>
  );
}

export function UserIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
