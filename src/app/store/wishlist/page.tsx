/** VANTA GARAGE — customer wishlist.
 * /store/wishlist
 * Customer: view saved vehicles, remove items.
 */

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";

type WishlistItem = {
  id: number;
  productId: number;
  name: string;
  description: string;
  basePriceCents: number;
  currency: string;
  stockQuantity: number;
  availabilityState: string;
  exclusivity: string;
  isFeatured: boolean;
  imageUrl: string | null;
  createdAt: string;
};

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWishlist();
  }, []);

  async function loadWishlist() {
    try {
      setLoading(true);
      const res = await fetch("/api/store/wishlist", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load wishlist");
      const data = await res.json();
      setItems(data.items ?? data.wishlist ?? data.products ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load wishlist.");
    } finally {
      setLoading(false);
    }
  }

  async function removeFromWishlist(productId: number) {
    if (!window.confirm("Remove this vehicle from your wishlist?")) return;
    try {
      const res = await fetch(`/api/store/wishlist/${productId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove from wishlist");
      await loadWishlist();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove item.");
    }
  }

  if (loading) {
    return (
      <StoreShell>
        <PageHeading folio="WL" title="Wishlist" backHref="/store" />
        <p className="text-muted-foreground">Loading wishlist…</p>
      </StoreShell>
    );
  }

  if (error) {
    return (
      <StoreShell>
        <PageHeading folio="WL" title="Wishlist" backHref="/store" />
        <p className="mb-4 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      </StoreShell>
    );
  }

  return (
    <StoreShell>
      <PageHeading folio="WL" title="Wishlist" backHref="/store" />

      {items.length === 0 ? (
        <section className="panel rounded-xl border border-border p-12 text-center">
          <p className="text-muted-foreground">Your wishlist is empty.</p>
          <a href="/store/categories" className="text-xs text-gold underline underline-offset-4 hover:text-gold/80">
            Browse Vehicles
          </a>
        </section>
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">
            Saved Vehicles ({items.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <WishlistCard key={item.productId} item={item} onRemove={removeFromWishlist} />
            ))}
          </div>
        </div>
      )}
    </StoreShell>
  );
}

function WishlistCard({
  item,
  onRemove,
}: {
  item: WishlistItem;
  onRemove: (id: number) => void;
}) {
  return (
    <article className="panel rounded-xl border border-border p-4 flex flex-col h-full">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-base font-bold text-foreground">{item.name}</h3>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => onRemove(item.productId)}
          aria-label={`Remove ${item.name} from wishlist`}
        >
          Remove
        </Button>
      </div>
      {item.imageUrl && (
        <img
          src={item.imageUrl}
          alt={item.name}
          className="w-full h-32 object-cover rounded-lg mb-3 bg-surface-deep"
        />
      )}
      <p className="text-xs text-muted-foreground mb-2 flex-1">
        {item.description}
      </p>
      <div className="flex items-baseline justify-between gap-2 mt-auto">
        <span className="text-lg font-bold text-foreground">
          {item.basePriceCents / 100} {item.currency}
        </span>
        <span
          className={`text-[10px] font-bold rounded px-2 py-0.5 ${
            item.exclusivity === "one_of_one"
              ? "bg-primary/10 text-primary border border-primary/20"
              : item.exclusivity === "limited_edition"
                ? "bg-destructive/10 text-destructive border border-destructive/20"
                : "bg-ink-faint/10 text-ink-faint border border-ink-faint/20"
          }`}
        >
          {item.exclusivity.replace(/_/g, " ").toUpperCase()}
        </span>
      </div>
      <a
        href={`/store/products/${item.productId}`}
        className="w-full text-xs text-gold underline underline-offset-4 hover:text-gold/80 text-center"
      >
        View Vehicle
      </a>
    </article>
  );
}
