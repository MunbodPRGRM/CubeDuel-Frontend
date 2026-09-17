import { useState } from 'react';
import { useAuth } from '@/auth/useAuth';
import { AppHeader } from '@/components/AppHeader';
import { CubeCanvas } from '@/components/CubeCanvas';
import { CubeTypePicker } from '@/components/CubeTypePicker';
import { FormAlert } from '@/components/FormAlert';
import { PageSpinner } from '@/components/PageSpinner';
import { SkinGallery } from '@/components/skins/SkinGallery';
import { SkinSwatches } from '@/components/skins/SkinSwatches';
import { CUBE_SKINS, SKIN_CATEGORIES, getSkin } from '@/cube';
import { errorMessage } from '@/lib/errors';
import type { CubeType } from '@/types/cube';

/**
 * หน้าเลือกสกินสีคิวบ์ — **หน้าของมันเอง ไม่ใช่ลูกของหน้าตั้งค่า** (ADR-080 · ต่อยอด ADR-064)
 *
 * ซ้าย: ตัวกรองหมวด + การ์ดสกิน (รูป SVG ไม่มี WebGL) · ขวา: พรีวิว 3 มิติ **ตัวเดียว** สลับประเภทด้วยแท็บ
 * (แต่ละตัวคือ WebGL context ของตัวเอง — ADR-044 ข้อ 4) + ปุ่มบันทึก · จอแคบพรีวิวอยู่บน
 *
 * เลือกแล้วเห็นผลทันทีในพรีวิว แต่ **ต้องกดบันทึก** ถึงจะลงบัญชี (`PATCH /users/me`)
 * — ระหว่างนั้นที่อื่นทั้งแอปยังเห็นสกินเดิมของบัญชีอยู่ (ADR-064 ข้อ 3)
 */
export default function SkinsPage() {
  const { user, status, updateProfile } = useAuth();
  const [cubeType, setCubeType] = useState<CubeType>('3x3x3');
  const [skinId, setSkinId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (status === 'loading' || !user) return <PageSpinner />;

  // รหัสที่ไม่รู้จัก (ข้อมูลเก่า) ตกกลับไปสกินตั้งต้นเหมือน `getSkin()` — ป้าย "ใช้อยู่" จะได้ไม่หาย
  const savedSkin = getSkin(user.cubeSkin).id;
  // `null` = ยังไม่ได้แตะอะไร → ใช้ของบัญชี · ตั้งเป็น state แยกเพื่อให้ "ยกเลิก" กลับมาที่นี่ได้เสมอ
  const previewSkin = skinId ?? savedSkin;
  const dirty = previewSkin !== savedSkin;
  const preview = getSkin(previewSkin);
  const categoryLabel = SKIN_CATEGORIES.find((entry) => entry.id === preview.category)?.label;

  function choose(id: string) {
    setSkinId(id);
    setSaved(false);
    setError(null);
  }

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
    <div className="min-h-app bg-navy-900">
      <AppHeader />
      <main className="page-wide px-4 py-8">
        <header className="mb-6">
          <p className="text-sm text-brand-400">ปรับแต่งคิวบ์</p>
          <h1 className="text-3xl font-bold text-white">สกินคิวบ์</h1>
          <p className="mt-1 text-sm text-slate-500">
            {CUBE_SKINS.length} แบบ ฟรีทั้งหมด · เปลี่ยนสีคิวบ์ 3 มิติทุกห้อง — เห็นเฉพาะฝั่งคุณ
            ไม่กระทบคู่แข่ง
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start">
          {/* ---------------- ซ้าย: แกลเลอรี ---------------- */}
          <section aria-label="รายการสกิน">
            <SkinGallery value={previewSkin} savedId={savedSkin} onChange={choose} />
          </section>

          {/* ---------------- ขวา: พรีวิว + บันทึก (จอแคบขึ้นไปอยู่บน) ---------------- */}
          <aside className="order-first flex flex-col gap-3 rounded-2xl border border-line bg-navy-850/80 p-4 lg:sticky lg:top-6 lg:order-none">
            <CubeTypePicker value={cubeType} onChange={setCubeType} />

            {/*
              คิวบ์ครบสีตั้งแต่เข้าหน้า (`scramble = null`) แล้วให้ผู้ใช้บิดเองถ้าอยากเห็นสีปนกัน
              — ไม่ขอ scramble จาก server เพราะหน้านี้ไม่มีนาฬิกาและไม่บันทึกอะไร (ADR-064 ข้อ 4)
              `skinId` ทับสกินของบัญชี เพราะสิ่งที่ดูอยู่อาจยังไม่ได้บันทึก
            */}
            <div className="relative h-72 overflow-hidden rounded-xl bg-navy-950/40 lg:h-80">
              <CubeCanvas cubeType={cubeType} scramble={null} turnsEnabled skinId={previewSkin} />
              <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[11px] text-slate-500">
                ลากเพื่อหมุนดูรอบ ๆ · บิดเล่นได้ตามใจ
              </p>
            </div>

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-100">{preview.label}</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">{preview.hint}</p>
              </div>
              {categoryLabel && (
                <span className="shrink-0 rounded-md bg-navy-900/70 px-2 py-0.5 text-[11px] text-slate-400">
                  {categoryLabel}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <SkinSwatches skin={preview} />
              <span className="text-[11px] text-slate-600">U · D · F · B · R · L</span>
            </div>

            {error && <FormAlert message={error} />}

            {dirty ? (
              <p className="rounded-xl border border-gold-400/40 bg-gold-400/10 px-3 py-2 text-xs leading-5 text-gold-400">
                กำลังลองสกิน “{preview.label}” อยู่ · ยังไม่ได้บันทึก ห้องอื่นยังเห็นสกิน “
                {getSkin(savedSkin).label}” เหมือนเดิม
              </p>
            ) : (
              saved && <p className="text-sm text-win">บันทึกแล้ว · ใช้กับคิวบ์ทุกลูกทันที</p>
            )}

            <div className="grid grid-cols-2 gap-2.5 pt-1">
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
                {saving ? 'กำลังบันทึก…' : 'ใช้สกินนี้'}
              </button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
