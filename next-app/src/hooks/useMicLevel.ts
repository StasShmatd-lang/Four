"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Browser mic → numeric RMS level 0–100. Never records or uploads audio.
 * Falls back to tap impulses when permission denied.
 */
export function useMicLevel(active: boolean) {
  const [level, setLevel] = useState(0);
  const [mode, setMode] = useState<"idle" | "mic" | "tap" | "denied">("idle");
  const tapImpulse = useRef(0);
  const raf = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  const tapClap = useCallback(() => {
    tapImpulse.current = Math.min(100, tapImpulse.current + 55 + Math.random() * 30);
    setMode((m) => (m === "mic" ? m : "tap"));
  }, []);

  useEffect(() => {
    if (!active) {
      setLevel(0);
      return;
    }

    let cancelled = false;
    let analyser: AnalyserNode | null = null;
    let data: Uint8Array<ArrayBuffer> | null = null;

    async function startMic() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true },
          video: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const ctx = new AudioContext();
        ctxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.35;
        source.connect(analyser);
        data = new Uint8Array(new ArrayBuffer(analyser.fftSize));
        setMode("mic");
      } catch {
        if (!cancelled) setMode("denied");
      }
    }

    startMic();

    const tick = () => {
      let mic = 0;
      if (analyser && data) {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        mic = Math.min(100, rms * 320);
      }
      tapImpulse.current *= 0.82;
      if (tapImpulse.current < 0.8) tapImpulse.current = 0;
      const combined = Math.min(100, Math.max(mic, tapImpulse.current));
      setLevel(combined);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, [active]);

  return { level, mode, tapClap };
}
