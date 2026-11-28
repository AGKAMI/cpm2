"use client";

import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import { StoreShell } from "@/components/StoreShell";
import Link from "next/link";
import { StarIcon } from "@/components/StarIcon";
import { approxStarsForCents } from "@/lib/store/pricing";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";
import { BackButton } from "@/components/ui/BackLink";

import { Field, TextInput } from "@/components/ui/Field";
import { ThemeGallery } from "@/components/ThemeGallery";
import { useToast } from "@/components/ui/Toaster";
import { ProfileSkeleton } from "@/components/skeleton";
import { vantaApi, formatPrice, type VantaCustomer, type TelegramUser } from "@/lib/store/client";

type Order = {
  id: string;
  orderState: string;
  paymentState: string;
  amountCents: number;
  currency: string;
  createdAt: string;
};

/** Detect which platform the customer logged in from (Telegram app, browser). */
function detectPlatform(): string {
  if (typeof window === "undefined") return "browser";
  const tg = (window as { Telegram?: { WebApp?: { initData?: string; platform?: string } } })
    .Telegram?.WebApp;
  if (tg && (tg.initData || (tg.platform && tg.platform !== "unknown"))) {
    const p = String(tg.platform || "").trim();
    return p && p !== "unknown" && p !== "web" ? `Telegram (${p})` : "Telegram";
  }
  const ua = navigator.userAgent;
  if (/comet/i.test(ua)) return "Comet";
  if (/edg\//i.test(ua)) return "Edge";
  if (/firefox\//i.test(ua)) return "Firefox";
  if (/chrome|crios/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua)) return "Safari";
  return "browser";
}

const ShowIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M9.61 9.607C8.055 10.455 7 12.104 7 14C7 16.761 9.239 19 12 19C13.897 19 15.547 17.944 16.394 16.388M21 14C21 9.029 16.971 5 12 5C11.558 5 11.124 5.032 10.699 5.093M3 14C3 11.007 4.461 8.355 6.709 6.719M3 3L21 21" />
  </svg>
);

const HideIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M3 14C3 9.029 7.029 5 12 5C16.971 5 21 9.029 21 14M17 14C17 16.761 14.761 19 12 19C9.239 19 7 16.761 7 14C7 11.239 9.239 9 12 9C14.761 9 17 11.239 17 14Z" />
  </svg>
);

type ProfileIconProps = { className?: string };

const ProfileIcon = ({ className }: ProfileIconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
);

type ProfileClientProps = {
  initialCustomer?: VantaCustomer | null;
  initialTelegramUser?: TelegramUser | null;
};

// The app's policies — keys must match LEGAL_DOCS in src/app/legal/[doc]/page.tsx.
// Shown inside the profile's Security tab so the rules of using the app are
// findable from one place instead of only by direct URL.
const POLICY_DOCS: Array<{ slug: string; title: string }> = [
  { slug: "terms", title: "Terms & Conditions" },
  { slug: "privacy", title: "Privacy Policy" },
  { slug: "refund", title: "Refund Policy" },
  { slug: "delivery", title: "Delivery Policy" },
  { slug: "payment", title: "Payment Policy" },
  { slug: "cancellation", title: "Cancellation Policy" },
  { slug: "appointment", title: "Appointment Policy" },
  { slug: "dispute", title: "Dispute Policy" },
];

export function ProfileClient({
  initialCustomer = null,
  initialTelegramUser = null,
}: ProfileClientProps) {
  const [customer, setCustomer] = useState<VantaCustomer | null>(initialCustomer);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(initialTelegramUser);
  const [loading, setLoading] = useState(!initialCustomer && !initialTelegramUser);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [ordersCount, setOrdersCount] = useState(0);
  // Reference-style profile stats: total spent, top-ups and orders are REAL
  // counts from the order history; the wallet balance reads the stored wallet,
  // which does not exist yet (0 until the wallet feature lands), and reviews
  // have no feature behind them yet either.
  const [spentStars, setSpentStars] = useState(0);
  const [topUpCount, setTopUpCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [editingCpm2Id, setEditingCpm2Id] = useState(false);
  const [cpm2IdValue, setCpm2IdValue] = useState("");
  const [showCredentials, setShowCredentials] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [saving, setSaving] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState<boolean | null>(null);
  const toast = useToast();
  const [quickLoginBusy, setQuickLoginBusy] = useState(false);
  const [adminRole, setAdminRole] = useState<"owner" | "admin" | null>(null);
  const [notificationsSaving, setNotificationsSaving] = useState(false);
  const [profileTab, setProfileTab] = useState<"account" | "appearance" | "security">("account");

  async function checkSession() {
    try {
      const initData =
        typeof window !== "undefined" && typeof window.Telegram !== "undefined"
          ? window.Telegram.WebApp?.initData ?? ""
          : "";
      const headers: HeadersInit = {};
      if (initData) headers["X-Telegram-Init-Data"] = initData;
      const res = await fetch("/api/store/profile", { credentials: "include", headers });
      if (res.ok) {
        const data = await res.json();
        if (data.customer) {
          setCustomer(data.customer);
          setNotificationsEnabled(data.customer?.notificationsEnabled ?? true);
        }
        if (data.telegramUser) setTelegramUser(data.telegramUser);

        // Fetch stats
        const [ordersRes, wishlistRes] = await Promise.all([
          fetch("/api/store/orders", { credentials: "include", headers }),
          fetch("/api/store/wishlist", { credentials: "include", headers }),
        ]);

        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          const list = Array.isArray(ordersData.orders) ? ordersData.orders : [];
          setOrdersCount(list.length);
          const verifiedStars = list.filter(
            (o: { paymentState?: string; paymentMethod?: string }) =>
              o.paymentState === "verified" && o.paymentMethod === "stars",
          );
          setTopUpCount(verifiedStars.length);
          const starsCents = verifiedStars.reduce(
            (sum: number, o: { amountCents?: number }) => sum + Number(o.amountCents ?? 0),
            0,
          );
          setSpentStars(approxStarsForCents(starsCents));
        }
        if (wishlistRes.ok) {
          const wishlistData = await wishlistRes.json();
          setWishlistCount(Array.isArray(wishlistData.items) ? wishlistData.items.length : 0);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const verifyPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let alive = true;
    queueMicrotask(() => {
      if (alive) checkSession();
    });
    return () => {
      alive = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (verifyPollRef.current) clearInterval(verifyPollRef.current);
    };
  }, []);

  // Detect admin/owner via Telegram ID — no login required.
  // If your Telegram ID matches the owner or an admin, the Quick Login button shows.
  // Telegram's WebView script may not have executed yet on mount, so poll
  // briefly for initData before checking — otherwise the check runs with no
  // header, fails silently, and the Quick Login button stays hidden until the
  // next focus event.
  useEffect(() => {
    let alive = true;
    const detectAdmin = async () => {
      const deadline = Date.now() + 4000;
      let initData = "";
      for (;;) {
        initData =
          typeof window !== "undefined" && typeof window.Telegram !== "undefined"
            ? window.Telegram.WebApp?.initData ?? ""
            : "";
        if (initData || Date.now() >= deadline) break;
        await new Promise((r) => setTimeout(r, 150));
      }
      if (!alive) return;
      const headers: HeadersInit = {};
      if (initData) headers["X-Telegram-Init-Data"] = initData;
      try {
        const r = await fetch("/api/store/admin/is-admin", {
          cache: "no-store",
          headers,
        });
        if (!alive) return;
        if (!r.ok) {
          setAdminRole(null);
          return;
        }
        const data = await r.json();
        setAdminRole(data?.isOwner ? "owner" : data?.isAdmin ? "admin" : null);
      } catch {
        // Network hiccup — keep the last-known role rather than hiding the button.
      }
    };
    detectAdmin();
    return () => {
      alive = false;
    };
  }, []);

  // --- CPM2 ID edit ---
  const startEditingCpm2Id = () => {
    setCpm2IdValue(customer?.playerId ?? "");
    setEditingCpm2Id(true);
  };

  const cancelEditingCpm2Id = () => {
    setEditingCpm2Id(false);
    setCpm2IdValue("");
  };

  const saveCpm2Id = async () => {
    if (!customer?.id) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/store/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: cpm2IdValue.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || "Failed to update CPM2 ID.");
      }
      const data = await res.json();
      setCustomer((prev) => (prev ? { ...prev, playerId: data.playerId ?? cpm2IdValue } : prev));
      setEditingCpm2Id(false);
      setSuccess("CPM2 ID updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
      toast.error("Update failed", err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  // --- Email / Password ---
  const saveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const body: Record<string, string> = {};
      if (emailValue.trim()) body.email = emailValue.trim();
      if (passwordValue.trim()) body.password = passwordValue.trim();
      if (Object.keys(body).length === 0) {
        setError("Enter at least an email or password.");
        return;
      }
      const res = await fetch("/api/store/auth/credentials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const bodyErr = await res.json().catch(() => ({}));
        throw new Error(bodyErr.error?.message || "Failed to update credentials.");
      }
      setShowCredentials(false);
      setEmailValue("");
      setPasswordValue("");
      setSuccess("Credentials updated.");
      await checkSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
      toast.error("Update failed", err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  async function logout() {
    setSaving(true);
    try {
      await fetch("/api/store/auth/logout", { method: "POST", credentials: "include" });
      setCustomer(null);
      setTelegramUser(null);
      setNotificationsEnabled(null);
      setSuccess("Logged out.");
    } catch {
      setError("Logout failed.");
      toast.error("Logout failed", "Could not log out. Try again.");
    } finally {
      setSaving(false);
    }
  };

  // --- Notifications toggle ---
  const toggleNotifications = async () => {
    if (notificationsEnabled === null || !customer?.id) return;
    const next = !notificationsEnabled;
    setNotificationsSaving(true);
    try {
      const res = await fetch(`/api/store/customers/${customer.id}/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error("Failed to update notifications.");
      setNotificationsEnabled(next);
      setCustomer((prev) => (prev ? { ...prev, notificationsEnabled: next } : prev));
      setSuccess(next ? "Notifications on." : "Notifications off.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update notifications.");
      toast.error("Update failed", err instanceof Error ? err.message : String(err));
    } finally {
      setNotificationsSaving(false);
    }
  };

  // --- Quick login: skip email/password, log in via linked Telegram ID ---
  // Only shown to owner/admin customers detected via Telegram ID.
  const quickLogin = async () => {
    setQuickLoginBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const initData =
        typeof window !== "undefined" && typeof window.Telegram !== "undefined"
          ? window.Telegram.WebApp?.initData ?? ""
          : "";
      const headers: HeadersInit = {};
      if (initData) headers["X-Telegram-Init-Data"] = initData;

      const r = await fetch("/api/store/admin/is-admin", {
        cache: "no-store",
        headers,
        credentials: "include",
      });
      if (!r.ok) throw new Error("Not authorised");
      const data = await r.json();
      if (!data?.isAdmin && !data?.isOwner) {
        throw new Error("You're not set as owner or admin.");
      }

      // Mark admin session active so the dock buttons appear
      localStorage.setItem("vanta_admin_session", "true");
      // Tell the shell to re-check admin status (same-tab + other tabs)
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("vanta-admin-session"));

      // Refresh profile so the customer state reflects the Telegram login
      await checkSession();

      setSuccess(
        data.isOwner
          ? "Quick login: owner access enabled."
          : "Quick login: admin access enabled."
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Quick login failed.";
      setError(msg);
      toast.error("Quick login failed", msg);
    } finally {
      setQuickLoginBusy(false);
    }
  };

  // --- Link Telegram to the logged-in account ---
  const [linkTelegramOpen, setLinkTelegramOpen] = useState(false);
  const [telegramIdInput, setTelegramIdInput] = useState("");
  const [linkingTg, setLinkingTg] = useState(false);
  // Verification gate states
  const [linkPreview, setLinkPreview] = useState<{ telegramUserId: string; username: string | null; firstName: string | null; lastName: string | null; displayName: string; photoUrl: string | null; hasPhoto: boolean; firstLetter: string; color: string } | null>(null);
  const [verificationStage, setVerificationStage] = useState<"input" | "preview" | "sending" | "pending" | "confirmed" | "rejected" | "expired">("input");
  const [verificationId, setVerificationId] = useState<number | null>(null);
  const [verificationCountdown, setVerificationCountdown] = useState(0);

  const isTelegramWebApp =
    typeof window !== "undefined" &&
    typeof window.Telegram !== "undefined" &&
    Boolean(window.Telegram.WebApp?.initData);

  const linkTelegramToAccount = async () => {
    setLinkingTg(true);
    setError(null);
    setSuccess(null);
    try {
      let res: Response;
      if (isTelegramWebApp) {
        // Opened inside Telegram — link via signed initData.
        const initData =
          typeof window !== "undefined" && typeof window.Telegram !== "undefined"
            ? window.Telegram.WebApp?.initData ?? ""
            : "";
        res = await fetch("/api/store/customers/link-telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Telegram-Init-Data": initData },
          credentials: "include",
        });
      } else {
        // Web browser — link by pasting the Telegram ID.
        const id = telegramIdInput.trim();
        if (!id || !/^\d+$/.test(id)) {
          throw new Error("Enter a valid Telegram ID (numbers only, from @userinfobot).");
        }
        res = await fetch("/api/store/customers/link-telegram-id", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ telegramId: id }),
          credentials: "include",
        });
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || "Failed to link Telegram.");
      }
      setLinkTelegramOpen(false);
      setTelegramIdInput("");
      setSuccess("Telegram linked to your account.");
      await checkSession();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to link Telegram.";
      setError(msg);
      toast.error("Link failed", msg);
    } finally {
      setLinkingTg(false);
    }
  };

  // --- Verification gate: preview ---
  const fetchLinkPreview = async () => {
    const id = telegramIdInput.trim();
    if (!id || !/^\d+$/.test(id)) {
      setError("Enter a valid Telegram ID (numbers only).");
      return;
    }
    setLinkingTg(true);
    setError(null);
    try {
      const res = await fetch("/api/store/customers/link-telegram-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramId: id }),
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || "Could not look up that Telegram ID.");
      }
      const data = await res.json();
      setLinkPreview(data);
      setVerificationStage("preview");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load preview.";
      setError(msg);
      toast.error("Preview failed", msg);
    } finally {
      setLinkingTg(false);
    }
  };

  // --- Verification gate: send bot DM with Yes/No buttons ---
  const startLinkVerification = async () => {
    if (!linkPreview) return;
    setLinkingTg(true);
    setError(null);
    try {
      const res = await fetch("/api/store/customers/link-telegram-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId: linkPreview.telegramUserId,
          customerId: customer?.id,
        }),
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || "Could not start verification.");
      }
      const data = await res.json();
      setVerificationId(data.verificationId);
      setVerificationStage("sending");
      // Start polling after a short delay. The id is passed explicitly —
      // reading the `verificationId` state here would capture the
      // pre-setState (null) value, so the first poll used to silently
      // no-op and the link was never confirmed no matter what the user
      // tapped in Telegram.
      setTimeout(() => {
        setVerificationStage("pending");
        setVerificationCountdown(120);
        startCountdown();
        void pollLinkVerification(data.verificationId);
        if (verifyPollRef.current) clearInterval(verifyPollRef.current);
        verifyPollRef.current = setInterval(() => {
          void pollLinkVerification(data.verificationId);
        }, 3000);
      }, 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start verification.";
      setError(msg);
      toast.error("Verification failed", msg);
    } finally {
      setLinkingTg(false);
    }
  };

  const stopVerifyPoll = () => {
    if (verifyPollRef.current) {
      clearInterval(verifyPollRef.current);
      verifyPollRef.current = null;
    }
  };

  const pollLinkVerification = async (id: number) => {
    if (!id) return;
    try {
      const res = await fetch(`/api/store/customers/link-telegram-check?verificationId=${id}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.status === "confirmed") {
        setVerificationStage("confirmed");
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        stopVerifyPoll();
        setLinkTelegramOpen(false);
        setTelegramIdInput("");
        setLinkPreview(null);
        setVerificationId(null);
        setSuccess("Telegram linked to your account.");
        await checkSession();
      } else if (data.status === "rejected" || data.status === "expired") {
        setVerificationStage(data.status);
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        stopVerifyPoll();
      }
    } catch {
      // Non-fatal, keep polling
    }
  };

  const startCountdown = () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(() => {
      setVerificationCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(pollTimerRef.current!);
          pollTimerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelLinkVerification = () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = null;
    stopVerifyPoll();
    setVerificationStage("input");
    setVerificationId(null);
    setLinkPreview(null);
    setVerificationCountdown(0);
  };

  // --- Sign in / Create account (email + password, web) ---
  // Remember the last email used so the browser/password manager can autofill.
  const [authEmail, setAuthEmail] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("vanta_owner_email") ?? "" : ""
  );
  const [authPassword, setAuthPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // null = the two entry buttons; the styled form renders once either is pressed.
  const [authView, setAuthView] = useState<null | "login" | "create">(null);
  const [loginBusy, setLoginBusy] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);

  const rememberEmail = (emailVal: string) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("vanta_owner_email", emailVal);
    window.localStorage.setItem("vanta_customer_id", String(customer?.id ?? ""));
  };

  const submitAuth = async (mode: "login" | "create") => {
    const emailVal = authEmail.trim();
    if (!emailVal || !authPassword) {
      setError("Enter an email and password.");
      return;
    }
    const isLogin = mode === "login";
    setLoginBusy(isLogin);
    setCreateBusy(!isLogin);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(mode === "login" ? "/api/store/auth/login" : "/api/store/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "login"
            ? { email: emailVal, password: authPassword }
            : { email: emailVal, password: authPassword, playerId: localStorage.getItem("vanta_player_id") ?? undefined },
        ),
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || (mode === "login" ? "Login failed." : "Could not create the account."));
      }
      rememberEmail(emailVal);
      setAuthPassword("");
      setAuthView(null);
      setSuccess(
        mode === "login"
          ? `Logged in on ${detectPlatform()}.`
          : `Account created — you're logged in on ${detectPlatform()}.`,
      );
      await checkSession();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed.";
      setError(msg);
      toast.error(mode === "login" ? "Login failed" : "Sign-up failed", msg);
    } finally {
      setLoginBusy(false);
      setCreateBusy(false);
    }
  };

  if (loading)
    return (
      <StoreShell>
        <ProfileSkeleton />
      </StoreShell>
    );

  const displayName =
    telegramUser?.displayName ||
    telegramUser?.firstName ||
    telegramUser?.username ||
    customer?.inGameName ||
    "user";
  const tgId = telegramUser?.id ?? customer?.telegramId ?? null;
  const username = telegramUser?.username ?? null;
  // A live Telegram identity IS the link — the app authenticated this session
  // with it. Prompting such a user to "link Telegram" is asking them to link
  // the thing they are already signed in with, so it is never shown.
  const telegramLinked = Boolean(customer?.telegramLinked || telegramUser);
  const photoUrl = telegramUser?.photoUrl ?? null;
  const isActive = ordersCount > 0;

  return (
    <StoreShell>
      <PageHeading folio="04" title="Profile" backHref="/store" />

      {error && (
        <p className="mb-4 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
      {success && (
        <p className="mb-4 rounded-md border border-primary bg-primary/10 px-3 py-2 text-xs text-primary">
          {success}
        </p>
      )}

      {/* ============ PROFILE HEADER ============ */}
      <section className="mb-5 px-4">
        <div className="flex items-center gap-4 relative">
          <div className="relative shrink-0">
            <div className="h-20 w-20 rounded-full p-[3px] metallic-silver">
              <div className="h-full w-full rounded-full overflow-hidden bg-secondary">
              {photoUrl ? (
                <Image
                  src={photoUrl}
                  alt={displayName}
                  className="h-full w-full object-cover object-center"
                  loading="eager"
                  width={128}
                  height={128}
                  unoptimized
                  // The avatar route requires the caller's session cookie;
                  // the next/image optimizer fetches without cookies and
                  // 401s, so this image must bypass optimization.
                  style={{ objectFit: "cover" }}
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-ink-soft text-2xl font-bold select-none">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            </div>
            {customer && (
              <span
                className={`absolute bottom-0 left-1/2 z-10 -translate-x-1/2 translate-y-1/2 overflow-hidden rounded-2xl px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] border-2 ${
                  (customer.role ?? "customer") === "owner"
                    ? "role-owner border-background"
                    : (customer.role ?? "customer") === "admin"
                    ? "role-admin border-background"
                    : "role-customer border-background"
                }`}
              >
                {customer.role ?? "customer"}
              </span>
            )}
          </div>
          <div className="min-w-0">
            {customer ? (
              <>
                <h1 className="text-xl font-bold text-foreground tracking-tight truncate">
                  {displayName}
                </h1>
                <p className="text-xs text-ink-soft font-mono mt-0.5">Telegram ID {tgId ?? "—"}</p>
              </>
            ) : (
              <h1 className="text-xl font-bold text-foreground tracking-tight">Signed out</h1>
            )}
          </div>
        </div>
        {customer && customer.createdAt && !Number.isNaN(new Date(customer.createdAt).getTime()) && (
          <p className="mt-3 inline-flex items-center gap-1 px-2 py-1 rounded-full border border-border bg-secondary text-[10px] text-ink-soft">
            Member since{" "}
            {new Date(customer.createdAt).toLocaleDateString("en-ZA", {
              month: "long",
              year: "numeric",
            })}
          </p>
        )}
      </section>

      {/* Quick login for owner/admin — skip email/password.
          Telegram-only: outside the app there's no initData to authenticate
          with, so the button would just fail — hide it (user request). */}
      {!customer &&
        isTelegramWebApp &&
        (adminRole ||
          (typeof window !== "undefined" &&
            localStorage.getItem("vanta_admin_session") === "true")) && (
        <div className="mb-5 px-4">
          <Button
            variant="outline"
            onClick={quickLogin}
            disabled={quickLoginBusy}
            className={`relative overflow-hidden w-full flex items-center justify-center gap-2 border-2 border-background transition-all ${adminRole === "owner" ? "metallic-gold text-black" : "metallic-indigo text-white"}`}
          >
            <span className="relative z-10">
              {quickLoginBusy ? "Logging in…" : "Quick Login"}
            </span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-0 h-full w-[60%] -skew-x-[22deg] bg-gradient-to-r from-transparent via-white/50 to-transparent shine-sweep"
            />
          </Button>
        </div>
      )}

      {/* ============ TAB BAR ============ */}
      {/* Appearance/security tabs must be reachable when signed out too -
          gating the bar on `customer` hid the theme switcher entirely. */}
      <div className="mb-5 px-4">
        <div className="flex gap-1 border-b border-border">
          {(["account", "appearance", "security"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setProfileTab(t)}
              aria-pressed={profileTab === t}
              className={`shrink-0 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] border-b-2 -mb-px cursor-pointer transition-colors ${
                profileTab === t
                  ? "border-gold text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ============ EDIT PROFILE (account tab only — top) ============ */}
      {customer && profileTab === "account" && (
        <section className="mb-8 px-4">
          {/* Edit profile card — CPM2 ID + stats */}
          <div className="panel rounded-[20px] p-5 mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
              Edit profile
            </h3>
            <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-background group">
              <span className="text-xs font-medium text-muted-foreground">CPM2 ID</span>
              <div className="flex items-center gap-2">
                {editingCpm2Id ? (
                  <input
                    type="text"
                    value={cpm2IdValue}
                    onChange={(e) => setCpm2IdValue(e.target.value)}
                    className="flex-1 border border-input bg-background px-2 py-1 rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveCpm2Id();
                      if (e.key === "Escape") cancelEditingCpm2Id();
                    }}
                  />
                ) : (
                  <span className="text-sm font-mono text-foreground">{customer.playerId ?? "—"}</span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={editingCpm2Id ? cancelEditingCpm2Id : startEditingCpm2Id}
                  disabled={saving}
                  aria-label={editingCpm2Id ? "Cancel edit" : "Edit CPM2 ID"}
                >
                  {editingCpm2Id ? "✕" : "✎"}
                </Button>
              </div>
            </div>

            {/* Stats row */}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="px-4 py-3 rounded-lg border border-border bg-background">
                <span className="text-xs font-medium text-muted-foreground">Orders</span>
                <span className="text-lg font-bold text-foreground mt-1 block">{ordersCount}</span>
              </div>
              <div className="px-4 py-3 rounded-lg border border-border bg-background">
                <span className="text-xs font-medium text-muted-foreground">Wishlist</span>
                <span className="text-lg font-bold text-foreground mt-1 block">{wishlistCount}</span>
              </div>
            </div>
            <p className={`mt-2 text-xs ${isActive ? "text-racing font-medium" : "text-muted-foreground"}`}>
              {isActive ? "Active buyer" : "No orders yet. Browse the catalogue"}
            </p>
          </div>
          <div className="space-y-3">
            {customer.email && (
              <div className="mb-4 px-3 py-2 rounded-lg border border-border bg-background flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Email</span>
                  <p className="text-sm text-foreground truncate max-w-[200px]">{customer.email}</p>
                </div>
              </div>
            )}

            {/* Telegram link status / linking */}
            {telegramLinked ? (
              <div className="mb-4 px-3 py-2 rounded-lg border border-border bg-background flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Telegram</span>
                  <p className="text-sm text-foreground">
                    Linked ✓ <span className="font-mono text-xs text-ink-soft">{customer.telegramId}</span>
                  </p>
                </div>
                <span className="text-[10px] text-ink-faint">Same account on web &amp; in-app</span>
              </div>
            ) : !linkTelegramOpen ? (
              <Button
                variant="outline"
                onClick={() => setLinkTelegramOpen(true)}
                className="w-full mb-4 flex items-center justify-center gap-2"
                disabled={linkingTg}
              >
                <ProfileIcon className="w-4 h-4" />
                {linkingTg ? "Linking…" : "Link your Telegram"}
              </Button>
            ) : (
              <div className="mb-4 rounded-lg border border-border bg-background p-3 space-y-3">
                {isTelegramWebApp ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Telegram detected — link this app&apos;s account to your store login:
                    </p>
                    <Button variant="primary" onClick={linkTelegramToAccount} className="w-full" disabled={linkingTg}>
                      {linkingTg ? "Linking…" : "Link Telegram account"}
                    </Button>
                  </>
                ) : (
                  <>
                    {/* Verification gate UI */}
                    {verificationStage === "input" && (
                      <>
                        <Field
                          label="Telegram ID"
                          hint="Your numeric Telegram user ID (e.g. from @userinfobot)"
                        >
                          <TextInput
                            value={telegramIdInput}
                            onChange={(e) => setTelegramIdInput(e.target.value)}
                            placeholder="e.g. 7036681178"
                            inputMode="numeric"
                          />
                        </Field>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchLinkPreview}
                            disabled={linkingTg || !telegramIdInput.trim()}
                            className="flex-1"
                          >
                            Preview
                          </Button>
                          <Button
                            variant="primary"
                            onClick={fetchLinkPreview}
                            disabled={linkingTg || !telegramIdInput.trim()}
                            className="flex-1"
                          >
                            Preview &amp; Link
                          </Button>
                        </div>
                      </>
                    )}
                    {verificationStage === "preview" && linkPreview && (
                      <>
                        <p className="text-xs text-muted-foreground text-center mb-2">
                          Is this your Telegram profile?
                        </p>
                        <div className="flex items-center justify-center gap-3 mb-3">
                          {linkPreview.hasPhoto ? (
                            <Image
                              src={linkPreview.photoUrl!}
                              alt={linkPreview.displayName}
                              className="w-16 h-16 rounded-full border-2 border-gold/40 object-cover bg-secondary"
                              loading="eager"
                              width={64}
                              height={64}
                              unoptimized
                              style={{ objectFit: "cover" }}
                            />
                          ) : (
                            <div
                              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg"
                              style={{
                                backgroundColor: linkPreview.color,
                                fontFamily: '"Georgia", "Times New Roman", serif',
                              }}
                            >
                              {linkPreview.firstLetter}
                            </div>
                          )}
                        </div>
                        <div className="text-center mb-3">
                          <p className="text-sm font-medium text-foreground">{linkPreview.displayName}</p>
                          {linkPreview.username && <span className="text-[10px] text-ink-soft">@{linkPreview.username}</span>}
                          {linkPreview.firstName && <span className="text-[10px] text-ink-soft ml-2">{linkPreview.firstName}</span>}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setVerificationStage("input");
                              setLinkPreview(null);
                            }}
                            className="flex-1"
                          >
                            Different ID
                          </Button>
                          <Button
                            variant="primary"
                            onClick={startLinkVerification}
                            disabled={linkingTg}
                            className="flex-1"
                          >
                            {linkingTg ? "Sending…" : "Yes, send verification"}
                          </Button>
                        </div>
                      </>
                    )}
                    {verificationStage === "sending" && (
                      <>
                        <div className="flex flex-col items-center justify-center py-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gold mb-2"></div>
                          <p className="text-xs text-muted-foreground text-center">Sending verification to your Telegram…</p>
                        </div>
                      </>
                    )}
                    {verificationStage === "pending" && verificationId && (
                      <>
                        <p className="text-xs text-muted-foreground text-center mb-2">
                          Verification sent to Telegram ID{" "}
                          <span className="font-mono">{linkPreview?.telegramUserId}</span>
                        </p>
                        <div className="flex items-center justify-center gap-3 mb-3">
                          <div className="w-12 h-12 rounded-full border-4 border-gold/40 relative">
                            <div className="absolute inset-0 rounded-full border-t-4 border-gold animate-spin"></div>
                          </div>
                        </div>
                        <p className="text-[10px] text-ink-soft text-center mb-3">
                          Open your Telegram and tap <b>Yes, it&apos;s me</b> or <b>No, it&apos;s not me</b>. Expires in{" "}
                          <span className="font-mono text-sm text-foreground">{verificationCountdown}s</span>
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={cancelLinkVerification}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                        </div>
                      </>
                    )}
                    {verificationStage === "confirmed" && (
                      <>
                        <div className="flex flex-col items-center justify-center py-4">
                          <div className="w-12 h-12 rounded-full bg-racing flex items-center justify-center mb-2">
                            <span className="text-2xl">✓</span>
                          </div>
                          <p className="text-xs font-medium text-racing text-center">Telegram linked successfully!</p>
                        </div>
                      </>
                    )}
                    {verificationStage === "rejected" && (
                      <>
                        <div className="flex flex-col items-center justify-center py-4">
                          <div className="w-12 h-12 rounded-full bg-destructive flex items-center justify-center mb-2">
                            <span className="text-2xl">✗</span>
                          </div>
                          <p className="text-xs font-medium text-destructive text-center">Verification rejected.</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={cancelLinkVerification}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                        </div>
                      </>
                    )}
                    {verificationStage === "expired" && (
                      <>
                        <div className="flex flex-col items-center justify-center py-4">
                          <div className="w-12 h-12 rounded-full bg-destructive flex items-center justify-center mb-2">
                            <span className="text-2xl">⏰</span>
                          </div>
                          <p className="text-xs font-medium text-destructive text-center">Verification expired.</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={cancelLinkVerification}
                            className="mt-2 w-full"
                          >
                            Try again
                          </Button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
            {!showCredentials ? (
              <Button
                variant="primary"
                onClick={() => setShowCredentials(true)}
                className="w-full"
                disabled={saving}
              >
                {saving ? "Saving…" : "Change email / password"}
              </Button>
            ) : (
              <form onSubmit={saveCredentials} className="space-y-3">
                <Field label="New email (optional)">
                  <TextInput
                    type="email"
                    value={emailValue}
                    onChange={(e) => setEmailValue(e.target.value)}
                    placeholder="you@example.com"
                    className="flex-1"
                  />
                </Field>
                <Field label="New password (optional)">
                  <div className="relative">
                    <TextInput
                      type={showPassword ? "text" : "password"}
                      value={passwordValue}
                      onChange={(e) => setPasswordValue(e.target.value)}
                      placeholder="••••••••"
                      className="flex-1 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-soft hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <HideIcon /> : <ShowIcon />}
                    </button>
                  </div>
                </Field>
                <div className="flex gap-2">
                  <Button type="submit" variant="primary" disabled={saving} className="flex-1">
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                  <Button variant="outline" type="button" onClick={() => setShowCredentials(false)} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </div>
          <div className="mt-5 pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={logout}
              disabled={saving}
              className="w-full border-destructive/60 text-destructive hover:bg-destructive/10"
            >
              {saving ? "Logging out…" : "Log out"}
            </Button>
          </div>
        </section>
      )}

      {/* ============ LOGGED-OUT ENTRY ============
          Account tab only. Two buttons — Log in / Create account — both open
          the styled auth form (user request: the inline field card goes away). */}
      {!customer && profileTab === "account" && (
        <section className="mb-8 px-4">
          {!authView ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button variant="primary" className="sm:flex-1" onClick={() => setAuthView("login")}>
                Log in
              </Button>
              <Button variant="outline" className="sm:flex-1" onClick={() => setAuthView("create")}>
                Create account
              </Button>
            </div>
          ) : (
            <div className="vanta-auth">
              <form
                className="vanta-auth-card"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitAuth(authView);
                }}
              >
                <span className="vanta-auth-title">{authView === "login" ? "Login" : "Sign up"}</span>
                <div className="vanta-auth-field">
                  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <defs>
                      <linearGradient id="vanta-auth-grad-mail" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="black" />
                        <stop offset="100%" stopColor="white" />
                      </linearGradient>
                    </defs>
                    <g stroke="url(#vanta-auth-grad-mail)" fill="none" strokeWidth={1}>
                      <path d="M21.6365 5H3L12.2275 12.3636L21.6365 5Z" />
                      <path d="M16.5 11.5L22.5 6.5V17L16.5 11.5Z" />
                      <path d="M8 11.5L2 6.5V17L8 11.5Z" />
                      <path d="M9.5 12.5L2.81805 18.5002H21.6362L15 12.5L12 15L9.5 12.5Z" />
                    </g>
                  </svg>
                  <input
                    className="vanta-auth-input"
                    type="email"
                    name="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="Email"
                    autoComplete="email"
                    aria-label="Email"
                  />
                </div>
                <div className="vanta-auth-field">
                  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <defs>
                      <linearGradient id="vanta-auth-grad-key" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="black" />
                        <stop offset="100%" stopColor="white" />
                      </linearGradient>
                    </defs>
                    <g stroke="url(#vanta-auth-grad-key)" fill="none" strokeWidth={1}>
                      <path d="M3.5 15.5503L9.20029 9.85L12.3503 13L11.6 13.7503H10.25L9.8 15.1003L8 16.0003L7.55 18.2503L5.5 19.6003H3.5V15.5503Z" />
                      <path d="M16 3.5H11L8.5 6L16 13.5L21 8.5L16 3.5Z" />
                      <path d="M16 10.5L18 8.5L15 5.5H13L12 6.5L16 10.5Z" />
                    </g>
                  </svg>
                  <input
                    className="vanta-auth-input"
                    type="password"
                    name="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="Password"
                    autoComplete={authView === "login" ? "current-password" : "new-password"}
                    aria-label="Password"
                  />
                </div>
                <div className="vanta-auth-submit">
                  <input
                    className="vanta-auth-submit-input"
                    type="submit"
                    value={
                      loginBusy || createBusy
                        ? "Working…"
                        : authView === "login"
                          ? "Login"
                          : "Create account"
                    }
                    disabled={loginBusy || createBusy || !authEmail.trim() || !authPassword}
                  />
                </div>
                <div className="vanta-auth-texture" aria-hidden="true" />
              </form>
              <BackButton
                              label="Back"
                              onClick={() => setAuthView(null)}
                              className="mt-4 self-center"
                            />
            </div>
          )}
        </section>
      )}

      {/* ============ APPEARANCE TAB ============ */}
      {profileTab === "appearance" && (
        <section className="mb-8 px-4">
          <ThemeGallery />
        </section>
      )}

      {/* ============ SECURITY TAB ============
          The policies of using the app live here (user request): this tab is
          the home for account security AND the /legal doc links. Notifications
          still need a signed-in customer; policies are public. */}
      {profileTab === "security" && (
        <section className="mb-8 px-4">
          {customer && (
            <div className="panel rounded-[20px] p-5 mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
                Notifications
              </h3>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-foreground">Telegram notifications</span>
                  <p className="text-[10px] text-ink-soft">Get order updates via Telegram bot</p>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={notificationsEnabled === true}
                    onChange={toggleNotifications}
                    disabled={notificationsSaving || notificationsEnabled === null}
                    aria-pressed={notificationsEnabled === true}
                    aria-label="Toggle Telegram notifications"
                  />
                  <span className="slider" />
                </label>
              </div>
            </div>
          )}

          <div className="panel rounded-[20px] p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">
              Policies
            </h3>
            <p className="text-[10px] text-ink-soft mb-3">
              The rules that apply when you use this app and buy from the store.
            </p>
            <ul className="flex flex-col">
              {POLICY_DOCS.map((p) => (
                <li key={p.slug}>
                  <a
                    href={`/store/profile/legal/${p.slug}`}
                    className="flex items-center justify-between gap-2 border-b border-border py-2.5 text-sm font-medium text-foreground hover:text-gold transition-colors"
                  >
                    <span>{p.title}</span>
                    <span aria-hidden="true" className="text-ink-faint text-xs">→</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ============ PROFILE STATS (bottom, account tab only) ============ */}
      {customer && profileTab === "account" && (
        <section className="mb-8 px-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-secondary p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft">
                Wallet balance
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xl font-bold text-foreground">
                <StarIcon className="h-5 w-5 text-gold" />
                0
              </p>
              <Link
                href="/store/support"
                className="mt-2 inline-flex min-h-8 items-center text-xs font-bold uppercase tracking-[0.16em] text-primary hover:underline"
              >
                Top up
              </Link>
            </div>

            <div className="rounded-2xl border border-border bg-secondary p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft">
                Total spent
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xl font-bold text-foreground">
                <StarIcon className="h-5 w-5 text-gold" />
                {spentStars}
              </p>
              <p className="mt-2 text-[11px] text-ink-faint">Stars paid on verified orders</p>
            </div>

            <div className="rounded-2xl border border-border bg-secondary p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft">
                Total orders
              </p>
              <p className="mt-1 text-xl font-bold text-foreground">{ordersCount}</p>
              <p className="mt-2 text-[11px] text-ink-faint">All time</p>
            </div>

            <div className="rounded-2xl border border-border bg-secondary p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft">
                Top-ups made
              </p>
              <p className="mt-1 text-xl font-bold text-foreground">{topUpCount}</p>
              <p className="mt-2 text-[11px] text-ink-faint">Stars payments</p>
            </div>

            <div className="rounded-2xl border border-border bg-secondary p-4 col-span-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft">
                Reviews written
              </p>
              <p className="mt-1 text-xl font-bold text-foreground">0</p>
              <p className="mt-2 text-[11px] text-ink-faint">Reviews are not live yet — this fills once the feature ships.</p>
            </div>
          </div>
        </section>
      )}

      {/* Log out sits at the bottom of the account tab */}
    </StoreShell>
  );
}
