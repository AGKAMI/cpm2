// One-off: which products do recent orders reference, and do they still exist?
import { listOrders } from "../src/lib/store/checkout.ts";
import { listProducts } from "../src/lib/store/products.ts";

const orders = await listOrders({});
console.log("orders:", orders.length);
const all = await listProducts({}).catch(() => []);
console.log("products (all):", all.length);
const byId = new Map(all.map((p) => [p.id, p]));
for (const o of orders.slice(0, 20)) {
  const p = byId.get(o.productId);
  console.log(
    o.id, "| productId", o.productId, "|", o.orderState, o.paymentState,
    "|", p ? `OK: ${p.name} (published=${p.isPublished})` : "MISSING -> renders 'Item'",
  );
}
