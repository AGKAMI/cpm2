/**
 * The subset of Telegram's WebApp surface the console touches, so browser
 * code can read `window.Telegram` type-safely — also OUTSIDE a Telegram
 * client, where the field simply stays undefined.
 *
 * The real definition lives in the official telegram-web-app.js SDK; this
 * exists only for the editor and tsc.
 */
export {};

declare global {
  interface TelegramWebAppUser {
    id?: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    photo_url?: string;
  }

  interface TelegramWebApp {
    /** Raw signed initData — sent along on every API call for the proxy to verify. */
    initData: string;
    initDataUnsafe?: { user?: TelegramWebAppUser; start_param?: string };
    version?: string;
    platform?: string;
    colorScheme?: "light" | "dark";
    isExpanded?: boolean;
    ready(): void;
    expand(): void;
    /** Bot API 6.1+ — cosmetic only, so they stay optional. */
    setHeaderColor?(color: string): void;
    setBackgroundColor?(color: string): void;
    setBottomBarColor?(color: string): void;
  }

  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}
