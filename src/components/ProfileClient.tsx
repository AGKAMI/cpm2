"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/ui/Toaster";
import { vantaApi, formatPrice, type VantaCustomer, type TelegramUser } from "@/lib/store/client";

type Order = {
  id: string;
  orderState: string;
  paymentState: string;
  amountCents: number;
  currency: string;
  createdAt: string;
};

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

export function ProfileClient() {
  const [customer, setCustomer] = useState<VantaCustomer | null>(null);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [ordersCount, setOrdersCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [editingCpm2Id, setEditingCpm2Id] = useState(false);
  const [cpm2IdValue, setCpm2IdValue] = useState("");
  const [showCredentials, setShowCredentials] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [saving, setSaving] = useState(false);
  const { mode, setMode } = useTheme();
  const toast = useToast();

  async function checkSession() {
    try {
      const res = await fetch("/api/store/profile", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.customer) setCustomer(data.customer);
        if (data.telegramUser) setTelegramUser(data.telegramUser);

        // Fetch stats
        const [ordersRes, wishlistRes] = await Promise.all([
          fetch("/api/store/orders", { credentials: "include" }),
          fetch("/api/store/wishlist", { credentials: "include" }),
        ]);

        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          setOrdersCount(Array.isArray(ordersData.orders) ? ordersData.orders.length : 0);
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

  useEffect(() => {
    let alive = true;
    queueMicrotask(() => {
      if (alive) checkSession();
    });
    return () => {
      alive = false;
      if (pollTimer) clearInterval(pollTimer);
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
      setSuccess("Logged out.");
    } catch {
      setError("Logout failed.");
      toast.error("Logout failed", "Could not log out — try again.");
    } finally {
      setSaving(false);
    }
  }

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
      // Start polling after a short delay
      setTimeout(() => {
        setVerificationStage("pending");
        setVerificationCountdown(120);
        startCountdown();
        pollLinkVerification();
      }, 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start verification.";
      setError(msg);
      toast.error("Verification failed", msg);
    } finally {
      setLinkingTg(false);
    }
  };

  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const pollLinkVerification = async () => {
    if (!verificationId) return;
    try {
      const res = await fetch(`/api/store/customers/link-telegram-check?verificationId=${verificationId}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.status === "confirmed") {
        setVerificationStage("confirmed");
        if (pollTimer) clearInterval(pollTimer);
        setLinkTelegramOpen(false);
        setTelegramIdInput("");
        setLinkPreview(null);
        setVerificationId(null);
        setSuccess("Telegram linked to your account.");
        await checkSession();
      } else if (data.status === "rejected" || data.status === "expired") {
        setVerificationStage(data.status);
        if (pollTimer) clearInterval(pollTimer);
      }
    } catch {
      // Non-fatal, keep polling
    }
  };

  const startCountdown = () => {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      setVerificationCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(pollTimer!);
          pollTimer = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelLinkVerification = () => {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
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
      setSuccess(mode === "login" ? "Logged in." : "Account created — you're logged in.");
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
        <PageHeading folio="04" title="Profile" backHref="/store" />
        <div className="p-4 text-center text-muted-foreground">Loading profile…</div>
      </StoreShell>
    );

  const displayName =
    telegramUser?.displayName ||
    telegramUser?.firstName ||
    telegramUser?.username ||
    customer?.inGameName ||
    "there";
  const tgId = telegramUser?.id ?? null;
  const username = telegramUser?.username ?? null;
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
      <section className="mb-8 px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="relative group">
            <motion.div
              layoutId="vanta-profile-avatar"
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="h-32 w-32 rounded-full overflow-hidden border-4 border-gold bg-secondary"
            >
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={displayName}
                  className="h-full w-full object-cover object-center"
                  loading="eager"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-ink-soft text-2xl font-bold select-none">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </motion.div>

            {/* Role badge — pinned to the avatar's bottom edge */}
            {(() => {
              const role = customer?.role ?? "customer";
              if (role === "owner" || role === "admin") {
                return (
                  <span
                    className={`absolute -bottom-2 left-1/2 -translate-x-1/2 z-10 overflow-hidden rounded-2xl px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] border-2 border-background ${role === "owner" ? "metallic-gold text-black" : "metallic-indigo text-white"}`}
                  >
                    {role}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute top-0 h-full w-[60%] -skew-x-[22deg] bg-gradient-to-r from-transparent via-white/45 to-transparent shine-sweep"
                    />
                  </span>
                );
              }
              return (
                <span
                  className={`absolute -bottom-2 left-1/2 -translate-x-1/2 z-10 overflow-hidden rounded-2xl px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] border-2 border-background metallic-silver text-ink-soft`}
                >
                  Customer
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute top-0 h-full w-[60%] -skew-x-[22deg] bg-gradient-to-r from-transparent via-white/45 to-transparent shine-sweep"
                  />
                </span>
              );
            })()}
          </div>

          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {displayName}
          </h1>
          {username && <span className="text-ink-soft text-sm">@{username}</span>}

          <div className="w-full max-w-xs space-y-2">
            <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-background">
              <span className="text-xs font-medium text-muted-foreground">ID</span>
              <span className="text-sm font-mono text-foreground">{tgId ?? "—"}</span>
            </div>
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
                  <span className="text-sm font-mono text-foreground">{customer?.playerId ?? "—"}</span>
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
          </div>

          {/* Stats row */}
          <div className="mt-6 w-full max-w-xs grid grid-cols-2 gap-4">
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
            {isActive ? "Active buyer" : "No orders yet — browse the catalogue"}
          </p>
        </div>
      </section>

      {/* ============ ACCOUNT SETTINGS ============ */}
      <section className="mb-8 px-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
          Account
        </h3>

        {!customer ? (
          /* Logged out — sign in or create an account */
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Log in to see your orders and delivery history.
            </p>
            <Field label="Email">
              <TextInput
                type="email"
                name="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </Field>
            <Field label="Password">
              <div className="relative">
                <TextInput
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pr-10"
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
            <Button
              variant="primary"
              className="w-full"
              onClick={() => submitAuth("login")}
              disabled={loginBusy || !authEmail.trim() || !authPassword}
            >
              {loginBusy ? "Working…" : "Log in"}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => submitAuth("create")}
              disabled={createBusy || !authEmail.trim() || !authPassword}
            >
              {createBusy ? "Working…" : "Create account"}
            </Button>
            <p className="text-[10px] text-ink-faint text-center">
              Inside Telegram? Open the store in the app to link automatically — or log in here and link your Telegram ID after.
            </p>
          </div>
        ) : (
          <>
            {customer.email && (
              <div className="mb-4 px-3 py-2 rounded-lg border border-border bg-background flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Email</span>
                  <p className="text-sm text-foreground truncate max-w-[200px]">{customer.email}</p>
                </div>
              </div>
            )}

            {/* Telegram link status / linking */}
            {customer.telegramLinked ? (
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
                className="w-full mb-4"
                disabled={linkingTg}
              >
                {linkingTg ? "Linking…" : "Link your Telegram"}
              </Button>
            ) : (
              <div className="mb-4 rounded-lg border border-border bg-background p-3 space-y-3">
                {isTelegramWebApp ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Telegram detected — link this app's account to your store login:
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
                            <img
                              src={linkPreview.photoUrl!}
                              alt={linkPreview.displayName}
                              className="w-16 h-16 rounded-full border-2 border-gold/40 object-cover bg-secondary"
                              loading="eager"
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
                          Open your Telegram and tap <b>Yes, it's me</b> or <b>No, it's not me</b>. Expires in{" "}
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
                            className="mt-2 w-full"
                          >
                            Try again
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
                variant="outline"
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
          </>
        )}

        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-foreground">Preferred mode</span>
            <p className="text-[10px] text-ink-soft">Choose between dark and light theme</p>
          </div>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "night" | "paper")}
            className="rounded-md border border-border px-2 py-1 text-sm text-foreground bg-background focus:outline-none"
            aria-label="Preferred display mode"
          >
            <option value="night">Dark</option>
            <option value="paper">Light</option>
          </select>
        </div>
      </section>

      {/* ============ ACTIONS ============ */}
      {customer && (
        <section className="px-4">
          <Button variant="destructive" onClick={logout} disabled={saving} className="w-full">
            {saving ? "Logging out…" : "Log out"}
          </Button>
        </section>
      )}
    </StoreShell>
  );
}
