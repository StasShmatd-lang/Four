import { bearerToken, readBodyLimited } from "@/lib/auth";
import { getState } from "@/lib/game";
import { err, json } from "@/lib/json";
import { rateLimit, requestLimitKey } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const token = bearerToken(req);
    if (!token) return err("Нет токена", 401);
    if (!rateLimit(requestLimitKey(req, "state", token), 90, 60_000)) {
      return err("Слишком часто", 429);
    }
    const body = (await readBodyLimited(req, 4_000)) as {
      eventId?: string;
      role?: "host" | "guest" | "screen";
      guestId?: string;
    };
    if (!body.eventId || !body.role) return err("Нужны eventId и role");
    const role = body.role;
    const state = await getState(body.eventId, role, {
      hostToken: role === "host" ? token : undefined,
      screenToken: role === "screen" ? token : undefined,
      guestId: body.guestId,
      guestToken: role === "guest" ? token : undefined,
    });
    return json(state);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка";
    const status = msg.includes("не найдено") ? 404 : msg.includes("Нет") ? 403 : 400;
    return err(msg, status);
  }
}
