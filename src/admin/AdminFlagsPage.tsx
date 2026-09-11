import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Pagination } from '@/components/Pagination';
import { useApiData } from '@/hooks/useApiData';
import { useApiPage } from '@/hooks/useApiPage';
import { apiFetch } from '@/lib/api';
import {
  FLAG_REASON_LABEL,
  FLAG_VERDICT_LABEL,
  formatAdminDate,
  type FlagVerdict,
  type MatchFlag,
  type MatchFlagDetail,
} from '@/types/admin';
import { AdminDialog } from './AdminDialog';
import { AdminLayout, AdminNotice } from './AdminLayout';
import { errorMessage } from '@/lib/errors';

const PAGE_SIZE = 20;
const VERDICT_TABS = [
  { value: 'pending', label: 'ยังไม่ตรวจ' },
  { value: 'cheating', label: 'พบการโกง' },
  { value: 'clean', label: 'ไม่พบ' },
  { value: 'inconclusive', label: 'สรุปไม่ได้' },
  { value: 'all', label: 'ทั้งหมด' },
] as const;

/**
 * แมตช์ที่ระบบ anti-cheat สงสัย (`GET /admin/matches/flagged`)
 *
 * เกณฑ์ soft = **ข้อสงสัย ไม่ใช่คำตัดสิน** (game-rules.md ข้อ 10) → ตัดสิน flag ที่นี่
 * ไม่ได้ระงับบัญชีให้เอง ต้องไปสั่งที่หน้าบัญชีผู้ใช้อีกครั้ง (ADR-050 ข้อ 5)
 */
export default function AdminFlagsPage() {
  const [params, setParams] = useSearchParams();
  const verdict = params.get('verdict') ?? 'pending';
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);

  const [reloadKey, setReloadKey] = useState(0);
  const [openFlagId, setOpenFlagId] = useState<number | null>(null);

  const flags = useApiPage<MatchFlag>(
    `/admin/matches/flagged?verdict=${verdict}&page=${page}&limit=${PAGE_SIZE}&_=${reloadKey}`,
  );

  function update(next: Record<string, string>) {
    const merged = { verdict, ...next };
    setParams(Object.fromEntries(Object.entries(merged).filter(([, v]) => v)));
  }

  return (
    <AdminLayout
      title="แมตช์ที่ถูก flag"
      description="ผลที่ผิดปกติถูกบันทึกไว้ให้ตรวจ ไม่ได้ถูกปฏิเสธอัตโนมัติ"
    >
      <div className="flex flex-wrap gap-1.5">
        {VERDICT_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => update({ verdict: tab.value, page: '' })}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              verdict === tab.value
                ? 'bg-brand-500 font-medium text-white'
                : 'border border-line text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {flags.error && (
        <div className="mt-4">
          <AdminNotice tone="error" onRetry={flags.reload}>
            {flags.error}
          </AdminNotice>
        </div>
      )}
      {flags.data?.length === 0 && !flags.loading && (
        <div className="mt-4">
          <AdminNotice>ไม่มีรายการในหมวดนี้</AdminNotice>
        </div>
      )}

      <div className={`mt-4 space-y-3 ${flags.loading ? 'opacity-60' : ''}`}>
        {flags.data?.map((flag) => (
          <FlagCard key={flag.flagId} flag={flag} onOpen={() => setOpenFlagId(flag.flagId)} />
        ))}
      </div>

      {flags.meta && flags.meta.totalPages > 1 && (
        <div className="mt-2 rounded-2xl border border-line bg-navy-850/40">
          <Pagination
            page={flags.meta.page}
            totalPages={flags.meta.totalPages}
            total={flags.meta.total}
            unitLabel="รายการ"
            onChange={(next) => update({ page: String(next) })}
            disabled={flags.loading}
          />
        </div>
      )}

      {openFlagId !== null && (
        <FlagDialog
          flagId={openFlagId}
          onClose={() => setOpenFlagId(null)}
          onReviewed={() => {
            setOpenFlagId(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </AdminLayout>
  );
}

function FlagCard({ flag, onOpen }: { flag: MatchFlag; onOpen: () => void }) {
  const matchLink = flag.matchId
    ? `/matches/${flag.matchId}`
    : flag.multiplayerMatchId
      ? `/multiplayer-matches/${flag.multiplayerMatchId}`
      : null;

  return (
    <article className="rounded-2xl border border-line bg-navy-850/80 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">
            #{flag.flagId} · {formatAdminDate(flag.createdAt)}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-gold-400/40 px-2 py-0.5 text-xs text-gold-400">
              {FLAG_REASON_LABEL[flag.flagReason]}
            </span>
            <Link
              to={`/users/${flag.user.userId}`}
              className="text-sm font-semibold text-slate-100 transition hover:text-white"
            >
              {flag.user.nickname || flag.user.username}
            </Link>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {flag.verdict && (
            <span className="rounded-lg border border-line px-3 py-1.5 text-xs text-slate-400">
              {FLAG_VERDICT_LABEL[flag.verdict]}
            </span>
          )}
          <button
            type="button"
            onClick={onOpen}
            className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            {flag.verdict ? 'เปิดดู' : 'ตรวจสอบ'}
          </button>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="tabular">
          {flag.hasMoveLog ? `move log ${flag.moveLogLength} ท่า` : 'ไม่มี move log (ถูกล้างแล้ว)'}
        </span>
        {matchLink && (
          <Link to={matchLink} className="text-brand-400 transition hover:text-brand-300">
            ดูผลแมตช์ →
          </Link>
        )}
      </div>
    </article>
  );
}

const VERDICTS: FlagVerdict[] = ['clean', 'cheating', 'inconclusive'];

/** เปิดทีละใบถึงจะได้ `moveLog` เต็ม — หน้ารายการไม่ส่งมาให้ (ADR-050 ข้อ 5) */
function FlagDialog({
  flagId,
  onClose,
  onReviewed,
}: {
  flagId: number;
  onClose: () => void;
  onReviewed: () => void;
}) {
  const flag = useApiData<MatchFlagDetail>(`/admin/matches/flagged/${flagId}`);
  const [verdict, setVerdict] = useState<FlagVerdict>('inconclusive');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch(`/admin/matches/flagged/${flagId}`, {
        method: 'PATCH',
        body: { verdict, note: note.trim() || null },
      });
      onReviewed();
    } catch (err) {
      setError(errorMessage(err, 'บันทึกผลตรวจไม่สำเร็จ'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminDialog title={`ตรวจสอบ flag #${flagId}`} onClose={onClose}>
      {flag.loading && <p className="py-8 text-center text-sm text-slate-500">กำลังโหลด…</p>}
      {flag.error && <p className="py-8 text-center text-sm text-loss">{flag.error}</p>}

      {flag.data && (
        <div className="space-y-4">
          <div>
            <p className="text-xs text-slate-500">เกณฑ์ที่ทำให้ถูก flag</p>
            <p className="mt-0.5 text-sm text-slate-200">
              {FLAG_REASON_LABEL[flag.data.flagReason]}
            </p>
            {/* `detail` รูปไม่ตายตัวตามเกณฑ์ → แสดงเป็นคู่คีย์-ค่าตรง ๆ ดีกว่าเดารูป */}
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl border border-line bg-navy-900/60 px-4 py-3 text-sm">
              {Object.entries(flag.data.detail).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs text-slate-500">{key}</dt>
                  <dd className="tabular text-slate-200">{String(value)}</dd>
                </div>
              ))}
            </dl>
          </div>

          {flag.data.moveLog && flag.data.moveLog.length > 0 && (
            <div>
              <p className="text-xs text-slate-500">
                move log ({flag.data.moveLog.length} ท่า · ตัวเลขคือมิลลิวินาทีนับจากเริ่มจับเวลา)
              </p>
              <div className="tabular mt-1 max-h-48 overflow-y-auto rounded-xl border border-line bg-navy-900/60 px-4 py-3 text-xs leading-6 text-slate-300">
                {flag.data.moveLog.map((entry) => (
                  <span key={entry.seq} className="mr-3 inline-block">
                    <span className="text-slate-100">{entry.move}</span>
                    <span className="text-slate-600">@{entry.ms}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={(e) => void submit(e)} className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {VERDICTS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setVerdict(value)}
                  className={`rounded-xl border px-4 py-2 text-sm transition ${
                    verdict === value
                      ? 'border-brand-500/60 bg-brand-500/10 text-slate-100'
                      : 'border-line text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {FLAG_VERDICT_LABEL[value]}
                </button>
              ))}
            </div>

            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="บันทึกสั้น ๆ (เก็บลง log)"
              className="w-full rounded-xl border border-line bg-navy-950/60 px-4 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand-500"
            />

            <p className="rounded-xl border border-line bg-navy-900/60 px-4 py-2.5 text-xs leading-5 text-slate-400">
              การตัดสินนี้เป็นการบันทึกความเห็นเท่านั้น —{' '}
              <strong className="text-slate-200">ไม่ระงับบัญชีให้อัตโนมัติ</strong>{' '}
              ถ้าจะระงับต้องไปสั่งที่หน้า “บัญชีผู้ใช้”
            </p>

            {error && <p className="text-sm text-loss">{error}</p>}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-500/40"
              >
                {saving ? 'กำลังบันทึก…' : 'บันทึกผลตรวจ'}
              </button>
            </div>
          </form>
        </div>
      )}
    </AdminDialog>
  );
}
