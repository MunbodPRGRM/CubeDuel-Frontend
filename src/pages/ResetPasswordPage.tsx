import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { apiFetch, ApiError } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { validateEmail, validatePassword } from '@/lib/validation';
import { AuthLayout } from '@/components/AuthLayout';
import { FormAlert } from '@/components/FormAlert';
import { SubmitButton } from '@/components/SubmitButton';
import { LockIcon, TextField, UserIcon } from '@/components/TextField';

const EMPTY_FORM = { username: '', email: '', password: '', confirmPassword: '' };

/**
 * ลืมรหัสผ่าน — กรอก username + อีเมลของบัญชี แล้วตั้งรหัสใหม่ได้ทันที ไม่มีลิงก์ (api-contract.md ข้อ 2 · ADR-069)
 *
 * สำเร็จแล้ว server เพิกถอนทุกเซสชัน — ถ้าเบราว์เซอร์นี้ล็อกอินค้างอยู่ ต้องล้างเซสชันในเครื่องด้วย
 * ไม่ปล่อยให้แถบหัวยังโชว์ว่าล็อกอินอยู่จน access token หมดอายุเอง (ADR-057 ข้อ 6)
 */
export default function ResetPasswordPage() {
  const { user, logout } = useAuth();

  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
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
    // ไม่ใช้ `validateUsername` — แค่เอาไปเทียบกับบัญชีที่มีอยู่ ไม่ได้ตั้งชื่อใหม่
    if (!form.username.trim()) errs.username = 'กรุณากรอกชื่อผู้ใช้';
    const email = validateEmail(form.email);
    if (email) errs.email = email;
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
        body: {
          username: form.username.trim(),
          email: form.email.trim(),
          newPassword: form.password,
        },
        retryOnExpired: false,
      });
      if (user) await logout();
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        const { newPassword, ...rest } = err.fields;
        setFieldErrors(newPassword ? { ...rest, password: newPassword } : rest);
      }
      // ไม่ตรงกับบัญชีไหน = ไม่มี `fields` — server ตอบข้อความเดียวกันทุกกรณี (ADR-069 ข้อ 1)
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

    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        {formError && <FormAlert message={formError} />}

        <TextField
          label="ชื่อผู้ใช้"
          name="username"
          autoComplete="username"
          autoFocus
          required
          icon={<UserIcon />}
          value={form.username}
          error={fieldErrors.username}
          onChange={(e) => update('username', e.target.value)}
        />

        <TextField
          label="อีเมลที่ใช้สมัคร"
          name="email"
          type="email"
          autoComplete="email"
          required
          icon={<UserIcon />}
          value={form.email}
          error={fieldErrors.email}
          onChange={(e) => update('email', e.target.value)}
        />

        <TextField
          label="รหัสผ่านใหม่"
          name="password"
          type="password"
          autoComplete="new-password"
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
      eyebrow="ลืมรหัสผ่าน"
      title="ตั้งรหัสผ่านใหม่"
      subtitle="กรอกชื่อผู้ใช้กับอีเมลที่ใช้สมัคร ตั้งเสร็จแล้วทุกอุปกรณ์จะออกจากระบบ"
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
