// Register the webhook WITH the secret token (the route now requires it).
import fs from "fs";
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
if (!token || !secret) { console.log("missing token/secret in env"); process.exit(1); }
const url = "https://cpm2-bay.vercel.app/api/telegram/webhook";
const params = new URLSearchParams({ url, secret_token: secret, drop_pending_updates: "false", max_connections: "40" });
const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, { method: "POST", body: params }).then(r => r.json());
console.log("setWebhook:", res.ok ? "OK" : JSON.stringify(res));
const info = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then(r => r.json());
console.log("url:", info.result.url, "| pending:", info.result.pending_update_count, "| last error:", info.result.last_error_message ?? "none");
