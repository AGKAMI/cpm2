#!/usr/bin/env node
/**
 * Registers the CPM Fleet Ledger as the Telegram Mini App of its own bot.
 *
 * The app itself IS the mini app — no bot backend, no webhook, no polling.
 * This script only talks to the Bot API: `setChatMenuButton` turns the bot's
 * ☰ menu button into a launcher for the console's HTTPS URL.
 *
 * The token is read from TELEGRAM_BOT_TOKEN (environment) or .env.local (the
 * file Next.js already loads) and is never printed.
 *
 * Usage:
 *   node scripts/telegram-bot.mjs check
 *   node scripts/telegram-bot.mjs status
 *   node scripts/telegram-bot.mjs sync https://kami.tailc10831.ts.net
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const envPath = path.join(repo, ".env.local");

function loadToken() {
  if (process.env.TELEGRAM_BOT_TOKEN?.trim()) return process.env.TELEGRAM_BOT_TOKEN.trim();
  try {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*TELEGRAM_BOT_TOKEN\s*=\s*(\S+)\s*$/);
      if (match) return match[1];
    }
  } catch {
    // fall through
  }
  return undefined;
}

async function botApi(method, body = undefined) {
  const token = loadToken();
  if (!token) {
    console.error(`No bot token. Add TELEGRAM_BOT_TOKEN=<token> to .env.local.`);
    process.exit(1);
  }

  let response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    console.error(`Network error calling ${method}: ${err.message}`);
    process.exit(1);
  }

  const payload = await response.json().catch(() => null);
  if (!payload?.ok) {
    const reason = payload?.description ?? `HTTP ${response.status}`;
    console.error(`Telegram API refused ${method}: ${reason}`);
    process.exit(1);
  }
  return payload.result;
}

function meText(me) {
  return `${me.first_name ?? "bot"} (@${me.username}, id ${me.id})`;
}

async function main() {
  const [command, url] = process.argv.slice(2);

  if (!command || command === "check") {
    const me = await botApi("getMe");
    console.log(`Token works — ${meText(me)}`);
    console.log("Open the console from Telegram via this bot's ☰ menu button.");
    return;
  }

  if (command === "status") {
    const me = await botApi("getMe");
    console.log(`Bot: ${meText(me)}`);
    const menu = await botApi("getChatMenuButton");
    if (menu?.type === "web_app") {
      console.log(`Menu button: "${menu.text}" → ${menu.web_app.url}`);
    } else {
      console.log(`Menu button: ${menu?.type ?? "default"} (no mini app wired up yet)`);
    }
    return;
  }

  if (command === "sync") {
    let parsed;
    try {
      parsed = new URL(url ?? "");
    } catch {
      console.error(`sync needs an HTTPS URL, e.g.: node scripts/telegram-bot.mjs sync https://kami.tailc10831.ts.net`);
      process.exit(1);
    }
    if (parsed.protocol !== "https:") {
      console.error("Telegram opens mini apps over HTTPS only — the URL must start with https://");
      process.exit(1);
    }
    if (parsed.hostname === "localhost" || parsed.hostname.startsWith("127.") || parsed.hostname.startsWith("192.168.")) {
      console.error(
        "That address only exists on this PC. Telegram runs the mini app on the PHONE — " +
          "point it at the Tailscale HTTPS URL instead, e.g. https://kami.tailc10831.ts.net (tailscale serve).",
      );
      process.exit(1);
    }

    const me = await botApi("getMe");
    await botApi("setChatMenuButton", {
      menu_button: {
        type: "web_app",
        text: "CPM Fleet",
        web_app: { url: `${parsed.origin}${parsed.pathname === "/" ? "" : parsed.pathname}` },
      },
    });

    const menu = await botApi("getChatMenuButton");
    console.log(`${meText(me)} now launches "${menu.text}" →`);
    console.log(`  ${menu.web_app.url}`);
    console.log("In Telegram: open the bot, tap the ☰ button in the chat to run the console.");
    return;
  }

  console.error("Unknown command. Use: check | status | sync <https-url>");
  process.exit(1);
}

await main();
