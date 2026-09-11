import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { ApiError } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { validateEmail, validatePassword, validateUsername } from '@/lib/validation';
import { AuthLayout } from '@/components/AuthLayout';
import { FormAlert } from '@/components/FormAlert';
import { SubmitButton } from '@/components/SubmitButton';
import { LockIcon, TextField, UserIcon } from '@/components/TextField';

/**
 * ตามดีไซน์มี 4 ช่อง: ชื่อผู้ใช้ / อีเมล / รหัสผ่าน / ยืนยันรหัสผ่าน
 * **ไม่มีช่องชื่อเล่น** — `nickname` เป็น optional อยู่แล้ว (ไม่ใส่จะแสดง username แทน)
 * ผู้ใช้ตั้งทีหลังได้ที่หน้าตั้งค่าโปรไฟล์ (เฟส 8)
 */
export default function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    // ผู้ใช้เริ่มแก้ฟิลด์ไหน ให้ข้อความผิดพลาดของฟิลด์นั้นหายไป
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: '' } : prev));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(undefined);

    const errs: Record<string, string> = {};
    const username = validateUsername(form.username);
    const email = validateEmail(form.email);
    const password = validatePassword(form.password);
    if (username) errs.username = username;
    if (email) errs.email = email;
    if (password) errs.password = password;
    if (form.password !== form.confirmPassword)
      errs.confirmPassword = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน';

    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      await register({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      navigate('/', { replace: true });
    } catch (err) {
      // ต้องรู้จัก `ApiError` ตรงนี้เพราะต้องการ `fields` ไปไฮไลต์ช่องที่ผิด
      // ส่วนข้อความรวมยกให้ `errorMessage()` เหมือนทุกที่ในแอป
      if (err instanceof ApiError && err.fields) setFieldErrors(err.fields);
      setFormError(errorMessage(err, 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="เข้าสู่สนามรบ"
      title="สร้างบัญชีด้วยมือของคุณ"
      subtitle="เลือกชื่อ ใส่อีเมล กรอกรหัสผ่านแล้วเข้าไปวัดฝีมือกันเลย"
      footer={
        <>
          มีบัญชีแล้ว?{' '}
          <Link to="/login" className="font-semibold text-brand-400 hover:underline">
            เข้าสู่ระบบ
          </Link>{' '}
          เลย
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        {formError && <FormAlert message={formError} />}

        <TextField
          label="ชื่อผู้ใช้"
          name="username"
          autoComplete="username"
          autoFocus
          required
          icon={<UserIcon />}
          placeholder="natakrit"
          value={form.username}
          error={fieldErrors.username}
          hint="3–50 ตัว ใช้ได้เฉพาะ a-z A-Z 0-9 _ ห้ามขึ้นต้นด้วยตัวเลข"
          onChange={(e) => update('username', e.target.value)}
        />

        <TextField
          label="อีเมล"
          name="email"
          type="email"
          autoComplete="email"
          required
          icon={<UserIcon />}
          placeholder="natakrit@rubik.com"
          value={form.email}
          error={fieldErrors.email}
          onChange={(e) => update('email', e.target.value)}
        />

        <TextField
          label="รหัสผ่าน"
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
          label="ยืนยันรหัสผ่าน"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          icon={<LockIcon />}
          value={form.confirmPassword}
          error={fieldErrors.confirmPassword}
          onChange={(e) => update('confirmPassword', e.target.value)}
        />

        <SubmitButton loading={loading}>สร้างบัญชี</SubmitButton>
      </form>
    </AuthLayout>
  );
}
