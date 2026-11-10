"use client";

import { useEffect, useState } from "react";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/ui/Toaster";

type VantaCustomer = {
  id: number;
  inGameName: string;
  playerId: string;
  email: string;
  currencyPref: string;
};

export function ProfileClient() {
  const [customer, setCustomer] = useState<VantaCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Load saved email from localStorage so it shows as linked on page load
  const [email, setEmail] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("vanta_owner_email") ?? "" : ""
  );
  const [password, setPassword] = useState("");
  const [telegramId, setTelegramId] = useState("");
  const [playerId, setPlayerId] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("vanta_player_id") ?? "" : ""
  );
  const [orderNotifications, setOrderNotifications] = useState(false);
  const [linkMode, setLinkMode] = useState<"telegram" | "email" | null>(null);
  const toast = useToast();

  // Detect if opened inside Telegram Mini App / WebApp
  const isTelegram =
    typeof window !== "undefined" &&
    typeof window.Telegram !== "undefined" &&
    Boolean(window.Telegram.WebApp?.initData);

  const { mode, setMode } = useTheme();

  async function checkSession() {
    try {
      const res = await fetch("/api/store/profile", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.customer) {
          setCustomer(data.customer);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  // Check session cookie on mount — deferred so no setState lands in the
  // effect's synchronous phase (react-hooks/set-state-in-effect).
  useEffect(() => {
    let alive = true;
    queueMicrotask(() => {
      if (alive) checkSession();
    });
    return () => {
      alive = false;
    };
  }, []);

  // Load order notifications preference from profile
  useEffect(() => {
    if (customer?.id) {
      fetch(`/api/store/customers/${customer.id}/notifications`, { credentials: "include" })
        .then((r) => r.json())
        .then((data) => { if (data.enabled !== undefined) setOrderNotifications(data.enabled); })
        .catch(() => {});
    }
  }, [customer]);

  async function linkTelegram() {
    setLoading(true);
    setError(null);
    try {
      const initData =
        typeof window !== "undefined" && typeof window.Telegram !== "undefined"
          ? window.Telegram.WebApp?.initData ?? ""
          : "";

      const res = await fetch("/api/store/customers/link-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Telegram-Init-Data": initData },
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || "Link failed — try again.");
      }

      const data = await res.json();
      setCustomer({ id: data.customerId, inGameName: data.inGameName, playerId: "", email: "", currencyPref: "ZAR" });
      if (typeof window !== "undefined") {
        window.localStorage.setItem("vanta_customer_id", String(data.customerId));
      }
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Link failed — try again.";
      setError(msg);
      toast.error("Link failed", msg);
    } finally {
      setLoading(false);
    }
  }

  async function linkByTelegramId() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/store/customers/link-telegram-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramId: telegramId.trim() }),
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || "Failed to link Telegram ID.");
      }

      const data = await res.json();
      setCustomer({ id: data.customerId, inGameName: data.inGameName, playerId: "", email: "", currencyPref: "ZAR" });
      if (typeof window !== "undefined") {
        window.localStorage.setItem("vanta_customer_id", String(data.customerId));
      }
      setTelegramId("");
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to link Telegram ID.";
      setError(msg);
      toast.error("Link failed", msg);
    } finally {
      setLoading(false);
    }
  }

  async function saveEmailPassword() {
    setLoading(true);
    setError(null);
    try {
      const emailVal = email.trim();
      const res = await fetch("/api/store/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailVal, password, playerId: playerId.trim() || undefined }),
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || "Failed to save email/password.");
      }

      const data = await res.json();
      setCustomer(data.customer);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("vanta_owner_email", emailVal);
        window.localStorage.setItem("vanta_customer_id", String(data.customer.id));
        setEmail(emailVal);
      }

      setSuccess("Account created and logged in!");
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save email/password.";
      setSuccess(null);
      setError(msg);
      toast.error("Save failed", msg);
    } finally {
      setLoading(false);
    }
  }

  async function loginWithEmail() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/store/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || "Login failed.");
      }

      const data = await res.json();
      setCustomer(data.customer);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("vanta_customer_id", String(data.customer.id));
      }
      setSuccess("Logged in successfully!");
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed.";
      setSuccess(null);
      setError(msg);
      toast.error("Login failed", msg);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/store/auth/logout", { method: "POST", credentials: "include" });
      setCustomer(null);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("vanta_customer_id");
        window.localStorage.removeItem("vanta_owner_email");
      }
      setSuccess("Logged out.");
    } catch {
      setError("Logout failed.");
      toast.error("Logout failed", "Could not log out — try again.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleOrderNotifications() {
    if (!customer?.id) return;
    setLoading(true);
    try {
      const newValue = !orderNotifications;
      const res = await fetch(`/api/store/customers/${customer.id}/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newValue }),
        credentials: "include",
      });
      if (res.ok) {
        setOrderNotifications(newValue);
        setSuccess(newValue ? "Order notifications enabled" : "Order notifications disabled");
      } else {
        setError("Failed to update notification preference");
      }
    } catch {
      setError("Failed to update notification preference");
    } finally {
      setLoading(false);
    }
  }

  return (
      <StoreShell>
        <PageHeading folio="04" title="Profile" backHref="/store" />
        <div className="panel rounded-xl border border-border p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Customer profile</h3>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : customer ? (
          // LOGGED IN STATE
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Logged in as {customer.inGameName}</p>
            <p className="text-xs text-muted-foreground">Player ID: {customer.playerId}</p>
            {customer.email && <p className="text-xs text-muted-foreground">Email: {customer.email}</p>}
            <p className="text-xs text-muted-foreground">Orders and delivery history will appear here.</p>

            <div className="mt-4 pt-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={logout} disabled={loading}>
                {loading ? "Logging out…" : "Log out"}
              </Button>
            </div>
          </div>
        ) : email ? (
          // HAS SAVED EMAIL BUT NOT LOGGED IN
          <>
            <p className="text-sm text-muted-foreground">
              You have a saved email. Log in to see your orders.
            </p>

            <div className="mt-4 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Saved email:</p>
              <p className="text-sm font-medium text-foreground">{email}</p>

              <div className="mt-3 flex flex-col gap-2">
                <Field label="Password" htmlFor="login-password" hint="Enter password to log in">
                  <TextInput
                    id="login-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    placeholder="••••••••"
                  />
                </Field>
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={loginWithEmail}
                  disabled={loading || !password}
                >
                  {loading ? "Logging in…" : "Log in with email"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEmail("")} disabled={loading}>
                  Remove saved email
                </Button>
              </div>
              {success && <p className="mt-2 text-xs text-primary">{success}</p>}
            </div>

            <div className="mt-4 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Or link your Telegram:</p>
              {isTelegram ? (
                <Button variant="primary" className="w-full" onClick={linkTelegram} disabled={loading}>
                  {loading ? "Linking…" : "Link Telegram"}
                </Button>
              ) : (
                <p className="text-[10px] text-ink-faint">Open this page inside Telegram to link automatically.</p>
              )}
            </div>
          </>
        ) : (
          // NOT LINKED AT ALL — show options first, expand after choice
          <>
            {linkMode === null ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Link your Telegram to see your orders and delivery history here.
                </p>
                <div className="mt-4 pt-3 border-t border-border space-y-2">
                  {!isTelegram && (
                    <Button
                      variant="primary"
                      className="w-full"
                      onClick={() => setLinkMode("telegram")}
                      disabled={loading}
                    >
                      {loading ? "Linking…" : "Link Telegram ID"}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setLinkMode("email")}
                    disabled={loading}
                  >
                    Create account &amp; log in
                  </Button>
                  {isTelegram ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={linkTelegram}
                      disabled={loading}
                    >
                      {loading ? "Linking…" : "Link via Telegram WebApp"}
                    </Button>
                  ) : (
                    <p className="text-[10px] text-ink-faint text-center">
                      Open this page inside Telegram to link automatically.
                    </p>
                  )}
                </div>
              </div>
            ) : linkMode === "telegram" ? (
              <div className="space-y-3">
                {!isTelegram && (
                  <div className="mt-4 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2">
                      Or paste your Telegram ID:
                    </p>
                    <Field label="Telegram ID" htmlFor="telegram-id" hint="Your Telegram user ID (e.g. from @userinfobot)">
                      <TextInput
                        id="telegram-id"
                        value={telegramId}
                        onChange={(e) => setTelegramId(e.target.value)}
                        placeholder="e.g. 7036681178"
                      />
                    </Field>
                    <Button
                      variant="primary"
                      className="w-full"
                      onClick={linkByTelegramId}
                      disabled={loading || !telegramId}
                    >
                      {loading ? "Linking…" : "Link Telegram ID"}
                    </Button>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setLinkMode(null)}>
                      Back
                    </Button>
                  </div>
                )}
                {isTelegram && (
                  <div className="mt-4 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2">
                      Link via Telegram WebApp:
                    </p>
                    <Button
                      variant="primary"
                      className="w-full"
                      onClick={linkTelegram}
                      disabled={loading}
                    >
                      {loading ? "Linking…" : "Link Telegram"}
                    </Button>
                    <p className="text-[10px] text-ink-faint text-center mt-2">
                      Open this page inside Telegram to link automatically.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              // linkMode === "email"
              <div className="space-y-3">
                <div className="mt-4 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2">
                    Set up email &amp; password for web login:
                  </p>
                  <div className="flex flex-col gap-2">
                    <Field label="Email" htmlFor="account-email" hint="Used to log in on the web">
                      <TextInput
                        id="account-email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                      />
                    </Field>
                    {playerId ? (
                      <p className="text-[10px] text-primary">Linked to your checkout Player ID: {playerId}</p>
                    ) : (
                      <Field label="Player ID (optional)" htmlFor="setup-player-id" hint="Your CPM2 Player ID from checkout">
                        <TextInput
                          id="setup-player-id"
                          value={playerId}
                          onChange={(e) => setPlayerId(e.target.value)}
                          placeholder="e.g. AB123456"
                        />
                      </Field>
                    )}
                    <Field label="Password" htmlFor="account-password" hint="Set a password to log in from the web">
                      <TextInput
                        id="account-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        type="password"
                        placeholder="••••••••"
                      />
                    </Field>
                    <Button
                      variant="primary"
                      className="w-full"
                      onClick={saveEmailPassword}
                      disabled={loading || !email || !password}
                    >
                      {loading ? "Creating account…" : "Create account &amp; log in"}
                    </Button>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setLinkMode(null)}>
                      Back
                    </Button>
                  </div>
                  {success && <p className="mt-2 text-xs text-primary">{success}</p>}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Wishlist */}
      {customer && (
        <div className="mt-8 panel rounded-xl border border-border p-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
            Wishlist
          </h3>
          <div className="text-center py-8 text-ink-soft">
            <span className="text-[24px] mb-2 block">🤍</span>
            <p className="text-sm">Your saved builds will appear here.</p>
            <p className="text-[10px] text-ink-faint mt-1">Tap the heart on any vehicle to save it.</p>
          </div>
        </div>
      )}

      {/* Settings */}
      <div className="mt-8 panel rounded-xl border border-border p-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
          Settings
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-md border border-border">
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
          {customer && (
            <div className="flex items-center justify-between p-3 rounded-md border border-border">
              <div>
                <span className="text-sm font-medium text-foreground">Order notifications</span>
                <p className="text-[10px] text-ink-soft">Get delivery updates on Telegram</p>
              </div>
              <button
                className={`w-10 h-5 rounded-full relative transition-colors ${orderNotifications ? "bg-primary" : "bg-border"}`}
                onClick={() => toggleOrderNotifications()}
                aria-label={orderNotifications ? "Disable order notifications" : "Enable order notifications"}
                disabled={loading}
              >
                <span
                  className={`absolute top-1 w-3 h-3 bg-background rounded-full transition-transform ${orderNotifications ? "right-1" : "left-1"}`}
                />
              </button>
            </div>
          )}
        </div>
      </div>
    </StoreShell>
  );
}
