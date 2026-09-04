interface StatCardProps {
  label: string;
  value: string;
  /** ข้อความเล็กต่อท้ายค่า เช่น "38W 21L" หรือหน่วย "%" */
  suffix?: string;
  /** ใช้กับการ์ด ELO ตามดีไซน์ (ตัวเลขสีฟ้า) */
  accent?: boolean;
  /** บอกว่าทำไมยังไม่มีข้อมูล */
  note?: string;
}

export function StatCard({ label, value, suffix, accent, note }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-line bg-navy-850/80 px-5 py-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1.5 flex items-baseline gap-1.5">
        <span
          className={`tabular text-3xl font-semibold ${accent ? 'text-brand-400' : 'text-slate-100'}`}
        >
          {value}
        </span>
        {suffix && <span className="text-sm text-slate-500">{suffix}</span>}
      </p>
      {note && <p className="mt-1 text-xs text-slate-600">{note}</p>}
    </div>
  );
}
