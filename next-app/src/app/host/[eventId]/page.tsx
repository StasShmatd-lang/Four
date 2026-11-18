"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { BrandFooter } from "@/components/BrandFooter";
import { CountdownRing } from "@/components/CountdownRing";
import { DualMeters } from "@/components/DualMeters";
import { useLinkBase } from "@/hooks/useLinkBase";
import { usePollState } from "@/hooks/usePollState";
import { readJson } from "@/lib/apiClient";
import type { PublicState } from "@/lib/types";

function readFileAsJpegDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 360;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    img.src = url;
  });
}

export default function HostPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const base = useLinkBase();
  const [token, setToken] = useState<string | null>(null);
  const [title, setTitle] = useState("Хор аплодисментов");
  const [roundSec, setRoundSec] = useState(7);
  const [nameA, setNameA] = useState("Команда А");
  const [nameB, setNameB] = useState("Команда Б");
  const [colorA, setColorA] = useState("#c8f542");
  const [colorB, setColorB] = useState("#ff5c4d");
  const [photoA, setPhotoA] = useState<string | null>(null);
  const [photoB, setPhotoB] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const t = sessionStorage.getItem(`hostToken:${eventId}`);
    setToken(t);
  }, [eventId]);

  const auth = useMemo(
    () => (token ? { eventId, role: "host" as const, token } : null),
    [eventId, token],
  );
  const { state, setState, error } = usePollState(auth);

  useEffect(() => {
    if (!state) return;
    setTitle(state.title);
    setRoundSec(state.roundSec);
    setNameA(state.teams.a.name);
    setNameB(state.teams.b.name);
    setColorA(state.teams.a.color);
    setColorB(state.teams.b.color);
    setPhotoA(state.teams.a.captainPhoto);
    setPhotoB(state.teams.b.captainPhoto);
  }, [state?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const joinUrl = `${base}/join/${eventId}`;
  const screenUrl = state?.screenToken
    ? `${base}/screen/${eventId}#s=${state.screenToken}`
    : `${base}/screen/${eventId}`;

  const hostPost = useCallback(
    async (action: string, payload?: Record<string, unknown>) => {
      if (!token) return;
      setBusy(true);
      setMsg(null);
      try {
        const res = await fetch("/api/host", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ eventId, action, payload }),
        });
        const data = await readJson<PublicState & { error?: string }>(res);
        if (!res.ok) throw new Error(data.error || "Ошибка");
        setState(data);
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Ошибка");
      } finally {
        setBusy(false);
      }
    },
    [eventId, token, setState],
  );

  async function saveSettings() {
    await hostPost("settings", {
      title,
      roundSec,
      teamA: { name: nameA, color: colorA, captainPhoto: photoA },
      teamB: { name: nameB, color: colorB, captainPhoto: photoB },
    });
    setMsg("Сохранено");
  }

  async function onPhoto(side: "a" | "b", file: File | null) {
    if (!file) return;
    try {
      const data = await readFileAsJpegDataUrl(file);
      if (side === "a") setPhotoA(data);
      else setPhotoB(data);
    } catch {
      setMsg("Не удалось загрузить фото");
    }
  }

  if (!token) {
    return (
      <div className="shell">
        <p className="mt-20 text-center text-[var(--mute)]">
          Откройте событие с устройства ведущего или создайте новое на главной.
        </p>
        <BrandFooter />
      </div>
    );
  }

  const phase = state?.phase ?? "lobby";

  return (
    <div className="shell-wide">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png" alt="" className="mb-3 h-8 w-auto" />
          <h1 className="display text-3xl font-semibold md:text-4xl">{state?.title || title}</h1>
          <p className="mt-1 text-sm text-[var(--mute)]">
            Гостей: {state?.guestCount ?? 0} · раунд {state?.round ?? 0} · {phase}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn-ghost" href={screenUrl} target="_blank" rel="noreferrer">
            Экран зала
          </a>
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => hostPost("stop")}>
            В лобби
          </button>
        </div>
      </header>

      {(error || msg) && (
        <p className="mb-4 text-sm" style={{ color: error ? "var(--coral)" : "var(--lime)" }}>
          {error || msg}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="panel space-y-5">
          <h2 className="display text-xl">Команды</h2>
          <label className="block">
            <span className="label">Название события</span>
            <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Длина раунда: {roundSec} сек</span>
            <input
              type="range"
              min={5}
              max={10}
              value={roundSec}
              onChange={(e) => setRoundSec(Number(e.target.value))}
              className="w-full accent-[var(--lime)]"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <TeamEditor
              label="Команда А"
              name={nameA}
              color={colorA}
              photo={photoA}
              onName={setNameA}
              onColor={setColorA}
              onPhoto={(f) => onPhoto("a", f)}
              onClearPhoto={() => setPhotoA(null)}
            />
            <TeamEditor
              label="Команда Б"
              name={nameB}
              color={colorB}
              photo={photoB}
              onName={setNameB}
              onColor={setColorB}
              onPhoto={(f) => onPhoto("b", f)}
              onClearPhoto={() => setPhotoB(null)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" disabled={busy} onClick={saveSettings}>
              Сохранить
            </button>
            <button
              type="button"
              className="btn-lime"
              disabled={busy || (phase !== "lobby" && phase !== "result")}
              onClick={() => hostPost("start")}
            >
              Старт раунда
            </button>
          </div>
        </section>

        <section className="panel flex flex-col items-center gap-4">
          <h2 className="display text-xl self-start">QR для гостей</h2>
          <div className="qr-box">
            {base ? <QRCodeSVG value={joinUrl} size={180} level="M" /> : <div className="h-[180px] w-[180px]" />}
          </div>
          <p className="break-all text-center text-xs text-[var(--mute)]">{joinUrl}</p>
          <button
            type="button"
            className="btn-ghost w-full"
            onClick={() => navigator.clipboard.writeText(joinUrl)}
          >
            Копировать ссылку гостя
          </button>
          <button
            type="button"
            className="btn-ghost w-full"
            onClick={() => navigator.clipboard.writeText(screenUrl)}
          >
            Копировать экран зала
          </button>

          {state && (phase === "countdown" || phase === "live" || phase === "result") && (
            <div className="mt-2 w-full">
              {phase === "countdown" && (
                <CountdownRing remainingMs={state.remainingMs} label="Приготовьтесь" />
              )}
              {phase === "live" && (
                <div className="text-center">
                  <div className="display text-5xl tabular-nums">
                    {Math.ceil(state.remainingMs / 1000)}
                  </div>
                  <p className="text-sm text-[var(--mute)]">секунд хлопать</p>
                </div>
              )}
              {phase === "result" && (
                <p className="winner-banner" style={{ color: winnerColor(state) }}>
                  {winnerLabel(state)}
                </p>
              )}
              <div className="mt-4">
                <DualMeters teams={state.teams} phase={phase} winner={state.winner} />
              </div>
            </div>
          )}
        </section>
      </div>
      <BrandFooter />
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

function TeamEditor({
  label,
  name,
  color,
  photo,
  onName,
  onColor,
  onPhoto,
  onClearPhoto,
}: {
  label: string;
  name: string;
  color: string;
  photo: string | null;
  onName: (v: string) => void;
  onColor: (v: string) => void;
  onPhoto: (f: File | null) => void;
  onClearPhoto: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-black/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold" style={{ color }}>
          {label}
        </span>
        <label className="color-swatch" style={{ background: color }} title="Цвет">
          <input
            type="color"
            value={color}
            onChange={(e) => onColor(e.target.value)}
            className="h-full w-full cursor-pointer opacity-0"
          />
        </label>
      </div>
      <input className="field mb-3" value={name} onChange={(e) => onName(e.target.value)} />
      <div className="flex items-center gap-3">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <div className="h-14 w-14 rounded-full border border-dashed border-white/20" />
        )}
        <div className="flex flex-col gap-1">
          <label className="btn-ghost cursor-pointer px-3 py-2 text-sm">
            Фото капитана
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPhoto(e.target.files?.[0] || null)}
            />
          </label>
          {photo && (
            <button type="button" className="text-left text-xs text-[var(--mute)]" onClick={onClearPhoto}>
              Убрать
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
