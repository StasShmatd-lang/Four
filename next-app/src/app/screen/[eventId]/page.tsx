"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { BrandFooter } from "@/components/BrandFooter";
import { CountdownRing } from "@/components/CountdownRing";
import { DualMeters } from "@/components/DualMeters";
import { usePollState } from "@/hooks/usePollState";
import type { PublicState } from "@/lib/types";

function ScreenInner() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const fromHash = new URLSearchParams(hash).get("s") || (hash.startsWith("s=") ? hash.slice(2) : "");
    const stored = sessionStorage.getItem(`screenToken:${eventId}`);
    const t = fromHash || stored;
    if (t) {
      sessionStorage.setItem(`screenToken:${eventId}`, t);
      setToken(t);
      // Keep token in hash for refresh, but never put it in query
      if (!fromHash) {
        window.location.hash = `s=${t}`;
      }
    }
  }, [eventId]);

  const auth = useMemo(
    () => (token ? { eventId, role: "screen" as const, token } : null),
    [eventId, token],
  );
  const { state, error } = usePollState(auth, Boolean(auth), 350);

  if (!token) {
    return (
      <div className="shell-hall flex items-center justify-center">
        <p className="text-center text-[var(--mute)]">
          Откройте экран по ссылке ведущего (токен в #s=…).
        </p>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="shell-hall flex items-center justify-center">
        <p className="text-[var(--mute)]">{error || "Подключаем зал…"}</p>
      </div>
    );
  }

  return (
    <div className="shell-hall">
      <div className="arena-grid" aria-hidden />
      <header className="relative z-10 mb-4 flex items-start justify-between gap-4">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png" alt="" className="mb-3 h-9 w-auto opacity-90" />
          <h1 className="display text-4xl font-semibold md:text-5xl lg:text-6xl">{state.title}</h1>
          <p className="mt-2 text-sm uppercase tracking-[0.2em] text-[var(--mute)]">
            {phaseLabel(state)} · гостей {state.guestCount}
          </p>
        </div>
        {state.phase === "live" && (
          <div className="display text-6xl tabular-nums md:text-7xl">
            {Math.ceil(state.remainingMs / 1000)}
          </div>
        )}
      </header>

      <main className="relative z-10 flex flex-1 flex-col justify-center">
        {state.phase === "lobby" && (
          <div className="text-center">
            <p className="display text-3xl md:text-5xl">Сканируйте QR у ведущего</p>
            <p className="mt-3 text-lg text-[var(--mute)]">Разделитесь на две половины зала</p>
            <div className="mx-auto mt-10 max-w-4xl">
              <DualMeters teams={state.teams} phase={state.phase} winner={state.winner} big />
            </div>
          </div>
        )}

        {state.phase === "countdown" && (
          <CountdownRing remainingMs={state.remainingMs} label="Приготовьтесь" />
        )}

        {(state.phase === "live" || state.phase === "result") && (
          <div>
            {state.phase === "result" && (
              <p className="winner-banner mb-6" style={{ color: winnerColor(state) }}>
                {winnerLabel(state)}
              </p>
            )}
            <DualMeters teams={state.teams} phase={state.phase} winner={state.winner} big />
          </div>
        )}
      </main>

      <div className="relative z-10">
        <BrandFooter compact />
      </div>
    </div>
  );
}

function phaseLabel(state: PublicState) {
  if (state.phase === "lobby") return "Лобби";
  if (state.phase === "countdown") return "Отсчёт";
  if (state.phase === "live") return `Раунд ${state.round}`;
  return `Финал раунда ${state.round}`;
}

function winnerColor(state: PublicState) {
  if (state.winner === "a") return state.teams.a.color;
  if (state.winner === "b") return state.teams.b.color;
  return "var(--ice)";
}

function winnerLabel(state: PublicState) {
  if (state.winner === "tie") return "Ничья!";
  if (state.winner === "a") return `Победа — ${state.teams.a.name}`;
  if (state.winner === "b") return `Победа — ${state.teams.b.name}`;
  return "";
}

export default function ScreenPage() {
  return (
    <Suspense fallback={<div className="shell-hall" />}>
      <ScreenInner />
    </Suspense>
  );
}
