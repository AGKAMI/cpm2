import Link from "next/link";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";

export const metadata = {
  title: "Page not found — VANTA GARAGE",
};

export default function NotFound() {
  return (
    <StoreShell>
      <PageHeading folio="404" title="Page not found" backHref="/store" />
      <section className="panel rounded-xl border border-border p-10 text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          That page doesn't exist
        </h2>
        <p className="text-muted-foreground mb-6">
          The vehicle or page you're looking for isn't here. It may have been
          removed or the link may be broken.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/store" className="Button primary">
            Back to the garage
          </Link>
        </div>
      </section>
    </StoreShell>
  );
}
