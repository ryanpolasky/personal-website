"use client";

// autopsy-style intro: single big screenshot + a forensic-tag vitals
// strip beneath. vitals are passed in so the component stays generic.

import { MediaFrame } from "./MediaFrame";
import type { ProjectMediaItem } from "@/lib/projects";

export interface CaseFileVital {
  label: string;
  value: string;
}

export interface CaseFileIntroProps {
  primary?: ProjectMediaItem;
  fileNumber: string;
  vitals: CaseFileVital[];
  onOpen: (item: ProjectMediaItem) => void;
}

export function CaseFileIntro({
  primary,
  fileNumber,
  vitals,
  onOpen,
}: CaseFileIntroProps) {
  return (
    <div className="grid h-full min-h-0 max-h-[68svh] gap-3 lg:grid-rows-[minmax(0,1fr)_auto] sm:gap-4">
      <MediaFrame
        item={primary}
        className="min-h-0"
        sizes="(min-width: 1024px) 720px, 100vw"
        onOpen={onOpen}
      />
      {/* mono vitals strip. file-number leads, then label/value pairs. */}
      <div
        className="relative isolate overflow-hidden rounded-[1.4rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025)_55%,rgba(255,255,255,0.05)),radial-gradient(circle_at_8%_0%,color-mix(in_oklab,var(--project-tint)_22%,transparent),transparent_42%)] px-4 py-3 shadow-[0_18px_55px_-40px_rgba(0,0,0,0.9)] sm:px-5 sm:py-4"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,transparent,var(--project-tint),transparent)] opacity-70" />
        <div className="mb-2.5 flex items-center gap-2 text-[9px] uppercase tracking-[0.32em] text-[var(--color-text-invert-faint)]">
          <span className="h-1 w-1 rounded-full bg-[var(--project-tint)] shadow-[0_0_10px_var(--project-tint)]" />
          <span>case file</span>
          <span className="h-px flex-1 bg-[var(--color-line-invert)] opacity-20" />
          <span>{fileNumber}</span>
        </div>
        {/* sm+ col count = vitals.length via CSS var; mobile stays 2-col. */}
        <dl
          className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-[repeat(var(--vital-cols),minmax(0,1fr))]"
          style={{
            ["--vital-cols" as string]: vitals.length,
          }}
        >
          {vitals.map((v) => (
            <div key={v.label} className="flex flex-col gap-1">
              <dt className="text-[8.5px] uppercase tracking-[0.24em] text-[var(--color-text-invert-faint)]">
                {v.label}
              </dt>
              <dd className="text-[12.5px] leading-tight text-[var(--color-text-invert)]">
                {v.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
