/**
 * AccountNotice — the management warning shown on ACCOUNT-type products
 * (delivered-by-credentials stock). Protects both sides: the buyer changes
 * credentials immediately, and the sale is final once credentials are viewed.
 */

export function AccountNotice({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="mt-1 flex items-start gap-1.5 text-[10px] leading-snug text-amber-400">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M12 3l9 16H3l9-16z" strokeLinejoin="round" />
          <path d="M12 10v4" strokeLinecap="round" />
          <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
        </svg>
        <span>
          Change the email + password immediately after delivery. Credentials are
          non-refundable once viewed.
        </span>
      </p>
    );
  }
  return (
    <section className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-400">
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M12 3l9 16H3l9-16z" strokeLinejoin="round" />
          <path d="M12 10v4" strokeLinecap="round" />
          <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
        </svg>
        Account management
      </h2>
      <ul className="space-y-1 text-xs text-ink-soft">
        <li>
          · Change the email <em>and</em> password immediately after delivery:
          the moment you receive the credentials.
        </li>
        <li>· Never share the credentials with anyone, including &ldquo;support&rdquo;.</li>
        <li>· Credentials are non-refundable once they have been viewed.</li>
      </ul>
    </section>
  );
}
