"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

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
 *
 * Driven by gsap (already on the page for scroll) rather than framer-motion,
 * which was ~37 KB gzipped in the initial bundle for these springs alone.
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
  const innerRef = useRef<HTMLSpanElement | null>(null);
  const tweens = useRef<{
    x: gsap.QuickToFunc;
    y: gsap.QuickToFunc;
    scale: gsap.QuickToFunc;
  } | null>(null);

  useEffect(() => {
    const el = ref.current;
    const inner = innerRef.current;
    if (!el || !inner) return;
    // magnetic follow: a springy back.out stands in for the old
    // stiffness 180 / damping 14 spring (slightly underdamped).
    const follow = { duration: 0.45, ease: "back.out(1.4)" };
    // pressure feedback: near-critically damped, so plain ease-out.
    const press = { duration: 0.3, ease: "power2.out" };
    tweens.current = {
      x: gsap.quickTo(inner, "x", follow),
      y: gsap.quickTo(inner, "y", follow),
      scale: gsap.quickTo(el, "scale", press),
    };
    return () => {
      gsap.killTweensOf([inner, el]);
      tweens.current = null;
    };
  }, []);

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    const t = tweens.current;
    if (!el || !t) return;
    const rect = el.getBoundingClientRect();
    const relX = e.clientX - (rect.left + rect.width / 2);
    const relY = e.clientY - (rect.top + rect.height / 2);
    t.x((relX / rect.width) * strength);
    t.y((relY / rect.height) * strength);
  };

  // pressure-sensitive feedback: tiny scale-up on hover, scale-down on press.
  const onEnter = () => tweens.current?.scale(1.03);
  const onLeave = () => {
    const t = tweens.current;
    if (!t) return;
    t.x(0);
    t.y(0);
    t.scale(1);
  };
  const onDown = () => tweens.current?.scale(0.97);
  const onUp = () => tweens.current?.scale(1.03);

  const inner = (
    <span ref={innerRef} className="inline-flex will-change-transform">
      {children}
    </span>
  );

  const handlers = {
    onPointerMove: onMove,
    onPointerEnter: onEnter,
    onPointerLeave: onLeave,
    onPointerDown: onDown,
    onPointerUp: onUp,
    onPointerCancel: onLeave,
  };

  if (href) {
    return (
      <a
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={href}
        target={target}
        rel={rel}
        onClick={onClick}
        className={className}
        data-hoverable
        {...handlers}
      >
        {inner}
      </a>
    );
  }
  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type="button"
      onClick={onClick}
      className={className}
      data-hoverable
      {...handlers}
    >
      {inner}
    </button>
  );
}
