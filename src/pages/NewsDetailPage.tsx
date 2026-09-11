import { Link, Navigate, useParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { ErrorNotice } from '@/components/ErrorScreen';
import { ShareButton } from '@/components/ShareButton';
import { useApiData } from '@/hooks/useApiData';
import { fileUrl } from '@/lib/api';
import { formatNewsDate, newsAuthorName, type NewsDetail } from '@/types/news';

/**
 * หน้าอ่านข่าวหนึ่งชิ้น (`GET /news/:newsId`)
 *
 * **เนื้อข่าวเป็นข้อความล้วน** — แสดงด้วย `whitespace-pre-line` เท่านั้น
 * ห้ามใช้ `dangerouslySetInnerHTML` เด็ดขาด ไม่งั้นแอดมินคนเดียวที่โดนขโมยบัญชี
 * ฝัง `<script>` ลงหน้าที่ผู้ใช้ทุกคนเปิดได้ (ADR-049 ข้อ 3)
 */
export default function NewsDetailPage() {
  const { newsId: param } = useParams();
  const newsId = Number(param);
  const news = useApiData<NewsDetail>(newsId > 0 ? `/news/${newsId}` : null);

  if (!Number.isInteger(newsId) || newsId <= 0) return <Navigate to="/404" replace />;

  return (
    <div className="min-h-screen bg-navy-900">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link to="/news" className="text-sm text-slate-400 transition hover:text-slate-200">
          ← ข่าวสารทั้งหมด
        </Link>

        {news.loading && (
          <p className="mt-6 rounded-2xl border border-line bg-navy-850/80 px-6 py-12 text-center text-sm text-slate-500">
            กำลังโหลด…
          </p>
        )}
        {news.error && <ErrorNotice message={news.error} onRetry={news.reload} className="mt-6" />}

        {news.data && (
          <article className="mt-4 overflow-hidden rounded-2xl border border-line bg-navy-850/80">
            {news.data.image && (
              <img
                src={fileUrl(news.data.image)}
                alt={news.data.title}
                className="max-h-96 w-full object-cover"
              />
            )}

            <div className="px-6 py-6 sm:px-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">
                    {formatNewsDate(news.data.createdAt)} · โดย {newsAuthorName(news.data.author)}
                    {news.data.updatedAt !== news.data.createdAt &&
                      ` · แก้ไขล่าสุด ${formatNewsDate(news.data.updatedAt)}`}
                  </p>
                  <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
                    {news.data.title}
                  </h1>
                </div>
                <ShareButton path={`/news/${newsId}`} title={news.data.title} />
              </div>

              <p className="mt-5 whitespace-pre-line text-sm leading-7 text-slate-300">
                {news.data.content}
              </p>
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
