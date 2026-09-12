import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { AppHeader } from '@/components/AppHeader';
import { SkinSwatches } from '@/components/CubeSkinPicker';
import { FormAlert } from '@/components/FormAlert';
import { PageSpinner } from '@/components/PageSpinner';
import { TextField } from '@/components/TextField';
import { useApiData } from '@/hooks/useApiData';
import { ApiError, apiFetch } from '@/lib/api';
import { getSkin } from '@/cube';
import { errorMessage } from '@/lib/errors';
import { BIO_MAX_LENGTH, BIO_MAX_LINES } from '@/lib/validation';
import { displayName, type SelfUser } from '@/types/auth';
import type { UserRating } from '@/types/leaderboard';

type Tab = 'profile' | 'security';

/**
 * หน้าตั้งค่าบัญชี (`design/Profile - Settings - 1.png` + `- 2.png`)
 *
 * ต่างจากดีไซน์สามจุด เพราะดีไซน์วาดของที่ระบบไม่มีที่เก็บ/ไม่ยอมให้แก้ (ADR-048):
 *   1. `username` กับ `email` เป็นช่อง **อ่านอย่างเดียว** (ข้อ 1)
 *   2. ~~ช่อง "รายละเอียดเพิ่มเติม" (bio) ไม่มีคอลัมน์รองรับ~~ → **มีแล้วตั้งแต่เฟส 12 ก้อนที่ 9** (ADR-066)
 *      · สกินที่เคยมายืนแทนที่ตรงนี้ย้ายไปหน้า `/skins` ของตัวเองแล้ว เหลือชิปสี + ลิงก์ (ADR-064 ข้อ 5)
 *   3. แท็บความปลอดภัยเพิ่มช่อง **รหัสผ่านปัจจุบัน** ที่ดีไซน์ไม่ได้วาดไว้ — API บังคับ (ข้อ 3)
 *      · บัญชี Google ที่ยังไม่มีรหัสผ่าน (`hasPassword = false`) ไม่ถามทั้งรหัสเดิมและรหัสยืนยันตอนลบบัญชี (ADR-058 ข้อ 6)
 */
export default function SettingsPage() {
  const { user, status } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');

  if (status === 'loading' || !user) return <PageSpinner />;

  return (
    <div className="min-h-screen bg-navy-900">
      <AppHeader />
      <main className="page-wide grid gap-6 px-4 py-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <SettingsSidebar user={user} tab={tab} onTabChange={setTab} />
        <section>
          <header className="mb-4">
            <p className="text-sm text-brand-400">การตั้งค่า</p>
            <h1 className="text-3xl font-bold text-white">บัญชี และ โปรไฟล์</h1>
          </header>
          {tab === 'profile' ? <ProfilePanel user={user} /> : <SecurityPanel user={user} />}
        </section>
      </main>
    </div>
  );
}

function SettingsSidebar({
  user,
  tab,
  onTabChange,
}: {
  user: SelfUser;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
}) {
  // ELO ในการ์ดใช้ของ 3x3x3 เป็นตัวแทน เหมือนแถบบน (คะแนนแยกกัน 4 ประเภท)
  const ratings = useApiData<UserRating[]>(`/users/${user.userId}/ratings`);
  const elo = ratings.data?.find((r) => r.cubeType === '3x3x3')?.eloRating;
  const name = displayName(user);

  return (
    <aside>
      <div className="flex items-center gap-4 rounded-2xl border border-line bg-navy-850/80 px-5 py-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 border-brand-400/70 bg-navy-800 text-xl font-semibold text-slate-200">
          {name.trim().charAt(0).toUpperCase() || '?'}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-100">{name}</p>
          <p className="tabular text-sm text-brand-400">
            {elo === undefined ? '— ELO' : `${elo} ELO`}
          </p>
        </div>
      </div>

      <p className="mt-6 px-1 text-sm text-slate-500">การตั้งค่า</p>
      <nav className="mt-2 space-y-1">
        <TabButton active={tab === 'profile'} onClick={() => onTabChange('profile')}>
          โปรไฟล์
        </TabButton>
        <TabButton active={tab === 'security'} onClick={() => onTabChange('security')}>
          ความปลอดภัย
        </TabButton>
      </nav>
    </aside>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl px-4 py-2.5 text-left text-sm transition ${
        active ? 'bg-navy-800 font-medium text-white' : 'text-slate-400 hover:bg-navy-850'
      }`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- แท็บโปรไฟล์

function ProfilePanel({ user }: { user: SelfUser }) {
  const { updateProfile } = useAuth();
  const [nickname, setNickname] = useState(user.nickname ?? '');
  const [bio, setBio] = useState(user.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [bioError, setBioError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  // ต้องนับ bio ด้วย ไม่งั้นแก้แต่ bio แล้วปุ่มบันทึกไม่ติด
  const dirty = nickname.trim() !== (user.nickname ?? '') || bio.trim() !== (user.bio ?? '');

  function reset() {
    setNickname(user.nickname ?? '');
    setBio(user.bio ?? '');
    setError(null);
    setFieldError(undefined);
    setBioError(undefined);
    setSaved(false);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldError(undefined);
    setBioError(undefined);
    setSaving(true);
    try {
      // ช่องว่างล้วน = ล้างทิ้ง ทั้งชื่อเล่นและ bio (api-contract.md ข้อ 3)
      // server normalize `bio` ให้อีกชั้น (ตัดบรรทัดว่างซ้อน/อักขระล่องหน) — ค่าที่ตอบกลับมาจึงไม่ตรงกับที่พิมพ์เป๊ะได้ (ADR-066 ข้อ 4)
      // สกินไม่ได้อยู่ในฟอร์มนี้แล้ว จึงไม่ส่งมาด้วย (`PATCH` แตะเฉพาะช่องที่ส่ง — ADR-064 ข้อ 1)
      const updated = await updateProfile({
        nickname: nickname.trim() || null,
        bio: bio.trim() || null,
      });
      // เอาค่าที่ผ่าน normalize แล้วมาทับช่องกรอก ไม่งั้นฟอร์มค้างสถานะ "ยังไม่บันทึก" ทั้งที่บันทึกไปแล้ว
      setNickname(updated.nickname ?? '');
      setBio(updated.bio ?? '');
      setSaved(true);
    } catch (err) {
      setFieldError(err instanceof ApiError ? err.fields?.nickname : undefined);
      setBioError(err instanceof ApiError ? err.fields?.bio : undefined);
      setError(errorMessage(err, 'บันทึกไม่สำเร็จ'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void save(e)}>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
        {saved && !dirty && <span className="mr-auto text-sm text-win">บันทึกแล้ว</span>}
        <button
          type="button"
          onClick={reset}
          disabled={!dirty || saving}
          className="text-sm text-slate-400 transition hover:text-slate-200 disabled:cursor-not-allowed disabled:text-slate-600"
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          disabled={!dirty || saving}
          className="rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-500/40"
        >
          {saving ? 'กำลังบันทึก…' : 'บันทึก'}
        </button>
      </div>

      <div className="space-y-6 rounded-2xl border border-line bg-navy-850/80 px-6 py-6 sm:px-8">
        <div>
          <h2 className="text-xl font-semibold text-white">โปรไฟล์</h2>
          <p className="text-sm text-slate-500">ตั้งค่าข้อมูลส่วนตัวของคุณ</p>
        </div>
        {error && <FormAlert message={error} />}

        <Row
          label="รูปโปรไฟล์"
          hint="รูปโปรไฟล์จะมาจากตัวอักษรตัวแรกของชื่อเล่น ไม่สามารถเลือกรูปได้"
        >
          <span className="grid h-16 w-16 place-items-center rounded-full border-2 border-brand-400/70 bg-navy-800 text-2xl font-semibold text-slate-200">
            {(nickname.trim() || user.username).charAt(0).toUpperCase()}
          </span>
        </Row>

        <Row label="ชื่อผู้ใช้" hint="ใช้เข้าสู่ระบบและแสดงในประวัติการแข่ง — เปลี่ยนไม่ได้">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 grid w-11 place-items-center text-slate-500">
              @
            </span>
            <input
              value={user.username}
              readOnly
              disabled
              aria-label="ชื่อผู้ใช้"
              className="w-full cursor-not-allowed rounded-xl border border-line bg-navy-950/40 py-3 pl-11 pr-4 text-sm text-slate-400"
            />
          </div>
        </Row>

        <Row
          label="ชื่อเล่น"
          hint="จะแสดงที่หน้าโปรไฟล์และแสดงเป็นชื่อหลัก (เว้นว่าง = ใช้ชื่อผู้ใช้)"
        >
          <TextField
            label=""
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={50}
            placeholder={user.username}
            error={fieldError}
          />
        </Row>

        {/* bio — เก็บเป็นข้อความล้วน ไม่มี markdown ไม่มีลิงก์กดได้ (ADR-066 ข้อ 3) */}
        <Row
          label="รายละเอียดเพิ่มเติม"
          hint="ข้อความแนะนำตัวที่แสดงในหน้าโปรไฟล์ของคุณ — ใครก็เห็นได้ (เว้นว่าง = ไม่แสดงอะไรเลย)"
        >
          <div className="flex flex-col gap-2">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              maxLength={BIO_MAX_LENGTH}
              aria-label="รายละเอียดเพิ่มเติม"
              aria-invalid={bioError ? true : undefined}
              placeholder="เช่น เล่น 3x3 มา 2 ปี ชอบ pyraminx ที่สุด"
              className={`w-full resize-y rounded-xl border bg-navy-950/60 px-4 py-3 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:ring-2 focus:ring-brand-500/25 ${
                bioError ? 'border-loss/70 focus:border-loss' : 'border-line focus:border-brand-500'
              }`}
            />
            <div className="flex items-start justify-between gap-3 text-xs">
              <span className={bioError ? 'text-loss' : 'text-slate-500'}>
                {bioError ?? `ไม่เกิน ${BIO_MAX_LENGTH} ตัวอักษร และ ${BIO_MAX_LINES} บรรทัด`}
              </span>
              <span
                className={`tabular shrink-0 ${
                  bio.length > BIO_MAX_LENGTH - 20 ? 'text-gold-400' : 'text-slate-500'
                }`}
              >
                {bio.length}/{BIO_MAX_LENGTH}
              </span>
            </div>
          </div>
        </Row>

        {/* สกินมีหน้าของตัวเองแล้ว (ADR-064) — ที่นี่เหลือไว้ให้ "หาเจอ" เพราะไม่มีเมนูหลักให้เดา */}
        <Row
          label="สกินสีคิวบ์"
          hint="เปลี่ยนสีของคิวบ์ 3 มิติทุกห้อง — เห็นเฉพาะฝั่งคุณ ไม่กระทบคู่แข่ง"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-navy-900/40 px-4 py-3">
            <div>
              <p className="text-sm text-slate-100">{getSkin(user.cubeSkin).label}</p>
              <div className="mt-2">
                <SkinSwatches skin={getSkin(user.cubeSkin)} size="sm" />
              </div>
            </div>
            <Link
              to="/skins"
              className="rounded-xl border border-line bg-navy-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-navy-700"
            >
              เลือกสกิน
            </Link>
          </div>
        </Row>
      </div>
    </form>
  );
}

/** แถวของฟอร์มตามดีไซน์: ป้าย + คำอธิบายอยู่ซ้าย ช่องกรอกอยู่ขวา (จอแคบซ้อนกันเป็นแนวตั้ง) */
function Row({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="grid gap-3 border-t border-line pt-5 sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)] sm:gap-8">
      <div>
        <p className="font-medium text-slate-200">{label}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------- แท็บความปลอดภัย

function SecurityPanel({ user }: { user: SelfUser }) {
  return (
    <div className="space-y-6 rounded-2xl border border-line bg-navy-850/80 px-6 py-6 sm:px-8">
      <div>
        <h2 className="text-xl font-semibold text-white">ความปลอดภัย</h2>
        <p className="text-sm text-slate-500">ตั้งค่าบัญชีเพื่อความปลอดภัย</p>
      </div>

      <Row label="อีเมล" hint="ใช้สำหรับการเข้าสู่ระบบ และใช้ตอนลืมรหัสผ่าน — เปลี่ยนไม่ได้">
        <input
          value={user.email}
          readOnly
          disabled
          aria-label="อีเมล"
          className="w-full cursor-not-allowed rounded-xl border border-line bg-navy-950/40 px-4 py-3 text-sm text-slate-400"
        />
      </Row>

      <ChangePasswordForm hasPassword={user.hasPassword} />
      <DeleteAccountSection hasPassword={user.hasPassword} />
    </div>
  );
}

function ChangePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFields({});
    if (next !== confirm) {
      setFields({ confirm: 'รหัสผ่านทั้งสองช่องไม่ตรงกัน' });
      return;
    }

    setSaving(true);
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        // บัญชีที่ยังไม่มีรหัสผ่านห้ามส่ง `currentPassword: ''` — server ตีกลับว่าสั้นเกิน
        body: hasPassword ? { currentPassword: current, newPassword: next } : { newPassword: next },
      });
      // server เพิกถอน refresh token ทุกอุปกรณ์หลังเปลี่ยนรหัสผ่าน (ADR-013) → ต้องเข้าสู่ระบบใหม่
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      setFields(err instanceof ApiError ? (err.fields ?? {}) : {});
      setError(errorMessage(err, 'เปลี่ยนรหัสผ่านไม่สำเร็จ'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-6">
      {error && <FormAlert message={error} />}

      {hasPassword ? (
        <Row label="รหัสผ่านปัจจุบัน" hint="ยืนยันว่าเป็นเจ้าของบัญชีจริงก่อนตั้งรหัสผ่านใหม่">
          <TextField
            label=""
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            error={fields.currentPassword}
          />
        </Row>
      ) : (
        <Row
          label="ตั้งรหัสผ่าน"
          hint="ตั้งไว้เพื่อเข้าสู่ระบบด้วยชื่อผู้ใช้หรืออีเมลได้อีกทาง นอกจาก Google"
        >
          <p className="rounded-xl border border-line bg-navy-950/40 px-4 py-3 text-sm text-slate-400">
            บัญชีนี้เข้าสู่ระบบด้วย Google และยังไม่มีรหัสผ่าน
          </p>
        </Row>
      )}

      <Row
        label="รหัสผ่านใหม่"
        hint="หากต้องการเปลี่ยนรหัสผ่านให้กรอกที่ช่องนี้ และกรอกอีกครั้งที่ช่องยืนยันรหัสผ่าน (อย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข)"
      >
        <TextField
          label=""
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          error={fields.newPassword}
        />
      </Row>

      <Row label="ยืนยันรหัสผ่าน" hint="กรอกรหัสผ่านที่เคยกรอกในช่องก่อนหน้านี้อีกครั้ง">
        <div>
          <TextField
            label=""
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={fields.confirm}
          />
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={saving || !next || !confirm}
              className="rounded-xl bg-win px-6 py-2.5 text-sm font-semibold text-navy-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? 'กำลังเปลี่ยน…' : 'ยืนยัน'}
            </button>
          </div>
        </div>
      </Row>
    </form>
  );
}

function DeleteAccountSection({ hasPassword }: { hasPassword: boolean }) {
  const { deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setError(null);
    setWorking(true);
    try {
      // ไม่มีรหัสผ่าน → ไม่ส่งช่องนี้เลย (server ยกเว้นให้บัญชี Google — api-contract.md ข้อ 2)
      await deleteAccount(hasPassword ? password : undefined);
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'ลบบัญชีไม่สำเร็จ'));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="border-t border-line pt-5">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-xl bg-loss px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110"
        >
          ลบบัญชี
        </button>
      ) : (
        <div className="rounded-xl border border-loss/40 bg-loss/5 px-5 py-4">
          <p className="text-sm font-semibold text-loss">ยืนยันการลบบัญชี</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            บัญชีจะถูกปิดถาวรและเข้าสู่ระบบไม่ได้อีก ·
            ประวัติการแข่งที่ผ่านมายังอยู่ในระบบเพื่อไม่ให้ผลของคู่แข่งเสียไป
            แต่ชื่อผู้ใช้จะถูกแทนที่ด้วยชื่อที่ระบุตัวตนไม่ได้ (ADR-008)
          </p>
          {error && (
            <div className="mt-3">
              <FormAlert message={error} />
            </div>
          )}
          {hasPassword && (
            <div className="mt-3 max-w-sm">
              <TextField
                label="รหัสผ่านเพื่อยืนยัน"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => void confirmDelete()}
              disabled={working}
              className="rounded-xl bg-loss px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {working ? 'กำลังลบ…' : 'ลบบัญชีถาวร'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-line px-5 py-2.5 text-sm text-slate-300 transition hover:bg-navy-800"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
