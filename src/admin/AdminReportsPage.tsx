import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Pagination } from '@/components/Pagination';
import { useApiPage } from '@/hooks/useApiPage';
import { ApiError, apiFetch } from '@/lib/api';
import {
  formatAdminDate,
  REPORT_ACTION_LABEL,
  type AdminReport,
  type ReportAction,
} from '@/types/admin';
import { AdminDialog } from './AdminDialog';
import { AdminLayout, AdminNotice } from './AdminLayout';

const PAGE_SIZE = 20;
const STATUS_TABS = [
  { value: 'pending', label: 'รอตรวจ' },
  { value: 'resolved', label: 'ตัดสินแล้ว' },
  { value: 'all', label: 'ทั้งหมด' },
] as const;

/** รายการรายงานผู้เล่น + หน้าตัดสิน (`GET/PATCH /admin/reports` — api-contract.md ข้อ 8) */
export default function AdminReportsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'pending';
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);

  const [reloadKey, setReloadKey] = useState(0);
  const [resolving, setResolving] = useState<AdminReport | null>(null);

  const reports = useApiPage<AdminReport>(
    `/admin/reports?status=${status}&page=${page}&limit=${PAGE_SIZE}&_=${reloadKey}`,
  );

  function update(next: Record<string, string>) {
    const merged = { status, ...next };
    setParams(Object.fromEntries(Object.entries(merged).filter(([, v]) => v)));
  }

  return (
    <AdminLayout title="รายงานผู้เล่น" description="ผู้ใช้แจ้งเข้ามา → ตรวจสอบ → ตัดสิน">
      <div className="flex flex-wrap gap-1.5">
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

      {reports.error && (
        <div className="mt-4">
          <AdminNotice tone="error">{reports.error}</AdminNotice>
        </div>
      )}
      {reports.data?.length === 0 && !reports.loading && (
        <div className="mt-4">
          <AdminNotice>
            {status === 'pending' ? 'ไม่มีรายงานที่รอตรวจ' : 'ไม่มีรายงานในหมวดนี้'}
          </AdminNotice>
        </div>
      )}

      <div className={`mt-4 space-y-3 ${reports.loading ? 'opacity-60' : ''}`}>
        {reports.data?.map((report) => (
          <ReportCard
            key={report.reportId}
            report={report}
            onResolve={() => setResolving(report)}
          />
        ))}
      </div>

      {reports.meta && reports.meta.totalPages > 1 && (
        <div className="mt-2 rounded-2xl border border-line bg-navy-850/40">
          <Pagination
            page={reports.meta.page}
            totalPages={reports.meta.totalPages}
            total={reports.meta.total}
            unitLabel="รายงาน"
            onChange={(next) => update({ page: String(next) })}
            disabled={reports.loading}
          />
        </div>
      )}

      {resolving && (
        <ResolveDialog
          report={resolving}
          onClose={() => setResolving(null)}
          onResolved={() => {
            setResolving(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </AdminLayout>
  );
}

function ReportCard({ report, onResolve }: { report: AdminReport; onResolve: () => void }) {
  const pending = report.reportStatus === 'pending';
  const matchLink = report.matchId
    ? `/matches/${report.matchId}`
    : report.multiplayerMatchId
      ? `/multiplayer-matches/${report.multiplayerMatchId}`
      : null;

  return (
    <article className="rounded-2xl border border-line bg-navy-850/80 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">
            #{report.reportId} · แจ้งเมื่อ {formatAdminDate(report.createdAt)}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <Link
              to={`/users/${report.reporter.userId}`}
              className="text-slate-400 transition hover:text-slate-200"
            >
              {report.reporter.nickname || report.reporter.username}
            </Link>
            <span className="text-slate-600">แจ้ง</span>
            <Link
              to={`/users/${report.reported.userId}`}
              className="font-semibold text-slate-100 transition hover:text-white"
            >
              {report.reported.nickname || report.reported.username}
            </Link>
            {report.reported.status === 'suspended' && (
              <span className="rounded-md border border-loss/40 px-1.5 py-0.5 text-[11px] text-loss">
                ถูกระงับอยู่
              </span>
            )}
          </p>
        </div>

        {pending ? (
          <button
            type="button"
            onClick={onResolve}
            className="shrink-0 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            ตัดสิน
          </button>
        ) : (
          <span className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs text-slate-400">
            {report.actionTaken ? REPORT_ACTION_LABEL[report.actionTaken] : 'ตัดสินแล้ว'}
          </span>
        )}
      </div>

      <p className="mt-3 whitespace-pre-line rounded-xl border border-line bg-navy-900/60 px-4 py-3 text-sm leading-6 text-slate-300">
        {report.reason}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className={report.reported.reportCount > 1 ? 'text-gold-400' : undefined}>
          ผู้ถูกรายงานถูกแจ้งมาแล้ว {report.reported.reportCount} ครั้ง
        </span>
        {matchLink ? (
          <Link to={matchLink} className="text-brand-400 transition hover:text-brand-300">
            ดูแมตช์ที่แนบมา →
          </Link>
        ) : (
          <span>ไม่ได้แนบแมตช์</span>
        )}
        {!pending && report.reviewedAt && (
          <span>ตรวจเมื่อ {formatAdminDate(report.reviewedAt)}</span>
        )}
      </div>

      {report.adminNote && (
        <p className="mt-2 text-xs text-slate-400">บันทึกของแอดมิน: {report.adminNote}</p>
      )}
    </article>
  );
}

const ACTIONS: ReportAction[] = ['none', 'warning', 'suspend', 'reset_rating'];

/** ตัดสินแล้วปิดตาย — ตัดสินซ้ำ server ตอบ 409 (ADR-050 ข้อ 2) */
function ResolveDialog({
  report,
  onClose,
  onResolved,
}: {
  report: AdminReport;
  onClose: () => void;
  onResolved: () => void;
}) {
  const [action, setAction] = useState<ReportAction>('none');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch(`/admin/reports/${report.reportId}`, {
        method: 'PATCH',
        body: { action, adminNote: note.trim() || null },
      });
      onResolved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ตัดสินรายงานไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminDialog
      title={`ตัดสินรายงาน #${report.reportId}`}
      subtitle={`ผู้ถูกรายงาน: ${report.reported.nickname || report.reported.username}`}
      onClose={onClose}
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <div className="space-y-2">
          {ACTIONS.map((value) => (
            <label
              key={value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-2.5 transition ${
                action === value ? 'border-brand-500/60 bg-brand-500/10' : 'border-line'
              }`}
            >
              <input
                type="radio"
                name="action"
                value={value}
                checked={action === value}
                onChange={() => setAction(value)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm text-slate-100">{REPORT_ACTION_LABEL[value]}</span>
                <span className="block text-xs text-slate-500">{ACTION_HINT[value]}</span>
              </span>
            </label>
          ))}
        </div>

        <label className="block">
          <span className="text-sm text-slate-300">บันทึกของแอดมิน</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="เช่น ดู move log แล้วเป็น 3.1 วิ ใน 3x3x3"
            className="mt-1 w-full rounded-xl border border-line bg-navy-950/60 px-4 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand-500"
          />
        </label>

        <p className="rounded-xl border border-line bg-navy-900/60 px-4 py-2.5 text-xs leading-5 text-slate-400">
          ตัดสินแล้ว **แก้ไม่ได้** — ถ้าตัดสินผิดต้องไปแก้ที่ต้นเหตุแทน (ปลดระงับที่หน้าบัญชีผู้ใช้
          / แก้คะแนนที่ปุ่มแก้คะแนน) ทุกการกระทำถูกบันทึกลง log
        </p>

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
            disabled={saving}
            className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-500/40"
          >
            {saving ? 'กำลังบันทึก…' : 'ยืนยันการตัดสิน'}
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}

const ACTION_HINT: Record<ReportAction, string> = {
  none: 'ปิดเรื่องโดยไม่ทำอะไรกับบัญชี',
  warning: 'บันทึกว่าตักเตือนแล้ว — บัญชียังใช้งานได้ตามปกติ',
  suspend: 'ระงับบัญชีถาวรทันที และเตะออกจากทุกอุปกรณ์',
  reset_rating: 'คืนคะแนนเป็น 1000 ทั้ง 4 ประเภท (ไม่ลบประวัติแมตช์)',
};
