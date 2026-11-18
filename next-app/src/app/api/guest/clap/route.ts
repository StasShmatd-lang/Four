import { bearerToken, readBodyLimited } from "@/lib/auth";
import { guestClap } from "@/lib/game";
import { err, json } from "@/lib/json";
import { rateLimit, requestLimitKey } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const token = bearerToken(req);
    if (!token) return err("Нет токена", 401);
    if (!rateLimit(requestLimitKey(req, "clap", token), 120, 10_000)) {
      return err("Слишком часто", 429);
    }
    const body = (await readBodyLimited(req, 2_000)) as {
      eventId?: string;
      guestId?: string;
      level?: number;
    };
    if (!body.eventId || !body.guestId) return err("Нужны eventId и guestId");
    // Only numeric level — never accept audio payloads
    if (typeof body.level !== "number") return err("Нужен level");
    const state = await guestClap(body.eventId, body.guestId, token, body.level);
    return json(state);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка";
    const status = msg.includes("Нет") ? 403 : 400;
    return err(msg, status);
  }
}
