import type { ReactNode } from 'react';

interface SubmitButtonProps {
  loading?: boolean;
  children: ReactNode;
}

export function SubmitButton({ loading, children }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-3.5
        text-sm font-semibold text-white transition hover:bg-brand-600
        focus:outline-none focus:ring-2 focus:ring-brand-500/40
        disabled:cursor-not-allowed disabled:bg-brand-500/40"
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      )}
      {children}
    </button>
  );
}
