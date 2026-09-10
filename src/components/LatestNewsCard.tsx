import { Link } from 'react-router-dom';
import { useApiPage } from '@/hooks/useApiPage';
import { NewsCard } from './NewsCard';
import type { NewsListItem } from '@/types/news';

/**
 * แถบ "ข่าวสารและกิจกรรม" บนหน้าแรก — ข่าวล่าสุด 3 ชิ้น
 *
 * ภาพดีไซน์หน้าแรกไม่มีที่ให้ข่าวเลย ทั้งที่ข่าวสารเป็นฟีเจอร์ในเล่ม (ข้อ 12 ของ CLAUDE.md)
 * → วางไว้ท้ายหน้าใต้การ์ดประวัติ/กระดานอันดับ ซึ่งเป็นที่ที่ไม่แย่งความสนใจจากปุ่มจับคู่ (ADR-049 ข้อ 6)
 * ข่าวว่างเปล่า = **ไม่แสดงอะไรเลย** ไม่ต้องขึ้นการ์ดเปล่าให้หน้าแรกรก
 */
export function LatestNewsCard({ limit = 3 }: { limit?: number }) {
  const news = useApiPage<NewsListItem>(`/news?page=1&limit=${limit}`);

  if (news.error || !news.data?.length) return null;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-300">ข่าวสารและกิจกรรม</h2>
        <Link to="/news" className="text-xs text-brand-400 transition hover:text-brand-300">
          ดูทั้งหมด →
        </Link>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {news.data.map((item) => (
          <NewsCard key={item.newsId} news={item} compact />
        ))}
      </div>
    </section>
  );
}
