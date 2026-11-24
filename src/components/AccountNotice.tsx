/**
 * AccountNotice — the management warning shown on ACCOUNT-type products
 * (delivered-by-credentials stock). Protects both sides: the buyer changes
 * credentials immediately, and the sale is final once credentials are viewed.
 */

export function AccountNotice({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="mt-1 text-[10px] leading-snug text-amber-400">
        ⚠ Change the email + password immediately after delivery. Credentials
        are non-refundable once viewed.
      </p>
    );
  }
  return (
    <section className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
      <h2 className="mb-2 text-sm font-semibold text-amber-400">
        ⚠ Account management
      </h2>
      <ul className="space-y-1 text-xs text-ink-soft">
        <li>
          · Change the email <em>and</em> password immediately after delivery —
          the moment you receive the credentials.
        </li>
        <li>· Never share the credentials with anyone, including &ldquo;support&rdquo;.</li>
        <li>· Credentials are non-refundable once they have been viewed.</li>
      </ul>
    </section>
  );
}
