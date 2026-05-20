"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { VARIANTS } from "@/lib/variants";

const STORAGE_KEY = "rp.choice.v1";

type Mode = "boot" | "picking" | "locked";

type State = {
  mode: Mode;
  activeIdx: number; // fullscreen slide (meaningful in 'locked')
  previewIdx: number; // preview slide (meaningful in 'picking')
  booted: boolean;
};

type Action =
  | { type: "boot" }
  | { type: "enter-picker"; idx: number }
  | { type: "preview"; idx: number }
  | { type: "lock"; idx: number };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "boot":
      return { ...s, booted: true };
    case "enter-picker":
      return { ...s, mode: "picking", previewIdx: a.idx };
    case "preview":
      return { ...s, previewIdx: a.idx };
    case "lock":
      return { ...s, mode: "locked", activeIdx: a.idx };
    default:
      return s;
  }
}

function loadSavedKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "plaintext") {
      // legacy migration: old key `plaintext` → `no-css`.
      localStorage.setItem(STORAGE_KEY, "no-css");
      return "no-css";
    }
    return raw;
  } catch {
    return null;
  }
}

// variant gallery (React port of the original index.html picker). returning
// visitors lock to their saved choice; first-time + ?gallery=1 open the
// picker. variants live in iframes hydrated lazily (current ±1).
export function Gallery() {
  const router = useRouter();
  const search = useSearchParams();
  const forcePicker =
    search.get("gallery") === "1" || search.get("pick") === "1";

  const [state, dispatch] = useReducer(reducer, {
    mode: "boot",
    activeIdx: 0,
    previewIdx: 0,
    booted: false,
  });
  const [accent, setAccent] = useState<string>("#FF5A36");

  const iframeRefs = useRef<Array<HTMLIFrameElement | null>>(
    Array(VARIANTS.length).fill(null),
  );
  const hydratedRef = useRef<Set<number>>(new Set());

  const total = VARIANTS.length;
  const previewName = VARIANTS[state.previewIdx]?.name ?? "";
  const previewKey = VARIANTS[state.previewIdx]?.key ?? "";

  // lazily set iframe.src on hydration.
  const hydrate = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= total) return;
      if (hydratedRef.current.has(idx)) return;
      const el = iframeRefs.current[idx];
      if (!el) return;
      if (el.src) {
        hydratedRef.current.add(idx);
        return;
      }
      el.src = VARIANTS[idx].src;
      hydratedRef.current.add(idx);
    },
    [total],
  );

  // tell a variant whether it's currently the active/visible slide.
  const notifyVariant = useCallback((idx: number, active: boolean) => {
    const el = iframeRefs.current[idx];
    if (!el || !el.contentWindow || !el.src) return;
    try {
      el.contentWindow.postMessage(
        { type: "rp-variant-visibility", key: VARIANTS[idx].key, active },
        window.location.origin,
      );
    } catch {
      // Cross-origin or detached frame - fine to ignore.
    }
  }, []);

  // read a variant's accent from its computed CSS so the chrome matches.
  const readAccent = useCallback((idx: number): string | null => {
    const el = iframeRefs.current[idx];
    if (!el) return null;
    try {
      const doc = el.contentDocument;
      if (!doc) return null;
      const target = doc.body ?? doc.documentElement;
      const cs = getComputedStyle(target);
      for (const v of [
        "--accent",
        "--accent-color",
        "--stamp",
        "--orange",
        "--ok",
      ]) {
        const c = cs.getPropertyValue(v).trim();
        if (c) return c;
      }
    } catch {
      // Some variants live in restricted contexts; just skip.
    }
    return null;
  }, []);

  // apply an accent color to the picker chrome.
  const applyAccent = useCallback(
    (idx: number) => {
      const c = readAccent(idx);
      if (c) setAccent(c);
    },
    [readAccent],
  );

  // ─── boot ───
  useEffect(() => {
    const savedKey = loadSavedKey();
    const savedIdx = savedKey
      ? VARIANTS.findIndex((v) => v.key === savedKey)
      : -1;
    const initialIdx = savedIdx >= 0 ? savedIdx : 0;

    hydrate(initialIdx);

    if (savedIdx >= 0 && !forcePicker) {
      // returning visitor - lock to choice
      dispatch({ type: "lock", idx: savedIdx });
      window.setTimeout(() => {
        dispatch({ type: "boot" });
        applyAccent(savedIdx);
        notifyVariant(savedIdx, true);
      }, 300);
      return;
    }

    // first visit (or forced) - open picker
    dispatch({ type: "enter-picker", idx: initialIdx });
    [initialIdx - 1, initialIdx, initialIdx + 1].forEach(hydrate);
    window.setTimeout(() => {
      dispatch({ type: "boot" });
      applyAccent(initialIdx);
    }, 300);
  }, [forcePicker, hydrate, applyAccent, notifyVariant]);

  // Notify all variants of visibility changes (debounced via effect deps).
  useEffect(() => {
    if (state.mode !== "locked") return;
    iframeRefs.current.forEach((_, i) =>
      notifyVariant(i, i === state.activeIdx),
    );
  }, [state.mode, state.activeIdx, notifyVariant]);

  // Listen for accent updates posted by variants (e.g. konami code in original).
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data as {
        type?: string;
        key?: string;
        color?: string;
      } | null;
      if (!d || d.type !== "aag-accent" || !d.key || !d.color) return;
      const idx = VARIANTS.findIndex((v) => v.key === d.key);
      if (idx < 0) return;
      const expected = iframeRefs.current[idx]?.contentWindow;
      if (e.source !== expected) return;
      const visibleIdx =
        state.mode === "locked" ? state.activeIdx : state.previewIdx;
      if (idx === visibleIdx) setAccent(d.color);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [state.mode, state.activeIdx, state.previewIdx]);

  const goPreview = useCallback(
    (raw: number) => {
      let i = raw;
      if (i < 0) i = total - 1;
      if (i >= total) i = 0;
      [i - 1, i, i + 1].forEach(hydrate);
      dispatch({ type: "preview", idx: i });
      window.setTimeout(() => applyAccent(i), 80);
    },
    [total, hydrate, applyAccent],
  );

  const pick = useCallback(
    (idx: number) => {
      try {
        localStorage.setItem(STORAGE_KEY, VARIANTS[idx].key);
      } catch {
        // ignore - private mode / storage disabled
      }
      hydrate(idx);
      dispatch({ type: "lock", idx });
      // Remove the ?gallery=1 param so reloads land in locked mode.
      if (forcePicker) {
        router.replace("/gallery");
      }
    },
    [hydrate, router, forcePicker],
  );

  const openPicker = useCallback(() => {
    dispatch({ type: "enter-picker", idx: state.activeIdx });
    [state.activeIdx - 1, state.activeIdx, state.activeIdx + 1].forEach(
      hydrate,
    );
    window.setTimeout(() => applyAccent(state.activeIdx), 80);
  }, [state.activeIdx, hydrate, applyAccent]);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (state.mode !== "picking") return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPreview(state.previewIdx - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goPreview(state.previewIdx + 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        pick(state.previewIdx);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.mode, state.previewIdx, goPreview, pick]);

  // Iframe styling: in 'picking', show the preview inset; in 'locked', fullscreen the active one.
  const stageStyle = useMemo(
    () => ({ ["--accent" as string]: accent }) as React.CSSProperties,
    [accent],
  );

  return (
    <div
      className="relative h-[100svh] w-screen overflow-hidden bg-[var(--color-bg)]"
      style={stageStyle}
    >
      {/* stage: iframes. each is wrapped in an abs-positioned div because
          iframes are replaced elements - `inset:0` alone resolves to their
          intrinsic 300×150 box, not the parent. */}
      <div className="absolute inset-0">
        {VARIANTS.map((v, i) => {
          const isLockedActive =
            state.mode === "locked" && i === state.activeIdx;
          const isPreviewActive =
            state.mode === "picking" && i === state.previewIdx;
          const visible = isLockedActive || isPreviewActive;
          const fullscreen = isLockedActive;

          // The preview frame: inset on all sides so picker chrome fits around it.
          const previewFrame =
            "top-[8vh] left-[3vw] right-[3vw] bottom-[18vh] rounded-2xl border border-[var(--color-line-strong)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7),0_8px_24px_-12px_rgba(0,0,0,0.45)] overflow-hidden";
          const fullscreenFrame = "inset-0 rounded-none border-0";

          return (
            <div
              key={v.key}
              className={`absolute bg-[var(--color-bg)] transition-all duration-[700ms] ${
                fullscreen ? fullscreenFrame : previewFrame
              } ${visible ? "opacity-100" : "invisible opacity-0 delay-[380ms]"}`}
              style={{
                transitionTimingFunction: "cubic-bezier(0.65,0,0.35,1)",
                pointerEvents: visible ? "auto" : "none",
              }}
            >
              <iframe
                ref={(el) => {
                  iframeRefs.current[i] = el;
                }}
                data-key={v.key}
                data-name={v.name}
                title={v.title}
                loading={i === 0 ? "eager" : "lazy"}
                className="block h-full w-full border-0 bg-[var(--color-bg)]"
              />
            </div>
          );
        })}
      </div>

      {/* ─── loading veil ─── */}
      {!state.booted && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-[var(--color-bg)] transition-opacity duration-500">
          <p
            className="text-xs uppercase tracking-[0.32em] text-[var(--color-text-faint)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            loading gallery…
          </p>
        </div>
      )}

      {/* ─── picker chrome (only in picking mode) ─── */}
      {state.mode === "picking" && (
        <section
          aria-label="Gallery"
          className="pointer-events-none absolute inset-0 z-30"
        >
          {/* picker chrome - deliberately minimal; iframe is the star. */}

          {/* top row */}
          <div
            className="pointer-events-auto absolute top-0 left-0 right-0 flex items-center gap-3 px-6 pt-6 text-[11px] text-[var(--color-text-faint)] sm:px-12 sm:pt-10"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <Link
              href="/"
              className="uppercase tracking-[0.32em] hover:text-[var(--color-text)] transition-colors"
              data-hoverable
            >
              ← home
            </Link>
            <span className="hidden sm:flex ml-6 items-center gap-2 opacity-80">
              <span className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#ff5f57]/60" />
                <span className="h-2 w-2 rounded-full bg-[#febc2e]/60" />
                <span className="h-2 w-2 rounded-full bg-[#28c840]/60" />
              </span>
              <span>
                ryanpolasky.com /{" "}
                <b className="text-[var(--color-text-muted)]">{previewKey}</b>
                .html
              </span>
            </span>
            <span className="ml-auto opacity-60">
              {String(state.previewIdx + 1).padStart(2, "0")} /{" "}
              {String(total).padStart(2, "0")}
            </span>
          </div>

          {/* footer */}
          <div className="pointer-events-auto absolute bottom-0 left-0 right-0 px-6 pb-6 sm:px-12 sm:pb-10">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => goPreview(state.previewIdx - 1)}
                  className="grid h-10 w-10 place-items-center rounded-full border border-[var(--color-line-strong)] text-[var(--color-text)] hover:border-[var(--color-text)] transition-colors"
                  aria-label="Previous look"
                  data-hoverable
                >
                  ←
                </button>
                <div className="flex items-center gap-1.5" role="tablist">
                  {VARIANTS.map((v, i) => (
                    <button
                      key={v.key}
                      role="tab"
                      aria-selected={i === state.previewIdx}
                      aria-label={`Preview ${i + 1}: ${v.name}`}
                      title={`${i + 1}. ${v.name}`}
                      onClick={() => goPreview(i)}
                      className={`h-1.5 rounded-full transition-all ${
                        i === state.previewIdx
                          ? "w-6 bg-[var(--color-text)]"
                          : "w-1.5 bg-[var(--color-line-strong)] hover:bg-[var(--color-text-muted)]"
                      }`}
                      data-hoverable
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => goPreview(state.previewIdx + 1)}
                  className="grid h-10 w-10 place-items-center rounded-full border border-[var(--color-line-strong)] text-[var(--color-text)] hover:border-[var(--color-text)] transition-colors"
                  aria-label="Next look"
                  data-hoverable
                >
                  →
                </button>
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => goPreview(Math.floor(Math.random() * total))}
                  className="text-sm text-[var(--color-text-muted)] underline-offset-4 hover:text-[var(--color-text)] hover:underline transition-colors"
                  style={{ fontFamily: "var(--font-sans)" }}
                  data-hoverable
                >
                  just <u>show me one at random</u>
                </button>
                <button
                  type="button"
                  onClick={() => pick(state.previewIdx)}
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm text-[var(--color-bg)] transition-colors"
                  style={{
                    backgroundColor: accent,
                    fontFamily: "var(--font-sans)",
                  }}
                  data-hoverable
                  aria-label={`Pick ${previewName}`}
                >
                  pick &ldquo;{previewName.toLowerCase()}&rdquo;
                  <span aria-hidden>→</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── cog (visible in locked mode) ─── */}
      {state.mode === "locked" && (
        <button
          type="button"
          onClick={openPicker}
          aria-label="Reopen picker"
          className="absolute right-6 top-6 z-40 grid h-10 w-10 place-items-center rounded-full border border-[var(--color-line-strong)] bg-[var(--color-bg-soft)]/70 backdrop-blur text-[var(--color-text)] hover:border-[var(--color-text)] transition-colors"
          style={{ fontFamily: "var(--font-mono)" }}
          data-hoverable
        >
          ⚙
        </button>
      )}
    </div>
  );
}
