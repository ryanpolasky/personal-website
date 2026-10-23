"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ClubModeComponent = typeof import("./ClubMode").ClubMode;

function isEditableTarget(target: EventTarget | null): boolean {
  const element =
    target instanceof HTMLElement ? target : null;
  return !!element?.closest("input, textarea") || !!element?.isContentEditable;
}

function unlockAudio() {
  const audioWindow = window as Window & {
    __ryClubAudioContext?: AudioContext;
  };
  if (!audioWindow.__ryClubAudioContext) {
    audioWindow.__ryClubAudioContext = new AudioContext();
  }
  void audioWindow.__ryClubAudioContext.resume();
}

export function ClubUnlock() {
  const [ClubMode, setClubMode] = useState<ClubModeComponent | null>(null);
  const opened = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let loading = false;
    let buffer = "";

    const open = (userGesture = false) => {
      if (loading || opened.current) return;
      loading = true;
      if (userGesture) unlockAudio();
      void import("./ClubMode").then((module) => {
        loading = false;
        if (!cancelled) {
          opened.current = true;
          setClubMode(() => module.ClubMode);
        }
      }).catch(() => {
        loading = false;
      });
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isEditableTarget(event.target)) {
        return;
      }
      if (Array.from(event.key).length !== 1) return;
      buffer = (buffer + event.key.toLowerCase()).slice(-4);
      if (buffer === "club") open(true);
    };
    const onOpen = () => open(true);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("club:open", onOpen);
    if (new URLSearchParams(window.location.search).has("club")) open();

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("club:open", onOpen);
    };
  }, []);

  if (!ClubMode || typeof document === "undefined") return null;

  return createPortal(
    <ClubMode
      onExit={() => {
        opened.current = false;
        setClubMode(null);
      }}
    />,
    document.body,
  );
}
