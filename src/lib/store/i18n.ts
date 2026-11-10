/**
 * VANTA GARAGE — internationalisation.
 * Sec 18: dynamic language support, automatic platform/device detection,
 * manual language switching, central translation management, code-based
 * fallback translations, regional formatting, South African admin scheduling.
 *
 * Supported languages: en (default), af, xh, zu.
 * Currency: ZAR (South African Rand) with proper formatting.
 * Date/Time: en-ZA locale with SA business hours awareness.
 */

import type { Customer } from "../store-types.ts";

export type SupportedLanguage = "en" | "af" | "xh" | "zu";

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ["en", "af", "xh", "zu"];
export const DEFAULT_LANGUAGE: SupportedLanguage = "en";

type TranslationDictionary = Record<string, Record<SupportedLanguage, string>>;

const translations: TranslationDictionary = {
  "store.welcome": {
    en: "Welcome to VANTA GARAGE",
    af: "Welkom by VANTA GARAGE",
    xh: "Wamkelekile kwi-VANTA GARAGE",
    zu: "Wamukelekile ku-VANTA GARAGE",
  },
  "store.categories": {
    en: "Categories",
    af: "Kategorieë",
    xh: "Iiprojekthi",
    zu: "Izifundo",
  },
  "store.product_not_found": {
    en: "Product not found",
    af: "Produk nie gevind nie",
    xh: "Into ayikwamkeli",
    zu: "Into ayikwazi kuqondwa",
  },
  "store.out_of_stock": {
    en: "Out of stock",
    af: "Uit voorraad",
    xh: "Ayikho emnqubeni",
    zu: "Akuhlali esingqini",
  },
  "store.add_to_cart": {
    en: "Add to cart",
    af: "By karretjie voeg",
    xh: "Yigcineni i-cart",
    zu: "Geza i-cart",
  },
  "store.checkout": {
    en: "Checkout",
    af: "Kassa",
    xh: "IKhekhouthi",
    zu: "IKhekhouthi",
  },
  "store.payment_confirmed": {
    en: "Payment confirmed — your order is being processed",
    af: "Betaling bevestig — jou bestelling word verwerk",
    xh: "Uphando lwabiwo-mali luqinisekisiwe — i-order yakho iya kwenziwa",
    zu: "Inhloso yamalami iyqinisekile — i-oder yakho iyakhiwa",
  },
  "store.payment_failed": {
    en: "Payment failed — please try again",
    af: "Betaling misluk — probeer asseblief weer",
    xh: "Uphando lwabiwo-mali luphilile — musa ukuphela, attemptsi futhi",
    zu: "Inhloso yamalami iyaphikiswa —cele futhi",
  },
  "store.exclusive_stock_unavailable": {
    en: "This exclusive vehicle has already been purchased",
    af: "Hierdie eksklusiewe voertuig is reeds aangekoop",
    xh: "Iithiye engenacalo iyakoniwa kudala",
    zu: "Ithiye engenamfuno isebenza kudala",
  },
  "store.rate_limited": {
    en: "Too many requests — please slow down",
    af: "Te veel versoeke — mos asseblief stadig",
    xh: "Iipharmisithezi ezinengqondo — musa ukuphela, iyaphuma kancinci",
    zu: "Ipendu ziphezulu — celani ukubamba",
  },
  "store.admin_required": {
    en: "Admin access required",
    af: "Admin-toegang benodig",
    xh: "Ukhono lwe-Admin kufuneka",
    zu: "Kufunekile ukhono lwe-Admin",
  },
  "common.continue": {
    en: "Continue",
    af: "Gaan voort",
    xh: "Phinde",
    zu: "Phinde",
  },
  "common.cancel": {
    en: "Cancel",
    af: "Kanselleer",
    xh: "Gcina",
    zu: "Gcina",
  },
  "common.save": {
    en: "Save",
    af: "Retteer",
    xh: "Gcinisa",
    zu: "Gcinisa",
  },
  "common.error": {
    en: "An error occurred",
    af: "'n Fout het voorgevul",
    xh: "Inxeba",
    zu: "Inhlangano",
  },
};

/** Resolve the user's preferred language. Order of precedence:
 *  1. Explicit ?lang= parameter in URL
 *  2. Customer's stored currency_pref/language preference
 *  3. Telegram/WhatsApp platform language_code
 *  4. Browser Accept-Language header
 *  5. Default (en)
 */
export function resolveLanguage(input: {
  urlLang?: string | null;
  customerLang?: SupportedLanguage | null;
  platformLang?: string | null;
  acceptLanguage?: string | null;
}): SupportedLanguage {
  // 1. URL parameter (manual override)
  if (input.urlLang && SUPPORTED_LANGUAGES.includes(input.urlLang as SupportedLanguage)) {
    return input.urlLang as SupportedLanguage;
  }

  // 2. Customer stored preference
  if (input.customerLang && SUPPORTED_LANGUAGES.includes(input.customerLang)) {
    return input.customerLang;
  }

  // 3. Platform language (Telegram/WhatsApp)
  if (input.platformLang) {
    const normalized = input.platformLang.toLowerCase().split("-")[0] as SupportedLanguage;
    if (SUPPORTED_LANGUAGES.includes(normalized)) {
      return normalized;
    }
  }

  // 4. Accept-Language header (first supported match)
  if (input.acceptLanguage) {
    for (const tag of input.acceptLanguage.split(",")) {
      const code = tag.split(";")[0].trim().toLowerCase().split("-")[0];
      if (SUPPORTED_LANGUAGES.includes(code as SupportedLanguage)) {
        return code as SupportedLanguage;
      }
    }
  }

  return DEFAULT_LANGUAGE;
}

/** Translate a key to the given language, falling back to English, then the raw key. */
export function translate(key: string, lang: SupportedLanguage): string {
  const dict = translations[key];
  if (!dict) return key;
  const translated = dict[lang];
  if (translated) return translated;
  return dict[DEFAULT_LANGUAGE] ?? key;
}

/** Format a price in ZAR with South African conventions (space thousands separator, comma decimal). */
export function formatPriceZAR(amountCents: number, lang: SupportedLanguage = DEFAULT_LANGUAGE): string {
  const zar = amountCents / 100;
  // South African formatting: R1 234,56
  const formatted = zar.toLocaleString("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatted;
}

/** Format a date/time for South African display. */
export function formatDateTimeSA(isoString: string, lang: SupportedLanguage = DEFAULT_LANGUAGE): string {
  const date = new Date(isoString);
  return date.toLocaleString(lang === "en" ? "en-ZA" : "en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/** Check if it's within South African business hours (08:00–17:00 SAST, UTC+2). */
export function isBusinessHoursSA(date: Date = new Date()): boolean {
  const saTime = new Date(date.toLocaleString("en-US", { timeZone: "Africa/Johannesburg" }));
  const hour = saTime.getUTCHours(); // getUTCHours on a Johannesburg-adjusted date gives SAST hour
  const day = saTime.getUTCDay(); // 0=Sun, 6=Sat
  // Business hours: Mon-Fri 08:00-17:00 SAST
  if (day === 0 || day === 6) return false;
  return hour >= 8 && hour < 17;
}

/** Get the customer's preferred language from their profile. */
export function customerLanguage(customer: Customer | null): SupportedLanguage {
  if (!customer) return DEFAULT_LANGUAGE;
  // currency_pref field can carry a language hint; default to en if not set
  const pref = (customer as Record<string, unknown>).language_pref as SupportedLanguage | undefined;
  if (pref && SUPPORTED_LANGUAGES.includes(pref)) return pref;
  return DEFAULT_LANGUAGE;
}
