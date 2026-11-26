import fs from "fs";
for (const raw of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const line = raw.trim(); const i = line.indexOf("=");
  if (i < 0 || line.startsWith("#")) continue;
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[line.slice(0, i).trim()] = v;
}
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) { console.log("NO BOT TOKEN"); process.exit(0); }
const info = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then(r => r.json());
console.log(JSON.stringify(info, null, 1).slice(0, 600));
