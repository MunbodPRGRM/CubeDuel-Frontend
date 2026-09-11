import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { apiFetch, ApiError } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { validateEmail } from '@/lib/validation';
import { AuthLayout } from '@/components/AuthLayout';
import { FormAlert } from '@/components/FormAlert';
import { SubmitButton } from '@/components/SubmitButton';
import { TextField, UserIcon } from '@/components/TextField';

/**
 * ขอลิงก์ตั้งรหัสผ่านใหม่ทางอีเมล (api-contract.md ข้อ 2 · ADR-057)
 *
 * server ตอบ "ส่งแล้ว" เหมือนกันทุกกรณี หน้าจอจึง **พูดแบบมีเงื่อนไขเสมอ** ("ถ้าอีเมลนี้มีบัญชี…")
 * ห้ามเขียนให้ฟังเหมือนยืนยันว่าบัญชีมีอยู่จริง · `design/` ไม่มีภาพหน้านี้ ใช้ `AuthLayout` ชุดเดียวกับหน้าเข้าสู่ระบบ
 */
export default function ForgotPasswordPage() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [sentTo, setSentTo] = useState<string>();
  const [loading, setLoading] = useState(false);

  // ล็อกอินอยู่แล้วเปลี่ยนรหัสผ่านที่หน้าตั้งค่าได้เลย ไม่ต้องอ้อมผ่านอีเมล
  if (user) return <Navigate to="/settings" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(undefined);

    const invalid = validateEmail(email);
    setFieldError(invalid);
    if (invalid) return;

    setLoading(true);
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: { email: email.trim() },
        retryOnExpired: false,
      });
      setSentTo(email.trim());
    } catch (err) {
      if (err instanceof ApiError && err.fields?.email) setFieldError(err.fields.email);
      setFormError(errorMessage(err, 'ส่งคำขอไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="ลืมรหัสผ่าน"
      title="ตั้งรหัสผ่านใหม่ผ่านอีเมล"
      subtitle="กรอกอีเมลที่ใช้สมัคร แล้วเราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้"
      footer={
        <>
          นึกออกแล้ว?{' '}
          <Link to="/login" className="font-semibold text-brand-400 hover:underline">
            เข้าสู่ระบบ
          </Link>
        </>
      }
    >
      {sentTo ? (
        <div className="flex flex-col gap-5">
          <FormAlert
            tone="success"
            message={`ถ้า ${sentTo} มีบัญชีอยู่ในระบบ เราส่งลิงก์ตั้งรหัสผ่านใหม่ไปแล้ว ลิงก์ใช้ได้ 30 นาทีและใช้ได้ครั้งเดียว — ถ้าไม่เห็นในกล่องจดหมาย ลองดูในโฟลเดอร์สแปม`}
          />
          <button
            type="button"
            onClick={() => setSentTo(undefined)}
            className="self-start text-sm font-semibold text-brand-400 hover:underline"
          >
            ส่งอีกครั้ง หรือใช้อีเมลอื่น
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          {formError && <FormAlert message={formError} />}

          <TextField
            label="อีเมล"
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            icon={<UserIcon />}
            placeholder="natakrit@rubik.com"
            value={email}
            error={fieldError}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldError(undefined);
            }}
          />

          <SubmitButton loading={loading}>ส่งลิงก์ตั้งรหัสผ่านใหม่</SubmitButton>
        </form>
      )}
    </AuthLayout>
  );
}
