import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { WishlistSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <StoreShell>
      <PageHeading folio="WL" title="Wishlist" backHref="/store" />
      <WishlistSkeleton />
    </StoreShell>
  );
}
