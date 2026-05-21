"use client";

import { MagneticButton } from "@/components/MagneticButton";

type UtdWebringButtonsProps = {
  className?: string;
  onNavigate?: () => void;
};

const WEBRING_DOMAIN = "ryanpolasky.com";
const WEBRING_BASE = `https://cs.utdring.com/#${WEBRING_DOMAIN}`;
const WEBRING_ICON = "https://cs.utdring.com/icon.white.svg";

export function UtdWebringButtons({
  className = "",
  onNavigate,
}: UtdWebringButtonsProps) {
  const sideButton =
    "inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-[var(--color-line)] bg-[color-mix(in_oklab,var(--color-bg)_76%,transparent)] px-3 text-[15px] text-[var(--color-text-muted)] shadow-[0_10px_32px_-24px_rgba(14,13,11,0.5)] backdrop-blur-md transition-colors hover:border-[var(--color-line-strong)] hover:text-[var(--color-text)]";
  const centerButton =
    "inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-text)] bg-[var(--color-text)] text-[var(--color-bg)] shadow-[0_16px_40px_-28px_rgba(14,13,11,0.7)]";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <MagneticButton
        href={`${WEBRING_BASE}?nav=prev`}
        aria-label="previous site in the UTD CS Webring"
        onClick={onNavigate}
        className={sideButton}
        strength={10}
      >
        ←
      </MagneticButton>
      <MagneticButton
        href={WEBRING_BASE}
        aria-label="UTD CS Webring"
        onClick={onNavigate}
        className={centerButton}
        strength={10}
      >
        <img src={WEBRING_ICON} alt="" className="h-4 w-4 opacity-85" />
      </MagneticButton>
      <MagneticButton
        href={`${WEBRING_BASE}?nav=next`}
        aria-label="next site in the UTD CS Webring"
        onClick={onNavigate}
        className={sideButton}
        strength={10}
      >
        →
      </MagneticButton>
    </div>
  );
}
