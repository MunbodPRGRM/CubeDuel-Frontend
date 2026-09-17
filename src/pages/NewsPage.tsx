import { useSearchParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { ErrorNotice } from '@/components/ErrorScreen';
import { NewsCard } from '@/components/NewsCard';
import { Pagination } from '@/components/Pagination';
import { useApiPage } from '@/hooks/useApiPage';
import { useNarrowScreen } from '@/hooks/useNarrowScreen';
import type { NewsListItem } from '@/types/news';

const PAGE_SIZE = 10;

/**
 * หน้ารายการข่าวสารและกิจกรรม (`GET /news` — api-contract.md ข้อ 7)
 *
 * เลขหน้าเก็บใน query string เหมือนหน้ากระดานอันดับ จะได้กดย้อนกลับ/แชร์ลิงก์หน้า 3 ได้
 */
export default function NewsPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);

  const news = useApiPage<NewsListItem>(`/news?page=${page}&limit=${PAGE_SIZE}`);
  const narrow = useNarrowScreen();

  function goToPage(next: number) {
    setParams(next === 1 ? {} : { page: String(next) });
    window.scrollTo({ top: 0 });
  }

  const pagination = news.meta && (
    <Pagination
      page={news.meta.page}
      totalPages={news.meta.totalPages}
      total={news.meta.total}
      unitLabel="ข่าว"
      onChange={goToPage}
      disabled={news.loading}
    />
  );

  if (narrow) {
    return (
      // จอแคบ: การ์ดข่าวแบบย่อเลื่อนในกรอบ (ADR-083 ข้อ 7) · หน้ารายละเอียดข่าวยังเลื่อนทั้งหน้า
      // ไม่มีการ์ดใหญ่ของข่าวล่าสุด — ที่ 640 px การ์ดใหญ่กินครึ่งจอ เหลือรายการสองชิ้น
      <div className="flex h-app flex-col bg-navy-900">
        <AppHeader />
        <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3 pb-3">
          <h1 className="shrink-0 text-xl font-extrabold text-white">ข่าวสารและกิจกรรม</h1>

          {news.error && <ErrorNotice message={news.error} onRetry={news.reload} />}

          {news.data?.length === 0 && !news.loading && (
            <p className="rounded-2xl border border-line bg-navy-850/80 px-6 py-12 text-center text-sm text-slate-500">
              ยังไม่มีข่าวสารในตอนนี้
            </p>
          )}

          <div
            className={`min-h-40 flex-1 space-y-2 overflow-y-auto overscroll-contain ${
              news.loading ? 'opacity-60' : ''
            }`}
          >
            {news.data?.map((item) => (
              <NewsCard key={item.newsId} news={item} compact />
            ))}
            {pagination && (
              <div className="rounded-2xl border border-line bg-navy-850/40">{pagination}</div>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-app bg-navy-900">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <header>
          <p className="text-sm text-brand-400">CubeDuel</p>
          <h1 className="text-3xl font-bold text-white">ข่าวสารและกิจกรรม</h1>
          <p className="mt-1 text-sm text-slate-500">ประกาศจากผู้ดูแลระบบ · เรียงจากใหม่ไปเก่า</p>
        </header>

        {news.error && <ErrorNotice message={news.error} onRetry={news.reload} className="mt-6" />}

        {news.data?.length === 0 && !news.loading && (
          <p className="mt-6 rounded-2xl border border-line bg-navy-850/80 px-6 py-12 text-center text-sm text-slate-500">
            ยังไม่มีข่าวสารในตอนนี้
          </p>
        )}

        <div className={`mt-6 space-y-3 ${news.loading ? 'opacity-60' : ''}`}>
          {news.data?.map((item) => (
            <NewsCard key={item.newsId} news={item} />
          ))}
        </div>

        {pagination && (
          <div className="mt-2 rounded-2xl border border-line bg-navy-850/40">{pagination}</div>
        )}
      </main>
    </div>
  );
}
