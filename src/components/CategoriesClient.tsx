"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { vantaApi, formatPrice, type VantaCategory } from "@/lib/store/client";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";

export function CategoriesClient() {
  const [categories, setCategories] = useState<VantaCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { categories: cats } = await vantaApi.categories();
        setCategories(cats);
      } catch {
        setCategories([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <StoreShell>
      <PageHeading folio="02" title="Categories" />
      {loading ? (
        <p className="text-muted-foreground">Loading categories…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <article key={cat.id} className="panel rounded-xl border border-border p-6">
              <h3 className="text-sm font-medium text-foreground mb-1">{cat.name}</h3>
              <p className="text-[11px] text-muted-foreground line-clamp-2 mb-4">{cat.description}</p>
              <Link href={`/store/categories/${cat.slug}`} className="w-full">
                <Button variant="outline" size="sm" className="w-full">
                  Browse
                </Button>
              </Link>
            </article>
          ))}
          {categories.length === 0 && (
            <p className="text-muted-foreground">No categories yet.</p>
          )}
        </div>
      )}
    </StoreShell>
  );
}
