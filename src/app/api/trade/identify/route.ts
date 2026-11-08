import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api";
import { fail, ok, readJson } from "@/lib/route";
import { matchCarName } from "@/lib/trade";
import { tradeIdentifySchema } from "@/lib/validation";
import { rateLimited } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Gemini screenshot identification — the key lives ONLY in .env.local and is
 * read server-side here, never shipped to the browser. Until GEMINI_API_KEY
 * lands, this route answers 503 GEMINI_NOT_CONFIGURED and the rest of the
 * trade desk works untouched.
 */
const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const PROMPT = `This is a screenshot from Car Parking Multiplayer 2 (CPM2), a mobile car game.
Identify the highlighted/centred car - not background traffic or UI icons.
Reply with JSON only: {"carName": "<the car's exact displayed name>"}.
Rules:
- Use the name exactly as it appears in CPM2 (make + model + generation, e.g. "VOLKSWAGEN GOLF MK7 GTI", not "MK2" or "MK6").
- Do not invent generations or trims not shown.
- CPM2 has a Golf MK7 GTI (code 157), not MK2/MK6 - do not guess those.
- If several cars are visible, pick the most prominent one.`;

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "local";
    if (rateLimited(`trade:identify:${ip}`)) {
      return NextResponse.json(
        { error: { code: "AUTH_SLOW_DOWN", message: "Too many attempts - wait a minute and try again." } },
        { status: 429 },
      );
    }

    const input = tradeIdentifySchema.parse(await readJson(request));

    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) {
      throw new ApiError(
        503,
        "GEMINI_NOT_CONFIGURED",
        "Screenshot identification is not configured yet - add GEMINI_API_KEY to .env.local and restart the server.",
      );
    }

    let data: GeminiResponse;
    try {
      const response = await fetch(GEMINI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: PROMPT },
                { inline_data: { mime_type: input.mimeType, data: input.imageBase64 } },
              ],
            },
          ],
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        throw new ApiError(
          502,
          "GEMINI_FAILED",
          `Gemini refused the screenshot (HTTP ${response.status}).`,
        );
      }
      data = (await response.json()) as GeminiResponse;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(
        502,
        "GEMINI_FAILED",
        "Gemini did not answer in time - try again in a moment.",
      );
    }

    const text =
      data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";

    let carName = "";
    try {
      const parsed = JSON.parse(text) as { carName?: unknown };
      if (typeof parsed.carName === "string") carName = parsed.carName.trim();
    } catch {
      // The model ignored the JSON instruction — fall back to its raw text.
      carName = text;
    }
    if (!carName) {
      throw new ApiError(502, "GEMINI_FAILED", "Gemini could not read a car name from that screenshot.");
    }

    return ok({ carName, matches: matchCarName(carName, "cpm2", 6) });
  } catch (err) {
    return fail(err);
  }
}
