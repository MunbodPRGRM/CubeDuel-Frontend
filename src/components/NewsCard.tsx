import { Link } from 'react-router-dom';
import { NewsCover } from '@/news/NewsCover';
import { formatNewsDate, newsAuthorName, type NewsListItem } from '@/types/news';

/**
 * การ์ดข่าวหนึ่งชิ้น — ใช้ทั้งหน้ารายการข่าวและแถบข่าวบนหน้าแรก
 *
 * ดีไซน์ไม่มีหน้าข่าวเลยสักภาพ (ทั้งที่เป็นฟีเจอร์ในเล่ม) → ยึดภาษาเดียวกับการ์ดอื่นของแอป
 * คือกรอบ `border-line` บนพื้น `navy-850` เหมือน `LeaderboardCard` (เหตุผลเดียวกับ ADR-024)
 */
export function NewsCard({ news, compact }: { news: NewsListItem; compact?: boolean }) {
  return (
    <Link
      to={`/news/${news.newsId}`}
      className="group flex gap-4 rounded-2xl border border-line bg-navy-850/80 p-4 transition hover:border-brand-500/50 hover:bg-navy-850"
    >
      <NewsCover cover={news.cover} size={compact ? 'thumb' : 'card'} />

      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500">
          {formatNewsDate(news.createdAt)} · โดย {newsAuthorName(news.author)}
        </p>
        <h3
          className={`mt-1 font-semibold text-slate-100 transition group-hover:text-white ${
            compact ? 'text-sm' : 'text-lg'
          }`}
        >
          {news.title}
        </h3>
        <p
          className={`mt-1 text-slate-400 ${compact ? 'line-clamp-2 text-xs' : 'line-clamp-3 text-sm'}`}
        >
          {news.excerpt}
        </p>
      </div>
    </Link>
  );
}
