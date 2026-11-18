import { nanoid } from "nanoid";
import { sql } from "./db";
import type { EventData, Guest, Phase, PublicState, TeamId } from "./types";

const EVENT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_EVENTS = 80;
const MAX_EVENT_JSON_BYTES = 2_000_000;
const COUNTDOWN_SEC = 3;
const LIVE_DECAY = 0.72;

const DEFAULT_A = { name: "Команда А", color: "#c8f542", captainPhoto: null as string | null };
const DEFAULT_B = { name: "Команда Б", color: "#ff5c4d", captainPhoto: null as string | null };

function clampRoundSec(n: unknown) {
  const v = Math.round(Number(n) || 7);
  return Math.min(10, Math.max(5, v));
}

function safeColor(c: unknown, fallback: string) {
  if (typeof c !== "string") return fallback;
  const s = c.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  return fallback;
}

function safePhoto(url: unknown) {
  if (typeof url !== "string" || !url) return null;
  if (
    !url.startsWith("data:image/jpeg") &&
    !url.startsWith("data:image/png") &&
    !url.startsWith("data:image/webp")
  ) {
    return null;
  }
  if (url.length > 280_000) return null;
  return url;
}

function teamCounts(ev: EventData) {
  let a = 0;
  let b = 0;
  for (const g of ev.guests) {
    if (g.team === "a") a += 1;
    else b += 1;
  }
  return { a, b };
}

function remainingMs(ev: EventData) {
  if (ev.phase === "countdown" && ev.countdownEndsAt) {
    return Math.max(0, ev.countdownEndsAt - Date.now());
  }
  if (ev.phase === "live" && ev.liveEndsAt) {
    return Math.max(0, ev.liveEndsAt - Date.now());
  }
  return 0;
}

/** Advance countdown → live → result. Returns whether anything changed. */
function advance(ev: EventData): boolean {
  const now = Date.now();
  if (ev.phase === "countdown" && ev.countdownEndsAt && now >= ev.countdownEndsAt) {
    ev.phase = "live";
    ev.countdownEndsAt = null;
    ev.liveEndsAt = now + ev.roundSec * 1000;
    ev.score = { a: 0, b: 0 };
    ev.live = { a: 0, b: 0 };
    ev.sampleCount = { a: 0, b: 0 };
    ev.winner = null;
    return true;
  }
  if (ev.phase === "live" && ev.liveEndsAt && now >= ev.liveEndsAt) {
    ev.phase = "result";
    ev.liveEndsAt = null;
    if (ev.score.a === ev.score.b) ev.winner = "tie";
    else ev.winner = ev.score.a > ev.score.b ? "a" : "b";
    return true;
  }
  return false;
}

function softDecayLive(ev: EventData) {
  if (ev.phase !== "live") return;
  ev.live.a *= LIVE_DECAY;
  ev.live.b *= LIVE_DECAY;
  if (ev.live.a < 0.5) ev.live.a = 0;
  if (ev.live.b < 0.5) ev.live.b = 0;
}

export async function loadEvent(id: string): Promise<EventData | null> {
  const rows = await sql<{ data: EventData }>("select data from events where id = $1", [id]);
  if (!rows[0]) return null;
  return rows[0].data;
}

export async function loadEventTicked(id: string): Promise<{ ev: EventData; dirty: boolean } | null> {
  const ev = await loadEvent(id);
  if (!ev) return null;
  softDecayLive(ev);
  const dirty = advance(ev);
  return { ev, dirty: dirty || ev.phase === "live" };
}

export async function saveEvent(ev: EventData) {
  const raw = JSON.stringify(ev);
  if (raw.length > MAX_EVENT_JSON_BYTES) throw new Error("Событие слишком большое");
  await sql(
    `insert into events (id, data, updated_at) values ($1, $2::jsonb, now())
     on conflict (id) do update set data = excluded.data, updated_at = now()`,
    [ev.id, raw],
  );
}

export async function createEvent() {
  const count = await sql<{ c: string }>("select count(*)::text as c from events");
  if (Number(count[0]?.c || 0) >= MAX_EVENTS) throw new Error("Сервер занят");
  const ev: EventData = {
    id: nanoid(8),
    hostToken: nanoid(18),
    screenToken: nanoid(18),
    title: "Хор",
    teams: { a: { ...DEFAULT_A }, b: { ...DEFAULT_B } },
    roundSec: 7,
    phase: "lobby",
    round: 0,
    guests: [],
    score: { a: 0, b: 0 },
    live: { a: 0, b: 0 },
    sampleCount: { a: 0, b: 0 },
    winner: null,
    countdownEndsAt: null,
    liveEndsAt: null,
    createdAt: Date.now(),
  };
  await saveEvent(ev);
  return ev;
}

export async function pruneOld() {
  const cutoff = Date.now() - EVENT_TTL_MS;
  await sql("delete from events where (data->>'createdAt')::bigint < $1", [cutoff]);
}

export function publicState(
  ev: EventData,
  role: "host" | "guest" | "screen",
  guestId?: string,
): PublicState {
  const counts = teamCounts(ev);
  const base: PublicState = {
    id: ev.id,
    title: ev.title,
    phase: ev.phase,
    round: ev.round,
    roundSec: ev.roundSec,
    teams: {
      a: {
        name: ev.teams.a.name,
        color: ev.teams.a.color,
        captainPhoto: ev.teams.a.captainPhoto,
        count: counts.a,
        score: Math.round(ev.score.a),
        live: Math.round(ev.live.a),
      },
      b: {
        name: ev.teams.b.name,
        color: ev.teams.b.color,
        captainPhoto: ev.teams.b.captainPhoto,
        count: counts.b,
        score: Math.round(ev.score.b),
        live: Math.round(ev.live.b),
      },
    },
    winner: ev.winner,
    remainingMs: remainingMs(ev),
    guestCount: ev.guests.length,
    role,
  };

  if (role === "host") {
    base.screenToken = ev.screenToken;
  }

  if (role === "guest" && guestId) {
    const me = ev.guests.find((g) => g.id === guestId);
    base.me = me ? { id: me.id, name: me.name, team: me.team } : null;
  }

  return base;
}

export async function hostAction(
  eventId: string,
  hostToken: string,
  action: string,
  payload?: Record<string, unknown>,
) {
  const loaded = await loadEventTicked(eventId);
  if (!loaded || loaded.ev.hostToken !== hostToken) throw new Error("Нет доступа");
  const ev = loaded.ev;

  if (action === "settings") {
    if (ev.phase !== "lobby" && ev.phase !== "result") {
      throw new Error("Настройки только в лобби");
    }
    if (typeof payload?.title === "string") {
      ev.title = payload.title.trim().slice(0, 80) || "Хор";
    }
    if (payload?.roundSec != null) ev.roundSec = clampRoundSec(payload.roundSec);
    if (payload?.teamA && typeof payload.teamA === "object") {
      const t = payload.teamA as Record<string, unknown>;
      if (typeof t.name === "string") ev.teams.a.name = t.name.trim().slice(0, 40) || DEFAULT_A.name;
      if (t.color != null) ev.teams.a.color = safeColor(t.color, DEFAULT_A.color);
      if ("captainPhoto" in t) ev.teams.a.captainPhoto = safePhoto(t.captainPhoto);
    }
    if (payload?.teamB && typeof payload.teamB === "object") {
      const t = payload.teamB as Record<string, unknown>;
      if (typeof t.name === "string") ev.teams.b.name = t.name.trim().slice(0, 40) || DEFAULT_B.name;
      if (t.color != null) ev.teams.b.color = safeColor(t.color, DEFAULT_B.color);
      if ("captainPhoto" in t) ev.teams.b.captainPhoto = safePhoto(t.captainPhoto);
    }
  } else if (action === "start") {
    if (ev.phase !== "lobby" && ev.phase !== "result") throw new Error("Сейчас нельзя стартовать");
    if (ev.guests.length < 1) throw new Error("Нужен хотя бы один гость");
    ev.round += 1;
    ev.phase = "countdown";
    ev.countdownEndsAt = Date.now() + COUNTDOWN_SEC * 1000;
    ev.liveEndsAt = null;
    ev.score = { a: 0, b: 0 };
    ev.live = { a: 0, b: 0 };
    ev.sampleCount = { a: 0, b: 0 };
    ev.winner = null;
  } else if (action === "stop") {
    ev.phase = "lobby";
    ev.countdownEndsAt = null;
    ev.liveEndsAt = null;
    ev.score = { a: 0, b: 0 };
    ev.live = { a: 0, b: 0 };
    ev.sampleCount = { a: 0, b: 0 };
    ev.winner = null;
  } else if (action === "reset") {
    ev.phase = "lobby";
    ev.round = 0;
    ev.guests = [];
    ev.countdownEndsAt = null;
    ev.liveEndsAt = null;
    ev.score = { a: 0, b: 0 };
    ev.live = { a: 0, b: 0 };
    ev.sampleCount = { a: 0, b: 0 };
    ev.winner = null;
  } else {
    throw new Error("Неизвестное действие");
  }

  await saveEvent(ev);
  return publicState(ev, "host");
}

export async function guestJoin(
  eventId: string,
  input: { name?: string; team?: TeamId; guestId?: string; guestToken?: string },
) {
  const loaded = await loadEventTicked(eventId);
  if (!loaded) throw new Error("Событие не найдено");
  const ev = loaded.ev;

  let guest: Guest | undefined = input.guestId
    ? ev.guests.find((g) => g.id === input.guestId)
    : undefined;

  if (guest) {
    if (!input.guestToken || input.guestToken !== guest.token) throw new Error("Нет доступа");
    if (input.name) guest.name = String(input.name).trim().slice(0, 40);
    if (input.team === "a" || input.team === "b") {
      if (ev.phase === "lobby" || ev.phase === "result") guest.team = input.team;
    }
    guest.lastSeen = Date.now();
  } else {
    if (ev.phase !== "lobby" && ev.phase !== "result") {
      throw new Error("Раунд уже идёт — подождите лобби");
    }
    if (ev.guests.length >= 400) throw new Error("Зал заполнен");
    const name = String(input.name || "").trim().slice(0, 40);
    if (!name) throw new Error("Нужно имя");
    const team: TeamId = input.team === "b" ? "b" : "a";
    guest = {
      id: nanoid(10),
      token: nanoid(18),
      name,
      team,
      lastLevel: 0,
      lastSeen: Date.now(),
    };
    ev.guests.push(guest);
  }

  await saveEvent(ev);
  return {
    guestId: guest.id,
    guestToken: guest.token,
    state: publicState(ev, "guest", guest.id),
  };
}

/** Accept numeric clap level only — never audio blobs. */
export async function guestClap(
  eventId: string,
  guestId: string,
  guestToken: string,
  level: number,
) {
  const loaded = await loadEventTicked(eventId);
  if (!loaded) throw new Error("Событие не найдено");
  const ev = loaded.ev;
  const guest = ev.guests.find((g) => g.id === guestId);
  if (!guest || guest.token !== guestToken) throw new Error("Нет сессии");

  const now = Date.now();
  guest.lastSeen = now;

  if (ev.phase !== "live") {
    // Still persist timer advances / decay when dirty
    if (loaded.dirty) await saveEvent(ev);
    return publicState(ev, "guest", guestId);
  }

  const v = Math.min(100, Math.max(0, Number(level) || 0));
  guest.lastLevel = v;
  const team = guest.team;
  // Weighted sample: louder claps count more toward the team score
  const weight = v * v;
  ev.score[team] += weight / 100;
  ev.sampleCount[team] += 1;
  ev.live[team] = Math.min(100, Math.max(ev.live[team] * 0.55, v));

  await saveEvent(ev);
  return publicState(ev, "guest", guestId);
}

export async function getState(
  eventId: string,
  role: "host" | "guest" | "screen",
  tokens: { hostToken?: string; screenToken?: string; guestId?: string; guestToken?: string },
) {
  const loaded = await loadEventTicked(eventId);
  if (!loaded) throw new Error("Событие не найдено");
  const { ev, dirty } = loaded;

  if (role === "host") {
    if (!tokens.hostToken || tokens.hostToken !== ev.hostToken) throw new Error("Нет доступа");
    if (dirty) await saveEvent(ev);
    return publicState(ev, "host");
  }
  if (role === "screen") {
    if (!tokens.screenToken || tokens.screenToken !== ev.screenToken) throw new Error("Нет доступа");
    if (dirty) await saveEvent(ev);
    return publicState(ev, "screen");
  }
  if (!tokens.guestId || !tokens.guestToken) throw new Error("Нет сессии");
  const guest = ev.guests.find((g) => g.id === tokens.guestId);
  if (!guest || guest.token !== tokens.guestToken) throw new Error("Нет доступа");
  if (dirty) await saveEvent(ev);
  return publicState(ev, "guest", guest.id);
}

export function isPhase(p: unknown): p is Phase {
  return p === "lobby" || p === "countdown" || p === "live" || p === "result";
}
