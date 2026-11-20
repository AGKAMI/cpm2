/**
 * Telegram Stars icon that follows the VANTA theme.
 * Black star on the light ("paper") theme, white star on the dark ("night")
 * theme. Both images always render; CSS (globals.css `.star-icon-*`) shows the
 * one matching the resolved data-theme, so Telegram's live theme changes apply
 * without a React re-render.
 */
export function StarIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <>
      <img
        src="/telegram-star-black.svg"
        alt=""
        aria-hidden="true"
        className={`${className} star-icon-light`}
      />
      <img
        src="/telegram-star-white.svg"
        alt=""
        aria-hidden="true"
        className={`${className} star-icon-dark`}
      />
    </>
  );
}