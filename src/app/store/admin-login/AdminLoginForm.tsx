"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loginAsAdmin = async () => {
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
        });
        if (!r.ok) throw new Error("Auth check failed");
        const data = await r.json();

        if (!data?.isAdmin && !data?.isOwner) {
          setError("You are not authorised to access the admin panel.");
          setLoading(false);
          return;
        }

        if (!cancelled) {
          localStorage.setItem("vanta_admin_session", "true");
          router.push(data.isOwner ? "/store/owner" : "/store/admin");
        }
      } catch {
        if (!cancelled) {
          setError("Could not verify admin status. Make sure you are opening this through Telegram.");
          setLoading(false);
        }
      }
    };

    loginAsAdmin();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-6">
        <div className="animate-pulse rounded-full h-12 w-12 bg-border mb-4" />
        <h2 className="text-lg font-medium">Verifying admin access…</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Please make sure you are opening this through Telegram.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-6">
      <div className="rounded-full h-12 w-12 bg-destructive/10 mb-4">
        <svg className="h-6 w-6 text-destructive mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-lg font-medium">{error}</h2>
      <p className="text-sm text-muted-foreground mt-2">
        Only the owner or an added admin can access the admin panel.
      </p>
      <button
        onClick={() => router.push("/store")}
        className="mt-6 inline-flex items-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
      >
        Back to store
      </button>
    </div>
  );
}
