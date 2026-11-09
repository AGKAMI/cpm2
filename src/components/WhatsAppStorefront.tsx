"use client";

import Link from "next/link";
import { HeartToggle } from "@/components/HeartToggle";

/**
 * WhatsApp storefront UI — category menu cards for the .vanta command flow.
 * Pure frontend; KAMI-Bot handles the WhatsApp conversation backend.
 */
export function WhatsAppStorefront() {
  const categories = [
    { name: "Limited Editions", count: 3, icon: "diamond", color: "text-gold border-gold" },
    { name: "New Arrivals", count: 6, icon: "sparkles", color: "text-blue-400 border-blue-500" },
    { name: "On Sale", count: 4, icon: "tag", color: "text-red-400 border-red-500" },
    { name: "One of One", count: 1, icon: "crown", color: "text-gold border-gold" },
  ];

  return (
    <section className="panel rounded-xl border border-border p-6 mb-6">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">WhatsApp Storefront</h3>
        <Link
          href="https://wa.me/?text=VANTA%20GARAGE%20ORDER"
          className="text-xs font-bold text-gold hover:text-gold/80 transition-colors"
        >
          Order via WhatsApp &rarr;
        </Link>
      </div>
      <p className="text-xs text-ink-soft mb-6">
        Send ".vanta" on WhatsApp to browse categories, check stock, and place orders.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {categories.map((cat) => (
          <Link
            key={cat.name}
            href="/store/categories"
            className={`flex items-center justify-between p-4 rounded-lg border border-border ${cat.color} bg-black/40 hover:border-gold hover:text-gold transition-all duration-200 cursor-pointer`}
          >
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.1em]">{cat.name}</span>
              <span className="text-[10px] text-ink-faint">{cat.count} vehicles</span>
            </div>
            <span className="text-[20px]">{cat.color.includes("gold") ? "🏆" : cat.color.includes("blue") ? "✨" : cat.color.includes("red") ? "🏷️" : "👑"}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
