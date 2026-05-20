"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

type Props = React.PropsWithChildren<{
  href?: string;
  // onClick receives the React mouse event so href-mode consumers can
  // call preventDefault to intercept the anchor jump (e.g. hero CTAs
  // that dispatch the navbar's curtain-wash transition before teleport
  // instead of letting the browser's native scroll-to-hash run).
  onClick?: (
    e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
  ) => void;
  // anchor-mode pass-throughs for external links (résumé pdf in a new
  // tab, etc.). ignored in button mode.
  target?: React.HTMLAttributeAnchorTarget;
  rel?: string;
  className?: string;
  strength?: number;
}>;

/**
 * A button (or anchor) whose contents subtly track the cursor when hovered.
 * Used for primary CTAs to give the page the "studio site" feel without
 * being obnoxious. Set `strength` lower for a tighter effect.
 */
export function MagneticButton({
  children,
  href,
  onClick,
  target,
  rel,
  className,
  strength = 18,
}: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 180, damping: 14, mass: 0.4 });
  const y = useSpring(my, { stiffness: 180, damping: 14, mass: 0.4 });

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relX = e.clientX - (rect.left + rect.width / 2);
    const relY = e.clientY - (rect.top + rect.height / 2);
    mx.set((relX / rect.width) * strength);
    my.set((relY / rect.height) * strength);
  };

  const onLeave = () => {
    mx.set(0);
    my.set(0);
  };

  const inner = (
    <motion.span style={{ x, y }} className="inline-flex">
      {children}
    </motion.span>
  );

  // pressure-sensitive feedback: tiny scale-up on hover, scale-down on press.
  // a spring (not a tween) so the impulse is sympathetic to the magnetic
  // translate underneath and doesn't read as a snappy css :hover.
  const tactile = {
    whileHover: { scale: 1.03 },
    whileTap: { scale: 0.97 },
    transition: {
      type: "spring" as const,
      stiffness: 360,
      damping: 22,
      mass: 0.4,
    },
  };

  if (href) {
    return (
      <motion.a
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={href}
        target={target}
        rel={rel}
        onClick={onClick}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        className={className}
        data-hoverable
        {...tactile}
      >
        {inner}
      </motion.a>
    );
  }
  return (
    <motion.button
      ref={ref as React.Ref<HTMLButtonElement>}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onClick={onClick}
      className={className}
      data-hoverable
      {...tactile}
    >
      {inner}
    </motion.button>
  );
}
