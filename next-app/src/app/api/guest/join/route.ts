import { readBodyLimited } from "@/lib/auth";
import { guestJoin } from "@/lib/game";
import { err, json } from "@/lib/json";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import type { TeamId } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    if (!rateLimit(`join:${ip}`, 20, 60_000)) return err("Слишком часто", 429);
    const body = (await readBodyLimited(req, 8_000)) as {
      eventId?: string;
      name?: string;
      team?: TeamId;
      guestId?: string;
      guestToken?: string;
    };
    if (!body.eventId) return err("Нужен eventId");
    const result = await guestJoin(body.eventId, body);
    return json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка";
    return err(msg, msg.includes("не найдено") ? 404 : 400);
  }
}
