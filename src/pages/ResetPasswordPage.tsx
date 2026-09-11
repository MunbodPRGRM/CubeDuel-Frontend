import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { apiFetch, ApiError } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { validatePassword } from '@/lib/validation';
import { AuthLayout } from '@/components/AuthLayout';
import { FormAlert } from '@/components/FormAlert';
import { SubmitButton } from '@/components/SubmitButton';
import { LockIcon, TextField } from '@/components/TextField';

const REQUEST_NEW_LINK = (
  <Link to="/forgot-password" className="font-semibold text-brand-400 hover:underline">
    ขอลิงก์ใหม่
  </Link>
);

/**
 * ตั้งรหัสผ่านใหม่จากลิงก์ในอีเมล `/reset-password?token=…` (api-contract.md ข้อ 2 · ADR-057)
 *
 * สำเร็จแล้ว server เพิกถอนทุกเซสชัน — ถ้าเบราว์เซอร์นี้ล็อกอินค้างอยู่ ต้องล้างเซสชันในเครื่องด้วย
 * ไม่ปล่อยให้แถบหัวยังโชว์ว่าล็อกอินอยู่จน access token หมดอายุเอง (ADR-057 ข้อ 6)
 */
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token')?.trim() ?? '';
  const { user, logout } = useAuth();

  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [tokenRejected, setTokenRejected] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: '' } : prev));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(undefined);

    const errs: Record<string, string> = {};
    const password = validatePassword(form.password);
    if (password) errs.password = password;
    if (form.password !== form.confirmPassword)
      errs.confirmPassword = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน';
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: { token, newPassword: form.password },
        retryOnExpired: false,
      });
      if (user) await logout();
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.fields?.token) {
        // ลิงก์ใช้ไม่ได้แล้ว — กรอกใหม่กี่รอบก็ไม่ผ่าน ต้องพาไปขอลิงก์ใหม่แทน
        setTokenRejected(true);
      } else if (err instanceof ApiError && err.fields?.newPassword) {
        setFieldErrors({ password: err.fields.newPassword });
      }
      setFormError(errorMessage(err, 'ตั้งรหัสผ่านใหม่ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'));
    } finally {
      setLoading(false);
    }
  }

  function body() {
    if (done) {
      return (
        <div className="flex flex-col gap-5">
          <FormAlert
            tone="success"
            message="ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว ทุกอุปกรณ์ถูกออกจากระบบ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่"
          />
          <Link
            to="/login"
            replace
            className="self-start text-sm font-semibold text-brand-400 hover:underline"
          >
            ไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      );
    }

    if (!token || tokenRejected) {
      return (
        <div className="flex flex-col gap-5">
          <FormAlert
            message={
              formError ??
              'ลิงก์นี้ไม่สมบูรณ์ — ลองกดลิงก์จากอีเมลอีกครั้ง หรือคัดลอกลิงก์มาวางให้ครบทั้งบรรทัด'
            }
          />
          <p className="text-sm text-slate-400">ลิงก์ใช้ได้ 30 นาทีและใช้ได้ครั้งเดียว — {REQUEST_NEW_LINK}</p>
        </div>
      );
    }

    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        {formError && <FormAlert message={formError} />}

        <TextField
          label="รหัสผ่านใหม่"
          name="password"
          type="password"
          autoComplete="new-password"
          autoFocus
          required
          icon={<LockIcon />}
          value={form.password}
          error={fieldErrors.password}
          hint="อย่างน้อย 8 ตัว ต้องมีทั้งตัวอักษรและตัวเลข"
          onChange={(e) => update('password', e.target.value)}
        />

        <TextField
          label="ยืนยันรหัสผ่านใหม่"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          icon={<LockIcon />}
          value={form.confirmPassword}
          error={fieldErrors.confirmPassword}
          onChange={(e) => update('confirmPassword', e.target.value)}
        />

        <SubmitButton loading={loading}>ตั้งรหัสผ่านใหม่</SubmitButton>
      </form>
    );
  }

  return (
    <AuthLayout
      eyebrow="ตั้งรหัสผ่านใหม่"
      title="เลือกรหัสผ่านใหม่ของคุณ"
      subtitle="ตั้งเสร็จแล้วทุกอุปกรณ์จะออกจากระบบ แล้วเข้าสู่ระบบใหม่ด้วยรหัสผ่านนี้"
      footer={
        <>
          กลับไป{' '}
          <Link to="/login" className="font-semibold text-brand-400 hover:underline">
            เข้าสู่ระบบ
          </Link>
        </>
      }
    >
      {body()}
    </AuthLayout>
  );
}
