"use client";

import { useEffect, useState } from "react";
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

  // --- Sign in / Create account (email + password, web) ---
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const submitAuth = async (mode: "login" | "create") => {
    const emailVal = authEmail.trim();
    if (!emailVal || !authPassword) {
      setError("Enter an email and password.");
      return;
    }
    setAuthBusy(true);
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
      setAuthEmail("");
      setAuthPassword("");
      setSuccess(mode === "login" ? "Logged in." : "Account created — you're logged in.");
      await checkSession();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed.";
      setError(msg);
      toast.error(mode === "login" ? "Login failed" : "Sign-up failed", msg);
    } finally {
      setAuthBusy(false);
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
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={displayName}
                className="w-32 h-32 rounded-full border-4 border-gold/40 object-cover bg-secondary object-center"
                loading="eager"
              />
            ) : (
              <div className="w-32 h-32 rounded-full border-4 border-gold/40 bg-secondary flex items-center justify-center text-ink-soft text-2xl font-bold select-none">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className={`absolute bottom-0 right-0 flex items-center justify-center w-8 h-8 rounded-full border-2 border-background ${isActive ? "bg-racing text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
              <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
            </span>
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
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </Field>
            <Field label="Password">
              <TextInput
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </Field>
            <Button
              variant="primary"
              className="w-full"
              onClick={() => submitAuth("login")}
              disabled={authBusy || !authEmail.trim() || !authPassword}
            >
              {authBusy ? "Working…" : "Log in"}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => submitAuth("create")}
              disabled={authBusy || !authEmail.trim() || !authPassword}
            >
              {authBusy ? "Working…" : "Create account"}
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
                    <Button variant="primary" onClick={linkTelegramToAccount} className="w-full" disabled={linkingTg || !telegramIdInput.trim()}>
                      {linkingTg ? "Linking…" : "Link Telegram ID"}
                    </Button>
                  </>
                )}
                <Button variant="outline" size="sm" onClick={() => setLinkTelegramOpen(false)} className="w-full" disabled={linkingTg}>
                  Cancel
                </Button>
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
                  <TextInput
                    type="password"
                    value={passwordValue}
                    onChange={(e) => setPasswordValue(e.target.value)}
                    placeholder="••••••••"
                    className="flex-1"
                  />
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
