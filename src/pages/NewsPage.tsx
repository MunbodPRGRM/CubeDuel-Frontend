import { useSearchParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { ErrorNotice } from '@/components/ErrorScreen';
import { NewsCard } from '@/components/NewsCard';
import { Pagination } from '@/components/Pagination';
import { useApiPage } from '@/hooks/useApiPage';
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

  function goToPage(next: number) {
    setParams(next === 1 ? {} : { page: String(next) });
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="min-h-screen bg-navy-900">
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

        {news.meta && (
          <div className="mt-2 rounded-2xl border border-line bg-navy-850/40">
            <Pagination
              page={news.meta.page}
              totalPages={news.meta.totalPages}
              total={news.meta.total}
              unitLabel="ข่าว"
              onChange={goToPage}
              disabled={news.loading}
            />
          </div>
        )}
      </main>
    </div>
  );
}
