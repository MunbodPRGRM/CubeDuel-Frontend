import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { AppHeader } from '@/components/AppHeader';
import { CubeCanvas } from '@/components/CubeCanvas';
import { CubeSkinPicker } from '@/components/CubeSkinPicker';
import { CubeTypePicker } from '@/components/CubeTypePicker';
import { FormAlert } from '@/components/FormAlert';
import { PageSpinner } from '@/components/PageSpinner';
import { DEFAULT_SKIN_ID, getSkin } from '@/cube';
import { errorMessage } from '@/lib/errors';
import type { CubeType } from '@/types/cube';

/**
 * หน้าเลือกสกินสีคิวบ์ (ADR-064) — ย้ายออกมาจากแท็บโปรไฟล์ของ `/settings`
 *
 * พรีวิวเป็นคิวบ์ **ตัวเดียว** สลับประเภทด้วยแท็บ ไม่ใช่วาดทั้ง 4 ประเภทพร้อมกัน
 * (แต่ละตัวคือ WebGL context ของตัวเอง — ADR-044 ข้อ 4) · รายการสกินเป็นชิปสีล้วนจึงไม่มีต้นทุน
 *
 * เลือกแล้วเห็นผลทันทีในพรีวิว แต่ **ต้องกดบันทึก** ถึงจะลงบัญชี (`PATCH /users/me`)
 * — ระหว่างนั้นที่อื่นทั้งแอปยังเห็นสกินเดิมของบัญชีอยู่
 */
export default function SkinsPage() {
  const { user, status, updateProfile } = useAuth();
  const [cubeType, setCubeType] = useState<CubeType>('3x3x3');
  const [skinId, setSkinId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (status === 'loading' || !user) return <PageSpinner />;

  const savedSkin = user.cubeSkin || DEFAULT_SKIN_ID;
  // `null` = ยังไม่ได้แตะอะไร → ใช้ของบัญชี · ตั้งเป็น state แยกเพื่อให้ "ยกเลิก" กลับมาที่นี่ได้เสมอ
  const previewSkin = skinId ?? savedSkin;
  const dirty = previewSkin !== savedSkin;

  async function save() {
    setError(null);
    setSaving(true);
    try {
      await updateProfile({ cubeSkin: previewSkin });
      setSkinId(null);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err, 'บันทึกสกินไม่สำเร็จ'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-navy-900">
      <AppHeader />
      <main className="page-wide px-4 py-8">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-brand-400">การตั้งค่า</p>
            <h1 className="text-3xl font-bold text-white">สกินสีคิวบ์</h1>
            <p className="mt-1 text-sm text-slate-500">
              เปลี่ยนสีของคิวบ์ 3 มิติทุกห้อง — เห็นเฉพาะฝั่งคุณ ไม่กระทบคู่แข่ง
            </p>
          </div>
          <Link
            to="/settings"
            className="rounded-xl border border-line bg-navy-850 px-4 py-2 text-sm text-slate-300 transition hover:bg-navy-800 hover:text-white"
          >
            กลับไปหน้าตั้งค่า
          </Link>
        </header>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          {/* ---------------- ซ้าย: พรีวิว 3 มิติ ---------------- */}
          <section className="rounded-2xl border border-line bg-navy-850/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CubeTypePicker value={cubeType} onChange={setCubeType} />
              <p className="text-xs text-slate-500">ลากเพื่อหมุนดูรอบ ๆ · บิดเล่นได้ตามใจ</p>
            </div>

            {/*
              คิวบ์ครบสีตั้งแต่เข้าหน้า (`scramble = null`) แล้วให้ผู้ใช้บิดเองถ้าอยากเห็นสีปนกัน
              — ไม่ขอ scramble จาก server เพราะหน้านี้ไม่มีนาฬิกาและไม่บันทึกอะไร (ADR-064 ข้อ 4)
              `skinId` ทับสกินของบัญชี เพราะสิ่งที่ดูอยู่อาจยังไม่ได้บันทึก
            */}
            <div className="mt-3 h-[55vh] min-h-[20rem] overflow-hidden rounded-xl bg-navy-950/40">
              <CubeCanvas cubeType={cubeType} scramble={null} turnsEnabled skinId={previewSkin} />
            </div>
          </section>

          {/* ---------------- ขวา: รายการสกิน + ปุ่มบันทึก ---------------- */}
          <aside className="flex flex-col gap-3 rounded-2xl border border-line bg-navy-850/80 p-4">
            <div>
              <h2 className="font-semibold text-slate-100">เลือกสกิน</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                ชิปสีคือสีของหน้า U · D · F · B · R · L ตามลำดับ
              </p>
            </div>

            <CubeSkinPicker value={previewSkin} onChange={setSkinId} />

            {error && <FormAlert message={error} />}

            {dirty ? (
              <p className="rounded-xl border border-gold-400/40 bg-gold-400/10 px-3 py-2 text-xs leading-5 text-gold-400">
                กำลังลองสกิน “{getSkin(previewSkin).label}” อยู่ · ยังไม่ได้บันทึก
                ห้องอื่นยังเห็นสกิน “{getSkin(savedSkin).label}” เหมือนเดิม
              </p>
            ) : (
              saved && <p className="text-sm text-win">บันทึกแล้ว · ใช้กับคิวบ์ทุกลูกทันที</p>
            )}

            <div className="mt-auto grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSkinId(null);
                  setError(null);
                  setSaved(false);
                }}
                disabled={!dirty || saving}
                className="rounded-xl border border-line bg-navy-800 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={!dirty || saving}
                className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-500/40"
              >
                {saving ? 'กำลังบันทึก…' : 'บันทึก'}
              </button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
