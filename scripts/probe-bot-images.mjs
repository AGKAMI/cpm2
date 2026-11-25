import fs from "fs";
for (const raw of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const line = raw.trim(); const i = line.indexOf("=");
  if (i < 0 || line.startsWith("#")) continue;
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[line.slice(0, i).trim()] = v;
}
const { getStoreDb } = await import("../src/lib/store-db.ts");
const db = await getStoreDb();
const u = await db.execute({ sql: `SELECT filename FROM vanta_uploads`, args: [] });
const have = new Set(u.rows.map(r => String(r.filename)));
const cat = JSON.parse(fs.readFileSync("C:/Users/ojuni/Downloads/KAMI-Bot-main/catalog.json", "utf8"));
let total = 0, withImg = 0, missing = [];
for (const [sec, items] of Object.entries(cat)) {
  if (sec === "landingPage" || !items || typeof items !== "object") continue;
  for (const [key, it] of Object.entries(items)) {
    total++;
    const img = it.image || "";
    const fn = img ? img.split("/").pop() : "";
    if (!img) { missing.push(`no-image: ${sec}/${key} ${it.name}`); continue; }
    if (have.has(fn)) withImg++;
    else missing.push(`MISSING FILE: ${sec}/${key} ${it.name} -> ${fn}`);
  }
}
console.log("TOTAL ITEMS:", total, "| images present:", withImg, "| missing:", missing.length);
for (const m of missing) console.log(" ", m);
