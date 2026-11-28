import Link from "next/link";

const BASE =
  "inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-bold uppercase tracking-[0.14em] text-ink-soft transition-colors hover:border-primary hover:text-foreground active:scale-[0.98]";

const Arrow = () => (
  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

/**
 * The one back control for every surface: 32px minimum hit area, 12px
 * minimum label, SVG arrow (never a text arrow at 10px). Use for navigation.
 */
export function BackLink({ href, label, className = "" }: { href: string; label: string; className?: string }) {
  return (
    <Link href={href} aria-label={label} className={`${BASE} ${className}`}>
      <Arrow />
      <span>{label}</span>
    </Link>
  );
}

/** Same control as a button, for non-navigation "go back" (view toggles). */
export function BackButton({ label, onClick, className = "" }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={`${BASE} ${className}`}>
      <Arrow />
      <span>{label}</span>
    </button>
  );
}