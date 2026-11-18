"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MicMode = "idle" | "asking" | "mic" | "tap" | "denied";

/**
 * Browser mic → numeric RMS level 0–100. Never records or uploads audio.
 * Falls back to tap impulses when permission denied.
 */
export function useMicLevel(active: boolean) {
  const [level, setLevel] = useState(0);
  const [mode, setMode] = useState<MicMode>("idle");
  const tapImpulse = useRef(0);
  const raf = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  const stopMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
    dataRef.current = null;
    void ctxRef.current?.close();
    ctxRef.current = null;
  }, []);

  const enableMic = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMode("denied");
      return false;
    }
    setMode("asking");
    try {
      stopMic();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true },
        video: false,
      });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      if (ctx.state === "suspended") await ctx.resume();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.35;
      source.connect(analyser);
      analyserRef.current = analyser;
      dataRef.current = new Uint8Array(new ArrayBuffer(analyser.fftSize));
      setMode("mic");
      return true;
    } catch {
      stopMic();
      setMode("denied");
      return false;
    }
  }, [stopMic]);

  const tapClap = useCallback(() => {
    tapImpulse.current = Math.min(100, tapImpulse.current + 55 + Math.random() * 30);
    setMode((m) => (m === "mic" ? m : "tap"));
  }, []);

  // Meter loop while guest is in the event (lobby preview + live send)
  useEffect(() => {
    if (!active) {
      setLevel(0);
      return;
    }

    const tick = () => {
      let mic = 0;
      const analyser = analyserRef.current;
      const data = dataRef.current;
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
      setLevel(Math.min(100, Math.max(mic, tapImpulse.current)));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf.current);
    };
  }, [active]);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      stopMic();
    };
  }, [stopMic]);

  return { level, mode, tapClap, enableMic };
}
