import fs from "fs";
for (const raw of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const line = raw.trim(); const i = line.indexOf("=");
  if (i < 0 || line.startsWith("#")) continue;
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[line.slice(0, i).trim()] = v;
}
const { getTursoDb } = await import("../src/lib/db-turso.ts");
const db = await getTursoDb();
const dupes = await db.execute({ sql: `SELECT telegram_user_id, COUNT(*) c FROM users WHERE telegram_user_id IS NOT NULL GROUP BY telegram_user_id HAVING c > 1`, args: [] });
console.log("duplicate telegram ids:", JSON.stringify(dupes.rows));
const all = await db.execute({ sql: `SELECT id, email, telegram_user_id FROM users WHERE telegram_user_id IS NOT NULL`, args: [] });
console.log("bound users:", all.rows.length, JSON.stringify(all.rows).slice(0, 400));
