const SIZES = {
  sm: 'h-6 w-6 text-[11px]',
  md: 'h-10 w-10 text-base',
  lg: 'h-12 w-12 text-lg',
} as const;

interface AvatarProps {
  name: string;
  size?: keyof typeof SIZES;
  /** วงแหวนทองสำหรับอันดับ 1 */
  highlight?: boolean;
}

/** รูปโปรไฟล์ยังไม่มีในสเปก (เฟส 8 มีแค่สกินคิวบ์) — ใช้อักษรตัวแรกของชื่อไปก่อนตามดีไซน์ */
export function Avatar({ name, size = 'md', highlight }: AvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full border font-semibold ${SIZES[size]} ${
        highlight
          ? 'border-gold-400 bg-navy-800 text-gold-400'
          : 'border-brand-400/60 bg-navy-800 text-slate-200'
      }`}
    >
      {initial}
    </span>
  );
}
