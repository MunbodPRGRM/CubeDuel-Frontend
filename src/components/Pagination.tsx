interface PaginationProps {
  page: number;
  totalPages: number;
  /** จำนวนแถวทั้งหมด — ใช้บอกว่า "หน้า 2 จาก 7 · ทั้งหมด 137 รายการ" */
  total: number;
  unitLabel: string;
  onChange: (page: number) => void;
  disabled?: boolean;
}

/** แถบเปลี่ยนหน้าแบบเรียบ ๆ — ใช้ทั้งกระดานอันดับและรายการประวัติการแข่ง */
export function Pagination({
  page,
  totalPages,
  total,
  unitLabel,
  onChange,
  disabled,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-5 py-3">
      <p className="tabular text-xs text-slate-500">
        หน้า {page} จาก {totalPages} · ทั้งหมด {total.toLocaleString('th-TH')} {unitLabel}
      </p>
      <div className="flex items-center gap-2">
        <PageButton
          label="‹ ก่อนหน้า"
          disabled={disabled || page <= 1}
          onClick={() => onChange(page - 1)}
        />
        <PageButton
          label="ถัดไป ›"
          disabled={disabled || page >= totalPages}
          onClick={() => onChange(page + 1)}
        />
      </div>
    </div>
  );
}

function PageButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-line bg-navy-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-navy-800"
    >
      {label}
    </button>
  );
}
