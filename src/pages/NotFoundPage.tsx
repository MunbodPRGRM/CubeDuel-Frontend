import { Link } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-navy-900">
      <AppHeader />
      <main className="page-wide px-4 py-24 text-center">
        <p className="tabular text-6xl font-bold text-navy-700">404</p>
        <h1 className="mt-4 text-xl font-bold text-white">ไม่พบหน้าที่ต้องการ</h1>
        <p className="mt-2 text-sm text-slate-500">ลิงก์อาจพิมพ์ผิด หรือหน้านี้ยังไม่ถูกสร้าง</p>
        <Link
          to="/"
          className="mt-8 inline-block rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
        >
          กลับหน้าแรก
        </Link>
      </main>
    </div>
  );
}
