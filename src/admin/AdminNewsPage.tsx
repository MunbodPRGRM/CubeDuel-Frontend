import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Pagination } from '@/components/Pagination';
import { useApiPage } from '@/hooks/useApiPage';
import { apiFetch } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatNewsDate, type NewsListItem } from '@/types/news';
import { NewsCover } from '@/news/NewsCover';
import { NEWS_COVERS, NEWS_COVER_STYLES, type NewsCover as NewsCoverKey } from '@/news/news-covers';
import { AdminDialog } from './AdminDialog';
import { AdminLayout, AdminNotice } from './AdminLayout';

const PAGE_SIZE = 10;

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
      <NewsCover cover={news.cover} size="thumb" />

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
 * ไม่มี rich text editor และไม่ต้องมี · ปกเลือกจากชุดที่เว็บวาดให้ ไม่มีอัปโหลดรูป (ADR-084)
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
  // ข่าวที่มีคีย์ปกที่หน้านี้ไม่รู้จัก (server รุ่นใหม่กว่า) ตั้งต้นที่ `general` — บันทึกแล้วจะถูกเขียนทับ
  const [cover, setCover] = useState<NewsCoverKey>(() => {
    const current = news?.cover ?? '';
    return (NEWS_COVERS as readonly string[]).includes(current)
      ? (current as NewsCoverKey)
      : 'general';
  });
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

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch(editingExisting ? `/admin/news/${news.newsId}` : '/admin/news', {
        method: editingExisting ? 'PATCH' : 'POST',
        body: { title: title.trim(), content: content.trim(), cover },
      });
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

        <fieldset>
          <legend className="text-sm text-slate-300">ปกข่าว</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {NEWS_COVERS.map((key) => {
              const style = NEWS_COVER_STYLES[key];
              const selected = key === cover;
              return (
                <label
                  key={key}
                  className={`cursor-pointer rounded-xl border p-1.5 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400 ${
                    selected
                      ? 'border-brand-500 bg-brand-500/10'
                      : 'border-line hover:border-slate-500'
                  }`}
                >
                  <input
                    type="radio"
                    name="news-cover"
                    value={key}
                    checked={selected}
                    onChange={() => setCover(key)}
                    className="sr-only"
                  />
                  <NewsCover cover={key} size="tile" />
                  <span className="mt-1.5 block px-0.5 text-xs font-semibold text-slate-100">
                    {style.label}
                  </span>
                  <span className="block px-0.5 text-[11px] leading-4 text-slate-500">
                    {style.hint}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

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
