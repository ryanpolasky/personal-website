"use client";

import dynamic from "next/dynamic";

// the hero was the one statically imported r3f scene, which put three + r3f
// + drei (~240 KB gz) in the script list that gates hydration for the whole
// page. loading it client-side lets nav / smooth scroll / ctas hydrate first
// and the canvas mount right after; the boot curtain covers the gap and its
// `hero:ready` / MAX_BOOT_MS flow is unchanged. `ssr: false` has to live in a
// client module, hence this wrapper.
const HeroClusterView = dynamic(
  () =>
    import("@/components/scenes/HeroClusterView").then((m) => ({
      default: m.HeroClusterView,
    })),
  { ssr: false },
);

export function HeroClusterLazy({ className }: { className?: string }) {
  return <HeroClusterView className={className} />;
}
