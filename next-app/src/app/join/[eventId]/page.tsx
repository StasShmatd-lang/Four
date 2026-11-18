"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { BrandFooter } from "@/components/BrandFooter";
import { CountdownRing } from "@/components/CountdownRing";
import { DualMeters } from "@/components/DualMeters";
import { useMicLevel, type MicMode } from "@/hooks/useMicLevel";
import { usePollState } from "@/hooks/usePollState";
import { readJson } from "@/lib/apiClient";
import type { PublicState, TeamId } from "@/lib/types";

type JoinResult = {
  guestId: string;
  guestToken: string;
  state: PublicState;
  error?: string;
};

export default function JoinPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const [name, setName] = useState("");
  const [team, setTeam] = useState<TeamId>("a");
  const [guestId, setGuestId] = useState<string | null>(null);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [preview, setPreview] = useState<PublicState | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const lastSent = useRef(0);

  useEffect(() => {
    const id = sessionStorage.getItem(`guestId:${eventId}`);
    const tok = sessionStorage.getItem(`guestToken:${eventId}`);
    if (id && tok) {
      setGuestId(id);
      setGuestToken(tok);
    }
  }, [eventId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/events/${eventId}`);
        const data = await readJson<PublicState & { error?: string }>(res);
        if (!cancelled && res.ok) setPreview(data as PublicState);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const auth = useMemo(
    () =>
      guestId && guestToken
        ? { eventId, role: "guest" as const, token: guestToken, guestId }
        : null,
    [eventId, guestId, guestToken],
  );
  const { state, setState, error } = usePollState(auth, Boolean(auth), 400);
  const joined = Boolean(guestId && guestToken && state);
  const live = state?.phase === "live";
  const { level, mode, tapClap, enableMic } = useMicLevel(joined);

  // Send clap levels during live — numbers only
  useEffect(() => {
    if (!live || !guestId || !guestToken) return;
    const now = Date.now();
    if (now - lastSent.current < 180) return;
    if (level < 4) return;
    lastSent.current = now;
    void fetch("/api/guest/clap", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${guestToken}`,
      },
      body: JSON.stringify({ eventId, guestId, level }),
    })
      .then((r) => readJson<PublicState>(r))
      .then((data) => setState(data))
      .catch(() => undefined);
  }, [level, live, guestId, guestToken, eventId, setState]);

  const join = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/guest/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventId,
          name,
          team,
          ...(guestId && guestToken ? { guestId, guestToken } : {}),
        }),
      });
      const data = await readJson<JoinResult>(res);
      if (!res.ok) throw new Error(data.error || "Ошибка");
      sessionStorage.setItem(`guestId:${eventId}`, data.guestId);
      sessionStorage.setItem(`guestToken:${eventId}`, data.guestToken);
      setGuestId(data.guestId);
      setGuestToken(data.guestToken);
      setState(data.state);
      setPreview(data.state);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось войти");
    } finally {
      setBusy(false);
    }
  }, [eventId, name, team, guestId, guestToken, setState]);

  // Bootstrap team colors for the join form via a one-shot join peek isn't possible;
  // show defaults until joined. After join, use state.
  const teams = state?.teams || preview?.teams;

  if (guestId && guestToken && !state) {
    return (
      <div className="shell flex items-center justify-center">
        <p className="text-[var(--mute)]">{error || "Подключаемся…"}</p>
      </div>
    );
  }

  if (!guestId || !guestToken || !state) {
    return (
      <div className="shell">
        <div className="arena-grid" aria-hidden />
        <div className="relative z-10 flex flex-1 flex-col justify-center gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png" alt="" className="brand-mark hero-enter" />
          <div className="text-center hero-enter-delay">
            <h1 className="display text-3xl font-semibold">Выберите сторону</h1>
            <p className="mt-2 text-sm text-[var(--mute)]">Имя и команда — и вы в хоре</p>
          </div>
          <div className="hero-enter-delay-2 space-y-4">
            <label className="block">
              <span className="label">Ваше имя</span>
              <input
                className="field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Как вас представить"
                maxLength={40}
              />
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                className={`team-pick ${team === "a" ? "active" : ""}`}
                style={{
                  borderColor: team === "a" ? teams?.a.color || "#c8f542" : undefined,
                  boxShadow: team === "a" ? `0 0 0 1px ${teams?.a.color || "#c8f542"}` : undefined,
                }}
                onClick={() => setTeam("a")}
              >
                <span className="display text-lg" style={{ color: teams?.a.color || "#c8f542" }}>
                  А
                </span>
                <span className="text-sm">{teams?.a.name || "Команда А"}</span>
              </button>
              <button
                type="button"
                className={`team-pick ${team === "b" ? "active" : ""}`}
                style={{
                  borderColor: team === "b" ? teams?.b.color || "#ff5c4d" : undefined,
                  boxShadow: team === "b" ? `0 0 0 1px ${teams?.b.color || "#ff5c4d"}` : undefined,
                }}
                onClick={() => setTeam("b")}
              >
                <span className="display text-lg" style={{ color: teams?.b.color || "#ff5c4d" }}>
                  Б
                </span>
                <span className="text-sm">{teams?.b.name || "Команда Б"}</span>
              </button>
            </div>
            <button type="button" className="btn-lime w-full" disabled={busy || !name.trim()} onClick={join}>
              {busy ? "Входим…" : "В зал"}
            </button>
            {(err || error) && <p className="text-center text-sm text-[var(--coral)]">{err || error}</p>}
          </div>
        </div>
        <BrandFooter />
      </div>
    );
  }

  const myColor = state.me?.team === "b" ? state.teams.b.color : state.teams.a.color;
  const myName = state.me?.team === "b" ? state.teams.b.name : state.teams.a.name;

  return (
    <div className="shell">
      <div className="arena-grid" aria-hidden />
      <div className="relative z-10 flex flex-1 flex-col gap-5">
        <header className="pt-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png" alt="" className="mx-auto mb-3 h-7 w-auto opacity-90" />
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--mute)]">{state.title}</p>
          <h1 className="display mt-1 text-2xl font-semibold" style={{ color: myColor }}>
            {myName}
          </h1>
          <p className="text-sm text-[var(--mute)]">{state.me?.name}</p>
        </header>

        {state.phase === "lobby" && (
          <div className="panel text-center">
            <p className="display text-xl">Ждём старт</p>
            <p className="mt-2 text-sm text-[var(--mute)]">
              В зале {state.guestCount}. Сначала включите микрофон — браузер спросит разрешение.
            </p>
            <MicSetup mode={mode} level={level} color={myColor} onEnable={enableMic} />
            <div className="mt-5">
              <DualMeters teams={state.teams} phase={state.phase} winner={state.winner} />
            </div>
          </div>
        )}

        {state.phase === "countdown" && (
          <div className="flex flex-col gap-4">
            <CountdownRing remainingMs={state.remainingMs} label="Приготовьтесь хлопать" />
            <MicSetup mode={mode} level={level} color={myColor} onEnable={enableMic} />
          </div>
        )}

        {state.phase === "live" && (
          <div className="flex flex-1 flex-col gap-4">
            <div className="text-center">
              <div className="display text-5xl tabular-nums">{Math.ceil(state.remainingMs / 1000)}</div>
              <p className="text-sm text-[var(--mute)]">Хлопайте громче!</p>
            </div>
            {mode !== "mic" && (
              <button type="button" className="btn-ghost w-full" onClick={() => void enableMic()}>
                {mode === "asking" ? "Ждём разрешение…" : "Включить микрофон"}
              </button>
            )}
            <button
              type="button"
              className={`clap-pad live`}
              onPointerDown={(e) => {
                e.preventDefault();
                tapClap();
              }}
            >
              <span className="display text-3xl font-semibold" style={{ color: myColor }}>
                ХЛОП
              </span>
            </button>
            <div className="level-bar">
              <span style={{ width: `${level}%`, background: myColor }} />
            </div>
            <p className="text-center text-xs text-[var(--mute)]">{micHint(mode)}</p>
          </div>
        )}

        {state.phase === "result" && (
          <div className="panel text-center">
            <p className="winner-banner" style={{ color: winnerColor(state) }}>
              {winnerLabel(state)}
            </p>
            <div className="mt-5">
              <DualMeters teams={state.teams} phase={state.phase} winner={state.winner} />
            </div>
          </div>
        )}

        {(err || error) && <p className="text-center text-sm text-[var(--coral)]">{err || error}</p>}
      </div>
      <BrandFooter compact />
    </div>
  );
}

function winnerColor(state: PublicState) {
  if (state.winner === "a") return state.teams.a.color;
  if (state.winner === "b") return state.teams.b.color;
  return "var(--ice)";
}

function winnerLabel(state: PublicState) {
  if (state.winner === "tie") return "Ничья!";
  if (state.winner === "a") return `Победа: ${state.teams.a.name}`;
  if (state.winner === "b") return `Победа: ${state.teams.b.name}`;
  return "";
}

function micHint(mode: MicMode) {
  if (mode === "mic") return "Микрофон слушает громкость. Запись не сохраняется.";
  if (mode === "denied") return "Микрофон закрыт — тапайте «ХЛОП».";
  if (mode === "asking") return "В системном окне браузера нажмите «Разрешить».";
  if (mode === "tap") return "Режим тапа. Можно всё равно включить микрофон.";
  return "Нажмите «Включить микрофон» или тапайте «ХЛОП».";
}

function MicSetup({
  mode,
  level,
  color,
  onEnable,
}: {
  mode: MicMode;
  level: number;
  color: string;
  onEnable: () => Promise<boolean>;
}) {
  return (
    <div className="mt-5 space-y-3 text-left">
      {mode === "mic" ? (
        <p className="text-center text-sm" style={{ color }}>
          Микрофон включён — похлопайте, полоска должна двигаться
        </p>
      ) : (
        <button
          type="button"
          className="btn-lime w-full"
          disabled={mode === "asking"}
          onClick={() => void onEnable()}
        >
          {mode === "asking" ? "Ждём разрешение…" : "Включить микрофон"}
        </button>
      )}
      <div className="level-bar">
        <span style={{ width: `${level}%`, background: color }} />
      </div>
      <p className="text-center text-xs text-[var(--mute)]">{micHint(mode)}</p>
      {mode === "denied" && (
        <p className="text-center text-xs text-[var(--mute)]">
          Если окно не появилось: замок в адресной строке → Микрофон → Разрешить → обновить.
        </p>
      )}
    </div>
  );
}
