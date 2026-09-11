import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Pagination } from '@/components/Pagination';
import { useApiData } from '@/hooks/useApiData';
import { useApiPage } from '@/hooks/useApiPage';
import { apiFetch } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { CUBE_TYPES, type CubeType } from '@/types/cube';
import { CUBE_TYPE_LABEL, type UserRating } from '@/types/leaderboard';
import { formatAdminDate, type AdminUser } from '@/types/admin';
import { AdminDialog } from './AdminDialog';
import { AdminLayout, AdminNotice } from './AdminLayout';

const PAGE_SIZE = 20;
const STATUS_TABS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'active', label: 'ใช้งานอยู่' },
  { value: 'suspended', label: 'ถูกระงับ' },
  { value: 'deleted', label: 'ลบบัญชีแล้ว' },
] as const;

/**
 * จัดการบัญชีผู้ใช้ (`GET /admin/users` + `PATCH .../status` + `PATCH .../rating`)
 *
 * คำค้นกับตัวกรองเก็บใน query string เหมือนหน้ากระดานอันดับ — แอดมินจะได้ส่งลิงก์
 * "รายชื่อคนที่ถูกระงับ" ให้กันได้ และกดย้อนกลับแล้วไม่หลุดตัวกรอง
 */
export default function AdminUsersPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const status = params.get('status') ?? 'all';
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);

  const [keyword, setKeyword] = useState(q);
  /** เพิ่มทีละหนึ่งหลังทุกการเปลี่ยนแปลง เพื่อบังคับให้ตารางโหลดใหม่ (path เปลี่ยน = ดึงใหม่) */
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<AdminUser | null>(null);

  const users = useApiPage<AdminUser>(
    `/admin/users?page=${page}&limit=${PAGE_SIZE}&status=${status}` +
      `${q ? `&q=${encodeURIComponent(q)}` : ''}&_=${reloadKey}`,
  );

  function update(next: Record<string, string>) {
    const merged: Record<string, string> = { q, status, ...next };
    // ค่าเริ่มต้นไม่ต้องโผล่ใน URL — ลิงก์จะได้สั้นและอ่านออก
    const clean = Object.fromEntries(
      Object.entries(merged).filter(
        ([key, value]) => value && !(key === 'status' && value === 'all'),
      ),
    );
    setParams(clean);
  }

  function search(e: FormEvent) {
    e.preventDefault();
    update({ q: keyword.trim(), page: '' });
  }

  return (
    <AdminLayout title="บัญชีผู้ใช้" description="ค้นหา · ระงับ/ปลดระงับ · แก้คะแนน Elo">
      <form onSubmit={search} className="flex flex-wrap items-center gap-2">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="ค้นหาชื่อผู้ใช้ · อีเมล · ชื่อเล่น"
          className="min-w-56 flex-1 rounded-xl border border-line bg-navy-950/60 px-4 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-brand-500"
        />
        <button
          type="submit"
          className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
        >
          ค้นหา
        </button>
        {q && (
          <button
            type="button"
            onClick={() => {
              setKeyword('');
              update({ q: '', page: '' });
            }}
            className="text-sm text-slate-400 transition hover:text-slate-200"
          >
            ล้างคำค้น
          </button>
        )}
      </form>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => update({ status: tab.value, page: '' })}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              status === tab.value
                ? 'bg-brand-500 font-medium text-white'
                : 'border border-line text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {users.error && (
        <div className="mt-4">
          <AdminNotice tone="error" onRetry={users.reload}>
            {users.error}
          </AdminNotice>
        </div>
      )}
      {users.data?.length === 0 && !users.loading && (
        <div className="mt-4">
          <AdminNotice>ไม่พบผู้ใช้ตามเงื่อนไขนี้</AdminNotice>
        </div>
      )}

      {!!users.data?.length && (
        <div
          className={`mt-4 overflow-hidden rounded-2xl border border-line bg-navy-850/80 ${
            users.loading ? 'opacity-60' : ''
          }`}
        >
          <ul className="divide-y divide-line-soft">
            {users.data.map((user) => (
              <UserRow
                key={user.userId}
                user={user}
                onChanged={() => setReloadKey((k) => k + 1)}
                onEditRating={() => setEditing(user)}
              />
            ))}
          </ul>
          {users.meta && (
            <Pagination
              page={users.meta.page}
              totalPages={users.meta.totalPages}
              total={users.meta.total}
              unitLabel="บัญชี"
              onChange={(next) => update({ page: String(next) })}
              disabled={users.loading}
            />
          )}
        </div>
      )}

      {editing && (
        <RatingDialog
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </AdminLayout>
  );
}

function UserRow({
  user,
  onChanged,
  onEditRating,
}: {
  user: AdminUser;
  onChanged: () => void;
  onEditRating: () => void;
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deleted = user.deletedAt !== null;

  async function toggleStatus() {
    setError(null);
    setWorking(true);
    try {
      await apiFetch(`/admin/users/${user.userId}/status`, {
        method: 'PATCH',
        body: { status: user.status === 'active' ? 'suspended' : 'active' },
      });
      onChanged();
    } catch (err) {
      setError(errorMessage(err, 'เปลี่ยนสถานะไม่สำเร็จ'));
    } finally {
      setWorking(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <Link
            to={`/users/${user.userId}`}
            className="truncate font-medium text-slate-100 transition hover:text-white"
          >
            {user.nickname || user.username}
          </Link>
          <span className="text-xs text-slate-500">@{user.username}</span>
          {user.role === 'admin' && (
            <span className="rounded-md border border-brand-500/40 px-1.5 py-0.5 text-[11px] text-brand-400">
              แอดมิน
            </span>
          )}
          <StatusBadge status={user.status} deleted={deleted} />
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {user.email} · สมัคร {formatAdminDate(user.createdAt)}
          {user.suspendedUntil && ` · ระงับถึง ${formatAdminDate(user.suspendedUntil)}`}
        </p>
        {(user.reportCount > 0 || user.flagCount > 0) && (
          <p className="mt-0.5 text-xs text-gold-400">
            ถูกรายงาน {user.reportCount} ครั้ง · ถูก flag {user.flagCount} ครั้ง
          </p>
        )}
        {error && <p className="mt-1 text-xs text-loss">{error}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onEditRating}
          disabled={deleted}
          className="rounded-lg border border-line px-3 py-1.5 text-xs text-slate-300 transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:text-slate-600"
        >
          แก้คะแนน
        </button>
        <button
          type="button"
          onClick={() => void toggleStatus()}
          // บัญชีที่ผู้ใช้ลบเองแก้สถานะไม่ได้ (server ตอบ 400 อยู่แล้ว — ADR-050 ข้อ 8)
          disabled={working || deleted}
          className={`rounded-lg border px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${
            user.status === 'active'
              ? 'border-loss/40 text-loss hover:bg-loss/10'
              : 'border-win/40 text-win hover:bg-win/10'
          }`}
        >
          {working ? '…' : user.status === 'active' ? 'ระงับ' : 'ปลดระงับ'}
        </button>
      </div>
    </li>
  );
}

function StatusBadge({ status, deleted }: { status: AdminUser['status']; deleted: boolean }) {
  if (deleted) {
    return (
      <span className="rounded-md border border-line px-1.5 py-0.5 text-[11px] text-slate-500">
        ลบบัญชีแล้ว
      </span>
    );
  }
  return status === 'suspended' ? (
    <span className="rounded-md border border-loss/40 px-1.5 py-0.5 text-[11px] text-loss">
      ถูกระงับ
    </span>
  ) : null;
}

/** แก้คะแนน Elo ทีละประเภท — แสดงคะแนนปัจจุบันของทั้ง 4 ประเภทให้เห็นก่อนแก้ */
function RatingDialog({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  // endpoint นี้คืนทั้ง 4 ประเภทในก้อนเดียว ไม่มี `meta` → ใช้ `useApiData` ไม่ใช่ `useApiPage`
  const ratings = useApiData<UserRating[]>(`/users/${user.userId}/ratings`);
  const [cubeType, setCubeType] = useState<CubeType>('3x3x3');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = ratings.data?.find((r) => r.cubeType === cubeType);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch(`/admin/users/${user.userId}/rating`, {
        method: 'PATCH',
        body: { cubeType, eloRating: Number(value), note: note.trim() || null },
      });
      onSaved();
    } catch (err) {
      setError(errorMessage(err, 'แก้คะแนนไม่สำเร็จ'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminDialog
      title={`แก้คะแนน — ${user.nickname || user.username}`}
      subtitle="แก้เฉพาะคะแนนปัจจุบันของประเภทที่เลือก ไม่ย้อนแก้ผลแมตช์เก่า"
      onClose={onClose}
    >
      <form onSubmit={(e) => void save(e)} className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {CUBE_TYPES.map((type) => {
            const rating = ratings.data?.find((r) => r.cubeType === type);
            const active = type === cubeType;
            return (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setCubeType(type);
                  setValue('');
                }}
                className={`rounded-xl border px-3 py-2 text-left transition ${
                  active ? 'border-brand-500/60 bg-brand-500/10' : 'border-line hover:bg-navy-800'
                }`}
              >
                <span className="block text-xs text-slate-400">{CUBE_TYPE_LABEL[type]}</span>
                <span className="tabular block text-sm font-semibold text-slate-100">
                  {rating ? rating.eloRating : '—'}
                </span>
              </button>
            );
          })}
        </div>

        <label className="block">
          <span className="text-sm text-slate-300">คะแนนใหม่ (0–4000)</span>
          <input
            type="number"
            min={0}
            max={4000}
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={current ? String(current.eloRating) : '1000'}
            className="tabular mt-1 w-full rounded-xl border border-line bg-navy-950/60 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-brand-500"
          />
        </label>

        <label className="block">
          <span className="text-sm text-slate-300">เหตุผล (เก็บลง log)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="เช่น แก้คะแนนหลังตรวจสอบรายงาน #12"
            className="mt-1 w-full rounded-xl border border-line bg-navy-950/60 px-4 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand-500"
          />
        </label>

        {error && <p className="text-sm text-loss">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line px-5 py-2.5 text-sm text-slate-300 transition hover:bg-navy-800"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={saving || value === ''}
            className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-500/40"
          >
            {saving ? 'กำลังบันทึก…' : 'บันทึกคะแนน'}
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}
