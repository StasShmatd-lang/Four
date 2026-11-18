"use client";

export function CountdownRing({ remainingMs, label }: { remainingMs: number; label?: string }) {
  const sec = Math.max(0, Math.ceil(remainingMs / 1000));
  return (
    <div className="countdown-ring">
      <div className="countdown-num">{sec || "GO"}</div>
      {label && <div className="countdown-label">{label}</div>}
    </div>
  );
}
