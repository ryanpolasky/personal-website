import { MagneticButton } from "@/components/MagneticButton";

export default function NotFound() {
  return (
    <main
      className="flex min-h-[100svh] flex-col items-center justify-center px-6 text-center"
      style={{ background: "var(--color-bg)" }}
    >
      <p
        className="mb-3 text-xs uppercase tracking-[0.32em] text-[var(--color-text-faint)]"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        404 · not found
      </p>
      <h1 className="display text-5xl sm:text-7xl">nothing here.</h1>
      <p
        className="mt-4 max-w-md text-base text-[var(--color-text-muted)]"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        You followed a broken link or typed something that doesn&apos;t exist.
        That happens.
      </p>
      <div className="mt-10 flex justify-center">
        <MagneticButton
          href="/"
          className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-6 py-3 text-sm text-[var(--color-bg)] transition-colors hover:bg-[var(--color-accent-warm)]"
        >
          take me home →
        </MagneticButton>
      </div>
    </main>
  );
}
