/**
 * VANTA GARAGE — batched product cover lookup.
 * GET /api/store/media/covers?ids=1,2,3
 * Returns { covers: { "<productId>": "<first media url>" } } — ONE Turso
 * round-trip instead of N per-product /media calls (each is a ~300ms+ cloud
 * round-trip; the categories page used to fire one request per card).
 */
import { ok, fail } from "@/lib/route";
import { listCoverImageMap } from "@/lib/store/products";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const idsParam = url.searchParams.get("ids");
    if (!idsParam) {
      return fail({ status: 400, body: { error: { code: "missing_ids", message: "ids required." } } });
    }
    const ids = [
      ...new Set(
        idsParam
          .split(",")
          .map((s) => Number(s))
          .filter((n) => Number.isFinite(n) && n > 0),
      ),
    ].slice(0, 200);
    const map = await listCoverImageMap(ids);
    const covers: Record<string, string> = {};
    for (const [id, u] of map) covers[String(id)] = u;
    return ok({ covers });
  } catch (err) {
    return fail(err);
  }
}
