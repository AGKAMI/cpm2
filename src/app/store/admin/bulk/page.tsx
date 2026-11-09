/** VANTA GARAGE — bulk product upload.
 * /store/admin/bulk
 * Admin: CSV import for bulk product creation.
 */

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";

type BulkResult = {
  created: number;
  errors: string[];
};

export default function BulkUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    setResult(null);
    if (!file) {
      setError("Please select a CSV file.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/store/admin/products/bulk", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || "Bulk upload failed.");
      }
      const data = await res.json();
      setResult(data);
      setMsg(`Created ${data.created} product(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <StoreShell>
      <PageHeading folio="BU" title="Bulk Product Upload" backHref="/store/admin" />

      {error && (
        <p className="mb-4 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
      {msg && (
        <p className="mb-4 rounded-md border border-primary bg-primary px-3 py-2 text-xs text-primary">
          {msg}
        </p>
      )}

      <section className="panel rounded-xl border border-border p-8 mb-8">
        <h3 className="text-sm font-semibold text-foreground mb-4">CSV Import</h3>
        <p className="text-[11px] text-muted-foreground mb-4">
          Upload a CSV file with columns: name, description, basePriceCents,
          currency, stockQuantity, categoryId, exclusivity, isPublished.
          Header row required.
        </p>
        <form onSubmit={handleUpload} className="space-y-3">
          <label className="block">
            <span className="text-xs text-muted-foreground mb-1 block">CSV File</span>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f) setError(null);
              }}
              className="block w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gold file:text-background hover:file:bg-gold/90"
            />
          </label>
          <Button type="submit" variant="primary" disabled={uploading || !file}>
            {uploading ? "Uploading…" : "Import Products"}
          </Button>
        </form>
      </section>

      {result && (
        <section className="panel rounded-xl border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Import Result</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border border-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-[0.15em]">Created</p>
              <p className="text-2xl font-bold text-foreground">{result.created}</p>
            </div>
            <div className="border border-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-[0.15em]">Errors</p>
              <p className="text-2xl font-bold text-foreground">{result.errors.length}</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-destructive mb-2">Error Details</h4>
              <ul className="text-xs text-destructive space-y-1 list-disc list-inside">
                {result.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </StoreShell>
  );
}
