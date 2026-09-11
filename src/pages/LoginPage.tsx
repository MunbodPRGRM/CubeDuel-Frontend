import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { ApiError } from '@/lib/api';
import { AuthLayout } from '@/components/AuthLayout';
import { FormAlert } from '@/components/FormAlert';
import { GoogleButton, OrDivider } from '@/components/GoogleButton';
import { SubmitButton } from '@/components/SubmitButton';
import { LockIcon, TextField, UserIcon } from '@/components/TextField';
import { errorMessage, oauthErrorMessage } from '@/lib/errors';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  // เข้าสู่ระบบด้วย Google ไม่ผ่าน → server พากลับมาที่นี่พร้อม `?oauth_error=` (ADR-058 ข้อ 3)
  const [searchParams, setSearchParams] = useSearchParams();
  const oauthError = searchParams.get('oauth_error');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>(() =>
    oauthErrorMessage(oauthError),
  );
  const [loading, setLoading] = useState(false);

  // อ่านข้อความไปแล้ว → ลบออกจาก URL กดรีเฟรชจะได้ไม่ขึ้นซ้ำ
  useEffect(() => {
    if (oauthError) setSearchParams({}, { replace: true });
  }, [oauthError, setSearchParams]);

  if (user) return <Navigate to={from} replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(undefined);

    if (!identifier.trim() || !password) {
      setFormError('กรุณากรอกชื่อผู้ใช้/อีเมล และรหัสผ่าน');
      return;
    }

    setLoading(true);
    try {
      await login({ identifier: identifier.trim(), password });
      navigate(from, { replace: true });
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
      eyebrow="ยินดีต้อนรับการกลับมา"
      title="เข้าสู่ระบบเพื่อเล่นได้เลย"
      subtitle="อย่าปล่อยให้ ELO ของคุณหยุดนิ่ง ก่อนที่คนอื่นจะนำหน้าคุณไปไกล"
      footer={
        <>
          ยังไม่มีบัญชี?{' '}
          <Link to="/register" className="font-semibold text-brand-400 hover:underline">
            สร้างบัญชี
          </Link>{' '}
          เลย
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        {formError && <FormAlert message={formError} />}

        <TextField
          label="อีเมล หรือ ชื่อผู้ใช้"
          name="identifier"
          autoComplete="username"
          autoFocus
          required
          icon={<UserIcon />}
          placeholder="natakrit หรือ natakrit@rubik.com"
          value={identifier}
          error={fieldErrors.identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />

        <div>
          <TextField
            label="รหัสผ่าน"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            icon={<LockIcon />}
            value={password}
            error={fieldErrors.password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="mt-2 text-right">
            <Link to="/forgot-password" className="text-sm text-brand-400 hover:underline">
              ลืมรหัสผ่าน?
            </Link>
          </p>
        </div>

        <SubmitButton loading={loading}>เข้าสู่ระบบ</SubmitButton>
      </form>

      <OrDivider />
      {/* ส่งหน้าที่ RequireAuth เด้งมาไปด้วย — ล็อกอินด้วย Google แล้วกลับที่เดิมเหมือนล็อกอินด้วยรหัสผ่าน */}
      <GoogleButton label="เข้าสู่ระบบด้วย Google" returnTo={from} />
    </AuthLayout>
  );
}
