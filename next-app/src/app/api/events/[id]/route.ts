import { loadEvent, publicState } from "@/lib/game";
import { err, json } from "@/lib/json";

export const runtime = "nodejs";

/** Public lobby peek — no tokens. Only title/teams/counts/phase. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const ev = await loadEvent(id);
    if (!ev) return err("Событие не найдено", 404);
    const full = publicState(ev, "screen");
    return json({
      id: full.id,
      title: full.title,
      phase: full.phase,
      guestCount: full.guestCount,
      teams: {
        a: { name: full.teams.a.name, color: full.teams.a.color, count: full.teams.a.count },
        b: { name: full.teams.b.name, color: full.teams.b.color, count: full.teams.b.count },
      },
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Ошибка", 500);
  }
}
