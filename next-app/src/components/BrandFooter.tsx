const INSTAGRAM_URL =
  "https://www.instagram.com/st.shmidt?mdxt=emx1MzR3dmN0MmZx&utm_source=qr";

export function BrandFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer className={`flex justify-center ${compact ? "pb-1 pt-3" : "mt-10 pb-2 pt-6"}`}>
      <a
        href={INSTAGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-center gap-1.5 opacity-65 transition hover:opacity-100"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.png" alt="Stanislav Shmidt" className="h-7 w-auto md:h-8" />
        <span className="font-body text-[11px] tracking-wide text-[var(--mute)]">
          instagram.com/st.shmidt
        </span>
      </a>
    </footer>
  );
}
