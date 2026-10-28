import { ApiError } from "@/lib/api";
import { fail, ok, readJson } from "@/lib/route";
import { matchCarName } from "@/lib/trade";
import { tradeIdentifySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Gemini screenshot identification — the key lives ONLY in .env.local and is
 * read server-side here, never shipped to the browser. Until GEMINI_API_KEY
 * lands, this route answers 503 GEMINI_NOT_CONFIGURED and the rest of the
 * trade desk works untouched.
 */
const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const PROMPT = `This is a screenshot from the mobile game Car Parking Multiplayer 2.
Identify the car the screenshot is about (the highlighted/centred car in a shop,
garage or trade screen — not background traffic or UI icons).
Reply with JSON only: {"carName": "<the car's displayed name>"}.
Use the name as shown in the game where possible, otherwise the best
make-and-model guess. If several cars are visible, pick the most prominent one.`;

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

export async function POST(request: Request) {
  try {
    const input = tradeIdentifySchema.parse(await readJson(request));

    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) {
      throw new ApiError(
        503,
        "GEMINI_NOT_CONFIGURED",
        "Screenshot identification is not configured yet — add GEMINI_API_KEY to .env.local and restart the server.",
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
        "Gemini did not answer in time — try again in a moment.",
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
