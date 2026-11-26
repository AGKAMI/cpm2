// One-off: attach a 15% promo to the Jetta Blue (263) and read it back.
import fs from "fs";
for (const raw of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const line = raw.trim(); const i = line.indexOf("=");
  if (i < 0 || line.startsWith("#")) continue;
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[line.slice(0, i).trim()] = v;
}
const { createPromotion, productPromotionMap, listActiveProductPromotions } = await import("../src/lib/store/products.ts");
const promo = await createPromotion({
  title: "Jetta Blue Featured",
  description: "15% off the Blue Edition this week.",
  discountPercent: 15,
  backgroundColor: "#101418",
  accentColor: "#3a6fd8",
  pillColor: "#c23b4e",
  game: "cpm2",
  productId: 263,
  isActive: true,
});
console.log("created promo id:", promo.id, "| game:", promo.game, "| product:", promo.productId, "| pill:", promo.pillColor);
const map = await productPromotionMap("cpm2");
const forJetta = map.get(263);
console.log("live promo for 263:", forJetta ? `${forJetta.title} (${forJetta.discountPercent}% off, pill ${forJetta.pillColor})` : "NONE");
const cpm1 = await listActiveProductPromotions("cpm1");
console.log("cpm1 product promos (want 0):", cpm1.length);
