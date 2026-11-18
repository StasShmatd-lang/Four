"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrandFooter } from "@/components/BrandFooter";
import { readJson } from "@/lib/apiClient";

export default function HomePage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function createEvent() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/events", { method: "POST" });
      const data = await readJson<{
        id: string;
        hostToken: string;
        screenToken?: string;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error || "Ошибка");
      sessionStorage.setItem(`hostToken:${data.id}`, data.hostToken);
      if (data.screenToken) sessionStorage.setItem(`screenToken:${data.id}`, data.screenToken);
      router.push(`/host/${data.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось создать");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <div className="arena-grid" aria-hidden />
      <div className="relative z-10 flex flex-1 flex-col justify-center gap-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.png" alt="Stanislav Shmidt" className="brand-mark hero-enter" />
        <div className="text-center hero-enter-delay">
          <h1 className="display text-4xl font-semibold sm:text-[2.75rem]">Хор</h1>
          <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-[var(--mute)]">
            Две половины зала. Микрофон телефона. Кто громче — тот победил.
          </p>
        </div>
        <div className="hero-enter-delay-2 flex flex-col gap-3">
          <button type="button" className="btn-lime w-full" disabled={busy} onClick={createEvent}>
            {busy ? "Создаём арену…" : "Создать событие"}
          </button>
          {err && <p className="text-center text-sm text-[var(--coral)]">{err}</p>}
        </div>
      </div>
      <BrandFooter />
    </div>
  );
}
