import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Pagination } from '@/components/Pagination';
import { useApiPage } from '@/hooks/useApiPage';
import { apiFetch, apiUpload, fileUrl } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatNewsDate, type NewsListItem } from '@/types/news';
import { AdminDialog } from './AdminDialog';
import { AdminLayout, AdminNotice } from './AdminLayout';

const PAGE_SIZE = 10;
/** ต้องตรงกับกฎฝั่ง server (api-contract.md ข้อ 7) — ตรวจฝั่งนี้เพื่อบอกผู้ใช้ก่อนอัปโหลดเสียเที่ยว */
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** เขียน/แก้/ลบข่าวของแอดมิน (`POST/PATCH/DELETE /admin/news` — api-contract.md ข้อ 7) */
export default function AdminNewsPage() {
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<NewsListItem | 'new' | null>(null);

  const news = useApiPage<NewsListItem>(`/news?page=${page}&limit=${PAGE_SIZE}&_=${reloadKey}`);

  function reload() {
    setEditing(null);
    setReloadKey((k) => k + 1);
  }

  return (
    <AdminLayout
      title="ข่าวสารและกิจกรรม"
      description="ข่าวที่สร้างที่นี่ขึ้นหน้าผู้ใช้ทันที"
      actions={
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
        >
          + เขียนข่าวใหม่
        </button>
      }
    >
      {news.error && (
        <AdminNotice tone="error" onRetry={news.reload}>
          {news.error}
        </AdminNotice>
      )}
      {news.data?.length === 0 && !news.loading && <AdminNotice>ยังไม่มีข่าว</AdminNotice>}

      <div className={`space-y-3 ${news.loading ? 'opacity-60' : ''}`}>
        {news.data?.map((item) => (
          <NewsRow
            key={item.newsId}
            news={item}
            onEdit={() => setEditing(item)}
            onDeleted={reload}
          />
        ))}
      </div>

      {news.meta && news.meta.totalPages > 1 && (
        <div className="mt-2 rounded-2xl border border-line bg-navy-850/40">
          <Pagination
            page={news.meta.page}
            totalPages={news.meta.totalPages}
            total={news.meta.total}
            unitLabel="ข่าว"
            onChange={setPage}
            disabled={news.loading}
          />
        </div>
      )}

      {editing && (
        <NewsEditor
          news={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
    </AdminLayout>
  );
}

function NewsRow({
  news,
  onEdit,
  onDeleted,
}: {
  news: NewsListItem;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setError(null);
    setWorking(true);
    try {
      await apiFetch(`/admin/news/${news.newsId}`, { method: 'DELETE' });
      onDeleted();
    } catch (err) {
      setError(errorMessage(err, 'ลบข่าวไม่สำเร็จ'));
      setWorking(false);
    }
  }

  return (
    <article className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-navy-850/80 px-5 py-4">
      {news.image ? (
        <img
          src={fileUrl(news.image)}
          alt=""
          className="h-16 w-24 shrink-0 rounded-xl border border-line object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="grid h-16 w-24 shrink-0 place-items-center rounded-xl border border-line bg-navy-900 text-lg"
        >
          📰
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500">
          #{news.newsId} · {formatNewsDate(news.createdAt)}
        </p>
        <Link
          to={`/news/${news.newsId}`}
          className="mt-0.5 block truncate font-semibold text-slate-100 transition hover:text-white"
        >
          {news.title}
        </Link>
        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{news.excerpt}</p>
        {error && <p className="mt-1 text-xs text-loss">{error}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg border border-line px-3 py-1.5 text-xs text-slate-300 transition hover:bg-navy-800"
        >
          แก้ไข
        </button>
        {confirming ? (
          <>
            <button
              type="button"
              onClick={() => void remove()}
              disabled={working}
              className="rounded-lg bg-loss px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {working ? 'กำลังลบ…' : 'ยืนยันลบ'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-xs text-slate-400 transition hover:text-slate-200"
            >
              ยกเลิก
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-lg border border-loss/40 px-3 py-1.5 text-xs text-loss transition hover:bg-loss/10"
          >
            ลบ
          </button>
        )}
      </div>
    </article>
  );
}

/**
 * ฟอร์มเขียน/แก้ข่าว
 *
 * เนื้อข่าวเป็น **ข้อความล้วน** ไม่ใช่ HTML (ADR-049 ข้อ 3) — ช่องนี้จึงเป็น `<textarea>` ธรรมดา
 * ไม่มี rich text editor และไม่ต้องมี
 */
function NewsEditor({
  news,
  onClose,
  onSaved,
}: {
  news: NewsListItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editingExisting = news !== null;
  const [title, setTitle] = useState(news?.title ?? '');
  const [content, setContent] = useState('');
  const [contentLoaded, setContentLoaded] = useState(!editingExisting);
  const [file, setFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // รายการข่าวส่งมาแค่ `excerpt` → ตอนแก้ต้องดึงเนื้อเต็มจาก endpoint รายตัวก่อน (ADR-049 ข้อ 4)
  const newsId = news?.newsId;
  useEffect(() => {
    if (newsId === undefined) return;
    let cancelled = false;
    void apiFetch<{ content: string }>(`/news/${newsId}`)
      .then((full) => {
        if (!cancelled) setContent(full.content);
      })
      .catch(() => {
        if (!cancelled) setError('โหลดเนื้อข่าวเดิมไม่สำเร็จ');
      })
      .finally(() => {
        if (!cancelled) setContentLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [newsId]);

  function pickFile(picked: File | null) {
    setError(null);
    if (!picked) return setFile(null);
    if (!ACCEPTED_TYPES.includes(picked.type)) {
      return setError('รับเฉพาะไฟล์รูป JPEG / PNG / WebP');
    }
    if (picked.size > MAX_IMAGE_BYTES) return setError('ไฟล์รูปต้องมีขนาดไม่เกิน 2 MB');
    setFile(picked);
    setRemoveImage(false);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (file) {
        // มีไฟล์ = ต้องส่งเป็น multipart (JSON แนบไฟล์ไม่ได้)
        const form = new FormData();
        form.append('title', title.trim());
        form.append('content', content.trim());
        form.append('image', file);
        await apiUpload(
          editingExisting ? `/admin/news/${news.newsId}` : '/admin/news',
          form,
          editingExisting ? 'PATCH' : 'POST',
        );
      } else {
        const body: Record<string, unknown> = { title: title.trim(), content: content.trim() };
        if (editingExisting && removeImage) body.removeImage = true;
        await apiFetch(editingExisting ? `/admin/news/${news.newsId}` : '/admin/news', {
          method: editingExisting ? 'PATCH' : 'POST',
          body,
        });
      }
      onSaved();
    } catch (err) {
      setError(errorMessage(err, 'บันทึกข่าวไม่สำเร็จ'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminDialog
      title={editingExisting ? `แก้ไขข่าว #${news.newsId}` : 'เขียนข่าวใหม่'}
      subtitle="เนื้อหาเป็นข้อความล้วน — ขึ้นบรรทัดใหม่ได้ แต่ใส่ HTML ไม่ได้"
      onClose={onClose}
    >
      <form onSubmit={(e) => void save(e)} className="space-y-4">
        <label className="block">
          <span className="text-sm text-slate-300">หัวข้อข่าว</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={150}
            className="mt-1 w-full rounded-xl border border-line bg-navy-950/60 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-brand-500"
          />
        </label>

        <label className="block">
          <span className="text-sm text-slate-300">เนื้อหา</span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={8}
            maxLength={20000}
            placeholder={contentLoaded ? '' : 'กำลังโหลดเนื้อข่าวเดิม…'}
            className="mt-1 w-full rounded-xl border border-line bg-navy-950/60 px-4 py-2.5 text-sm leading-6 text-slate-100 outline-none focus:border-brand-500"
          />
        </label>

        <div>
          <span className="text-sm text-slate-300">รูปประกอบ (ไม่บังคับ)</span>
          <p className="mt-0.5 text-xs text-slate-500">JPEG / PNG / WebP ไม่เกิน 2 MB</p>

          {news?.image && !file && !removeImage && (
            <div className="mt-2 flex items-center gap-3">
              <img
                src={fileUrl(news.image)}
                alt=""
                className="h-16 w-24 rounded-xl border border-line object-cover"
              />
              <button
                type="button"
                onClick={() => setRemoveImage(true)}
                className="text-xs text-loss transition hover:underline"
              >
                เอารูปออก
              </button>
            </div>
          )}
          {removeImage && (
            <p className="mt-2 text-xs text-loss">
              จะเอารูปออกตอนบันทึก ·{' '}
              <button
                type="button"
                onClick={() => setRemoveImage(false)}
                className="text-slate-400 underline"
              >
                ยกเลิก
              </button>
            </p>
          )}

          <input
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border file:border-line file:bg-navy-800 file:px-3 file:py-1.5 file:text-xs file:text-slate-200"
          />
          {file && <p className="mt-1 text-xs text-win">เลือกไฟล์ {file.name} แล้ว</p>}
        </div>

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
            disabled={saving || !contentLoaded}
            className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-500/40"
          >
            {saving ? 'กำลังบันทึก…' : editingExisting ? 'บันทึกการแก้ไข' : 'เผยแพร่ข่าว'}
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}
