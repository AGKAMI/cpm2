/**
 * VANTA GARAGE — Telegram link preview.
 * POST /api/store/customers/link-telegram-preview
 * Body: { telegramId: string }
 *
 * Fetches the Telegram profile for the given ID so the user can confirm
 * "Is this your profile?" before starting the verification gate.
 * Returns { username, firstName, displayName, photoUrl, hasPhoto }.
 */

import { NextRequest, NextResponse } from "next/server";
import { readJson } from "@/lib/route";
import { fetchTelegramUser, fetchTelegramPhotoUrl } from "@/lib/telegram";

export const dynamic = "force-dynamic";

function letterColor(telegramUserId: string): string {
  // Deterministic pastel color from the Telegram ID so the same ID always
  // gets the same letter-badge color.
  let hash = 0;
  for (let i = 0; i < telegramUserId.length; i++) {
    hash = (hash << 5) - hash + telegramUserId.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 65%)`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await readJson(request)) as { telegramId?: string };
    const telegramUserId = body.telegramId?.trim();

    if (!telegramUserId || !/^\d+$/.test(telegramUserId)) {
      return NextResponse.json(
        { error: { code: "INVALID_TELEGRAM_ID", message: "Please enter a valid Telegram ID (numbers only)." } },
        { status: 400 },
      );
    }

    const tgInfo = await fetchTelegramUser(Number(telegramUserId));
    const hasPhoto = (await fetchTelegramPhotoUrl(Number(telegramUserId))) !== null;

    const username = tgInfo?.username ?? null;
    const firstName = tgInfo?.first_name ?? null;
    const lastName = tgInfo?.last_name ?? null;
    const displayName = username || firstName || `tg_${telegramUserId}`;
    const photoUrl = hasPhoto ? `/api/store/telegram-avatar?v=${telegramUserId}` : null;
    const firstLetter = (username ?? firstName ?? "U").charAt(0).toUpperCase();
    const color = letterColor(telegramUserId);

    return NextResponse.json({
      telegramUserId,
      username,
      firstName,
      lastName,
      displayName,
      photoUrl,
      hasPhoto,
      firstLetter,
      color,
    });
  } catch (err) {
    console.error("Preview error:", err);
    return NextResponse.json(
      { error: { code: "PREVIEW_FAILED", message: "Could not look up that Telegram ID." } },
      { status: 500 },
    );
  }
}
