import { bearerToken, readBodyLimited } from "@/lib/auth";
import { hostAction } from "@/lib/game";
import { err, json } from "@/lib/json";
import { rateLimit, requestLimitKey } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const token = bearerToken(req);
    if (!token) return err("Нет токена", 401);
    if (!rateLimit(requestLimitKey(req, "host", token), 60, 60_000)) {
      return err("Слишком часто", 429);
    }
    const body = (await readBodyLimited(req, 400_000)) as {
      eventId?: string;
      action?: string;
      payload?: Record<string, unknown>;
    };
    if (!body.eventId || !body.action) return err("Нужны eventId и action");
    const state = await hostAction(body.eventId, token, body.action, body.payload);
    return json(state);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка";
    const status = msg === "Нет доступа" ? 403 : 400;
    return err(msg, status);
  }
}
