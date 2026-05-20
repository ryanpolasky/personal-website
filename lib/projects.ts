export type ProjectWidth = "narrow" | "wide" | "xl";

export type ProjectMediaKind = "image" | "video" | "scene" | "none";

export interface ProjectMediaItem {
  label: string;
  src?: string;
  alt?: string;
  cover?: boolean;
  sprite?: {
    columns: number;
    rows: number;
    fps: number;
  };
  march?: boolean;
}

export type SectionLayout =
  | "mosaic"
  | "banner"
  | "specimen"
  | "hero"
  | "forms"
  | "gallery";

export interface ProjectSection {
  eyebrow: string;
  title: string;
  body: string;
  points?: string[];
  media?: ProjectMediaItem[];
  layout?: SectionLayout;
}

export interface ProjectGithubRepo {
  label: string;
  href: string;
}

export interface Project {
  id: string;
  index: string;
  name: string;
  tagline: string;
  body: string;
  role: string;
  stack: string[];
  href?: string;
  hrefLabel?: string;
  githubHref?: string | ProjectGithubRepo[];
  devpostHref?: string;
  logoSrc?: string;
  width: ProjectWidth;
  media: {
    kind: ProjectMediaKind;
    src?: string;
    poster?: string;
    items?: ProjectMediaItem[];
  };
  sections?: ProjectSection[];
  closingMedia?: ProjectMediaItem;
  tintHsl?: { h: number; s: number; l: number };
  enabled: boolean;
}

export const WIDTH_VW: Record<ProjectWidth, number> = {
  narrow: 64,
  wide: 88,
  xl: 116,
};

export const PROJECTS: Project[] = [
  {
    id: "autopsy",
    index: "01.",
    name: "Autopsy",
    tagline: "a black box recorder for ai coding agents.",
    body: "coding agents repeat the same mistakes every run. autopsy records every tool call, autopsies the rejected runs into a failure knowledge graph, and injects warnings straight into the next session's system prompt so the agent stops relearning lessons it already paid for. shipped at la hacks 2026 as a team of four.",
    role: "team of 4",
    stack: [
      "Python",
      "FastAPI",
      "Postgres",
      "pgvector",
      "Next.js",
      "TypeScript",
      "opencode",
      "Gemma",
    ],
    href: "https://autopsy.surf",
    hrefLabel: "visit →",
    githubHref: "https://github.com/balebbae/autopsy",
    devpostHref: "https://devpost.com/software/autopsy-zq5d84",
    width: "xl",
    media: {
      kind: "image",
      items: [
        {
          label: "the landing",
          src: "/assets/projects/autopsy/aut_hero.png",
          alt: "Autopsy landing page hero",
          cover: true,
        },
      ],
    },
    sections: [
      {
        eyebrow: "the problem",
        title: "agents have no memory between runs.",
        body: "every agent run starts from a clean slate. they forget last week's failure, drift the types again, skip the migration again, and burn api credits relearning lessons you already rejected. there's no recorder, no investigation, no safety briefing. we wanted to build the ntsb for coding agents.",
        points: [
          "Rejections vanish the moment the session ends",
          "No feedback signal carries between runs",
          "Every agent run is groundhog day, but for your wallet",
        ],
      },
      {
        eyebrow: "the pipeline",
        title: "record, classify, graph, repeat.",
        body: "a one-line install drops a typescript plugin into opencode that streams every tool call, edit, rejection, and prompt to a fastapi service. rejected runs flow through a deterministic classifier and an optional gemma enhancer, then land as nodes in a pgvector-backed failure knowledge graph: 9 node types, 8 edge types, all in postgres.",
        points: [
          "Fire-and-forget event batching keeps agent latency at zero",
          "Deterministic rules + LLM enhancer co-classify every failure",
          "Knowledge graph lives in postgres, no separate graph db",
        ],
        media: [
          {
            label: "pipeline diagram",
            src: "/assets/projects/autopsy/aut_process.png",
            alt: "Autopsy end-to-end pipeline diagram",
          },
          {
            label: "run details",
            src: "/assets/projects/autopsy/aut_details.png",
            alt: "Autopsy per-run details view",
            cover: true,
          },
        ],
      },
      {
        eyebrow: "preflight",
        title: "warnings before the first token.",
        body: "when a new task starts, autopsy embeds the description, runs ann search against past failures, and walks the graph (run to symptom to failure mode to fix pattern) with temporal decay and counter-evidence dampening. the most relevant warnings get injected straight into the agent's system prompt before it generates a single line of code.",
        points: [
          "3-hop graph traversal via a recursive postgres cte",
          "800ms hard timeout with fail-open behavior",
          "Per-edge temporal decay + counter-evidence dampening",
        ],
        media: [
          {
            label: "preflight tool",
            src: "/assets/projects/autopsy/aut_tool1.png",
            alt: "Autopsy preflight retrieval tool",
          },
          {
            label: "rejection tool",
            src: "/assets/projects/autopsy/aut_tool2.png",
            alt: "Autopsy register-rejection tool",
          },
        ],
      },
      {
        eyebrow: "results",
        title: "3rd overall, cognition company challenge winner.",
        body: "the closed-loop demo runs end to end on a real agent runtime. agent fails, autopsy records, graph grows, next similar task gets a warning, agent fixes it on the first try. fully local stack with 165 service tests passing across event ingestion, finalizer, classifier, extractor, graph writer, and embeddings.",
        points: [
          "3rd Overall + Cognition Company Challenge at LA Hacks 2026",
          "165 passing service tests across the full pipeline",
          "One-line install, fully local, no cloud dependencies",
        ],
      },
    ],
    closingMedia: {
      label: "install cta",
      src: "/assets/projects/autopsy/aut_footer.png",
      alt: "Autopsy install CTA section",
      cover: true,
    },
    tintHsl: { h: 232, s: 70, l: 60 },
    enabled: true,
  },
  {
    id: "utd-roommates",
    index: "02.",
    name: "MeteorMate",
    tagline: "ai-driven roommate matching for utd students.",
    body: "lead for an acm utd platform that matches students on habits, lifestyle, and preferences, not just location or price. owned roadmap/task breakdown, shaped the next/react frontend + python/fastapi backend architecture across postgres + firebase, and drove deployment reliability fixes for local and vercel-style environments.",
    role: "lead · acm utd",
    stack: ["React.js", "FastAPI", "Python", "Postgres", "Firebase", "DevOps"],
    href: "https://meteormate.com",
    hrefLabel: "visit →",
    githubHref: [
      {
        label: "frontend",
        href: "https://github.com/acmutd/meteormate-frontend",
      },
      {
        label: "backend",
        href: "https://github.com/acmutd/meteormate-backend",
      },
    ],
    width: "xl",
    media: {
      kind: "image",
      items: [
        {
          label: "the front door",
          src: "/assets/projects/meteormate/mm_hero.png",
          alt: "MeteorMate landing hero",
        },
        {
          label: "the pitch",
          src: "/assets/projects/meteormate/mm_features.png",
          alt: "MeteorMate feature overview",
        },
      ],
    },
    sections: [
      {
        eyebrow: "product lead",
        title: "matching for actual living compatibility.",
        body: "MeteorMate is built around the stuff that decides whether roommates work: sleep schedules, cleanliness, guests, study habits, social energy, and lifestyle preferences. I led the project shape from roadmap to task breakdown so the team could move from broad housing idea to a concrete matching product.",
        points: [
          "Owned Kanban board, roadmap, and milestone breakdown",
          "Coordinated product scope across frontend and backend work",
          "Kept matching logic centered on habits, lifestyle, and preferences",
          "Translated student housing pain points into ranked match criteria",
        ],
        media: [
          {
            label: "how they live",
            src: "/assets/projects/meteormate/mm_lifestyle.png",
            alt: "MeteorMate lifestyle preferences intake",
            cover: true,
          },
          {
            label: "what they like",
            src: "/assets/projects/meteormate/mm_interests.png",
            alt: "MeteorMate interests selection",
            cover: true,
          },
        ],
      },
      {
        eyebrow: "architecture",
        title: "next, fastapi, postgres, firebase.",
        body: "I defined and documented the end-to-end shape of the system: a Next.js/React interface for students, a Python/FastAPI backend for matching workflows, Postgres for structured application data, and Firebase where it made sense for auth and realtime product needs.",
        points: [
          "Documented frontend/backend boundaries",
          "Shaped API responsibilities around matching workflows",
          "Balanced relational data in Postgres with Firebase-backed product flows",
          "Created deployment strategy & set up all cloud infrastructure",
        ],
        media: [
          {
            label: "on the way in",
            src: "/assets/projects/meteormate/mm_auth.png",
            alt: "MeteorMate authentication flow",
          },
          {
            label: "in product",
            src: "/assets/projects/meteormate/mm_carousel.png",
            alt: "MeteorMate main carousel view",
            cover: true,
          },
        ],
      },
      {
        eyebrow: "deployment + reliability",
        title: "shipping reliably across environments.",
        body: "A big part of the work was making the service reliably boot and route in the environments the team actually used. I drove fixes around serverless-style entrypoints, routing behavior, and local parity so the backend could run predictably instead of only working on one person’s machine.",
        points: [
          "Drove deployment strategy for local + Vercel-style workflows",
          "Fixed routing and entrypoint issues blocking backend startup",
          "Improved reliability expectations for a multi-contributor ACM project",
        ],
        media: [
          {
            label: "on-campus",
            src: "/assets/projects/meteormate/mm_oncampus.png",
            alt: "MeteorMate on-campus housing view",
          },
          {
            label: "off-campus",
            src: "/assets/projects/meteormate/mm_offcampus.png",
            alt: "MeteorMate off-campus housing view",
          },
        ],
      },
    ],
    tintHsl: { h: 18, s: 78, l: 56 },
    enabled: true,
  },
  {
    id: "nimby",
    index: "03.",
    name: "NIMBY",
    tagline:
      "a 2D survivor roguelike about a druid fighting capital encroachment.",
    body: "created for my Introduction to Video Game Programming course, NIMBY is a game where a magical druid defends the forest from corporate creatures: lumberjacks, construction foremen, contractors, and the CEO. four forms (druid, fox, bear, frog) with distinct ability kits shaped to counter a specific boss archetype, plus a roguelike loop of mutations and pawn-shop items between rooms. every sprite was hand-drawn by the team, and the original soundtrack was composed by yours truly.",
    role: "team of 4",
    stack: ["Godot", "GDScript", "Game Design", "Audio", "Music Composition"],
    href: undefined,
    hrefLabel: "open source",
    githubHref: "https://github.com/ryanpolasky/NIMBY",
    logoSrc: "/assets/projects/nimby/nim_logo.png",
    width: "wide",
    media: { kind: "none" },
    sections: [
      {
        eyebrow: "design",
        title: "rock-paper-scissors-druid.",
        body: 'four forms, each shaped to counter a specific boss archetype. fox bleed whittles the brute, bear smashes through armor, frog zones the bullet-hell phase, druid handles everything in between. swapping mid-fight builds a combo multiplier, so the meta-loop is "stay alive long enough to learn the matchup" rather than "pick a main and grind."',
        points: [
          "Druid: nature bolt, vine snare, gust",
          "Fox: slash, bite, howl buff, dash",
          "Bear: heavy slash, bulldoze charge, tectonic slam",
          "Frog: poison spit, poison cloud, tongue grab",
        ],
        layout: "forms",
        media: [
          {
            label: "druid walk cycle",
            src: "/assets/projects/nimby/nim_druid_walk.png",
            alt: "NIMBY druid form walk-cycle spritesheet",
          },
          {
            label: "fox walk cycle",
            src: "/assets/projects/nimby/nim_fox_walk.png",
            alt: "NIMBY fox form walk-cycle spritesheet",
          },
          {
            label: "bear walk cycle",
            src: "/assets/projects/nimby/nim_bear_walk.png",
            alt: "NIMBY bear form walk-cycle spritesheet",
          },
          {
            label: "frog walk cycle",
            src: "/assets/projects/nimby/nim_frog_walk.png",
            alt: "NIMBY frog form walk-cycle spritesheet",
          },
        ],
      },
      {
        eyebrow: "encounters",
        title: "four bosses, four mechanic flexes.",
        body: "each boss is a different system stress-test. the lumberjack drops trees that permanently rewrite the navmesh. the foreman pours liquid concrete that hardens into area-denial. the contractor wraps himself in vehicle armor. the CEO shrinks the arena by paving it over while you fight him - lose ground, lose footing.",
        points: [
          "Lumberjack: dynamic obstacles + real-time navmesh rebuild",
          "Foreman: state-based terrain (liquid → solid concrete)",
          "Contractor: armored vehicle plating requiring bear smash",
          "CEO: shrinking-arena bullet hell on a timer",
        ],
        media: [
          {
            label: "gameplay",
            src: "/assets/projects/nimby/nim_game.png",
            alt: "NIMBY gameplay screenshot",
          },
          { label: "forms parade", march: true },
        ],
      },
    ],
    tintHsl: { h: 132, s: 50, l: 50 },
    enabled: true,
  },
  {
    id: "rycord",
    index: "04.",
    name: "rycord",
    tagline: "a cache-first 3d record room built from my discogs collection.",
    body: "in rycord, a kallax-style shelf sits in a cozy bedroom scene, populated by the actual albums in my record collection. each record pulls out of its slot, flips to the back jacket, and shows the tracklist + description in an info panel. APIs only get hit on first grab, then every reload reads from the cache on local disk.",
    role: "solo",
    stack: [
      "Next.js",
      "React Three Fiber",
      "Three.js",
      "Postprocessing",
      "Discogs API",
      "Sharp",
      "Docker",
    ],
    href: undefined,
    hrefLabel: "open source",
    githubHref: "https://github.com/ryanpolasky/rycord",
    width: "wide",
    media: {
      kind: "image",
      items: [
        {
          label: "side angle",
          src: "/assets/projects/rycord/ryc_side.png",
          alt: "rycord side angle showing shelf depth",
          cover: true,
        },
      ],
    },
    sections: [
      {
        eyebrow: "the room",
        title: "kallax shelf, cozy room, real covers.",
        body: 'the centerpiece is a procedural 3D shelf filled with the actual albums i own. each record is interactive: pull it out of the slot, flip to the back jacket, see the tracklist and the description load into an info panel. a turntable holds whatever record is currently "active" at the center of the shelf. roomdressing fills the rest - plant, mug, book stack, wall art, a paper note from me on the floor.',
        points: [
          "Procedural Kallax grid, density-configurable via env",
          "Per-record front + back jacket with real Discogs cover art",
          "Centerpiece turntable holds the active selection",
          "RGB wall strip controlled by an in-scene remote model",
        ],
        layout: "banner",
        media: [
          {
            label: "the room",
            src: "/assets/projects/rycord/ryc_main.png",
            alt: "rycord main scene view",
          },
          {
            label: "pulled vinyl",
            src: "/assets/projects/rycord/ryc_vinyl.png",
            alt: "rycord vinyl pulled out of the shelf showing back jacket",
            cover: true,
          },
        ],
      },
    ],
    tintHsl: { h: 280, s: 55, l: 58 },
    enabled: true,
  },
  {
    id: "apple-triage",
    index: "05.",
    name: "LLM Test Triage",
    tagline:
      "end-to-end triage pipeline for 1000+ camera tests: parse, group, classify, file.",
    body: "every cycle ran 1000+ on-device camera tests; manual triage was the bottleneck. architected an end-to-end pipeline (xml log parsing, intelligent failure grouping, gemini-backed root cause analysis with 75% dedup accuracy, and a multi-threaded bug report writer serving 50+ engineers), collapsing manual triage time by 4,800%. shipped during the 2025 cupertino internship.",
    role: "apple camera intern",
    stack: ["Python", "Jenkins", "Gemini", "LLMs"],
    href: undefined,
    hrefLabel: "private",
    width: "xl",
    media: { kind: "none" },
    sections: [
      {
        eyebrow: "pipeline architecture",
        title: "parse, group, classify. at scale.",
        body: "every cycle the camera org ran 1000+ on-device tests, and manual triage of the failures was the slowest part of the loop. the pipeline ingests raw xml results, parses failure signatures, groups related failures so similar problems collapse into a single investigation, and feeds each cluster into an LLM for root cause analysis before anything reaches a human.",
        points: [
          "Processes 1000+ camera test results per cycle",
          "Automated XML parsing extracts failure signatures",
          "Intelligent grouping clusters related failures before analysis",
          "LLM-powered root cause analysis per cluster",
        ],
      },
      {
        eyebrow: "gemini deduplication",
        title: "75% dedup accuracy, 48× faster triage.",
        body: "integrated Gemini for bug deduplication and root-cause hypothesis surfacing. 75% accuracy on duplicate identification meant new failures could be matched against the existing radar history before a fresh ticket got filed, eliminating redundant radars and speeding the end-to-end triage workflow by 4,800%.",
        points: [
          "75% accuracy on duplicate identification",
          "Prevents redundant radar filings across cycles",
          "4,800% speedup vs prior manual triage flow",
          "Root-cause hypotheses surfaced alongside each dedup match",
        ],
      },
      {
        eyebrow: "bug report automation",
        title: "multi-threaded, retry-safe, attachment-aware.",
        body: "the back half of the pipeline writes bug reports automatically. multi-threaded creation with exponential-backoff retry handles transient radar failures, database-backed regression analysis ties new failures to known historical patterns, and logs + failure context attach themselves to each report. ran daily for 50+ engineers across the camera org.",
        points: [
          "Multi-threaded bug creation with exponential backoff retry",
          "Database regression analysis links failures to historical patterns",
          "Automated log + attachment handling per report",
          "Daily workflow for 50+ camera engineers",
        ],
      },
    ],
    tintHsl: { h: 285, s: 60, l: 70 },
    enabled: true,
  },
  {
    id: "apple-nlsql",
    index: "06.",
    name: "NL → SQL / NoSQL",
    tagline: "natural-language query interface for internal data stores.",
    body: "engineers ask in plain english; the planner generates schema-aware queries against postgres and nosql backends. also migrated the surrounding service from java 11 → jdk 21 and designed its aws/gcp ci/cd workflow. 2024 cupertino internship on the developer tools team.",
    role: "apple WTE intern",
    stack: ["Python", "FastAPI", "Postgres"],
    href: undefined,
    hrefLabel: "private",
    width: "wide",
    media: { kind: "none" },
    tintHsl: { h: 4, s: 75, l: 60 },
    enabled: true,
  },
  {
    id: "readme-ryvamper",
    index: "07.",
    name: "RyMe.md",
    tagline: "browser-only generator for animated github readme banners.",
    body: "static READMEs are tired and the existing stats-card generators all converge on the same look. RyMe.md is the workspace for designing animated profile banners across five template families, each rendered and exported entirely in-tab. SVG templates bake CSS @keyframes so banners animate without javascript and play in github's markdown renderer. zero server, zero signup - one file out, drop into your username/username repo, done.",
    role: "solo",
    stack: [
      "Vite",
      "React",
      "TypeScript",
      "Tailwind CSS",
      "SVG",
      "Canvas",
      "Cloudflare Pages",
    ],
    href: "https://ryme.md",
    hrefLabel: "visit →",
    githubHref: "https://github.com/ryanpolasky/ryme.md",
    width: "wide",
    media: { kind: "none" },
    sections: [
      {
        eyebrow: "output",
        title: "live templates, rendered in your browser.",
        body: "every tile below is an actual SVG generated by RyMe.md - the same files you'd drop into a github profile. CSS @keyframes are baked into each SVG, so they animate without javascript and survive github's markdown renderer. swap any cell for a fresh export and the gallery updates.",
        layout: "gallery",
        media: [
          {
            label: "glass · banner",
            src: "/assets/projects/readme-ryvamper/ryme_1.svg",
            alt: "RyMe.md glass-family banner output",
          },
          {
            label: "sleek · header",
            src: "/assets/projects/readme-ryvamper/ryme_2.svg",
            alt: "RyMe.md sleek-family header output",
          },
          {
            label: "terminal · boot",
            src: "/assets/projects/readme-ryvamper/ryme_3.svg",
            alt: "RyMe.md terminal-family boot sequence output",
          },
          {
            label: "code · readme",
            src: "/assets/projects/readme-ryvamper/ryme_4.svg",
            alt: "RyMe.md code-family README.md output",
          },
          {
            label: "neon · header",
            src: "/assets/projects/readme-ryvamper/ryme_5.svg",
            alt: "RyMe.md neon-family synthwave header output",
          },
          {
            label: "wave · footer",
            src: "/assets/projects/readme-ryvamper/ryme_6.svg",
            alt: "RyMe.md sine-wave footer output",
          },
        ],
      },
    ],
    tintHsl: { h: 330, s: 70, l: 60 },
    enabled: true,
  },
  // gallery / "15 versions" project temporarily commented out while we
  // trim the variant set down. when ready to re-add, uncomment and
  // bump index to whatever slot is appropriate for the new order.
  /*
  {
    id: 'gallery',
    index: '08.',
    name: '15 versions',
    tagline: 'this is the fifteenth. the other fourteen still live.',
    body: 'every redesign since 2019 lives at /gallery as a working iframe. observability dashboard, geocities, risograph, grimoire, no-css, gamebro, ryanwiki. graveyard you can browse.',
    role: 'solo',
    stack: ['HTML', 'CSS', 'archaeology'],
    href: '/gallery',
    hrefLabel: 'enter the archive →',
    width: 'wide',
    media: { kind: 'none' },
    tintHsl: { h: 200, s: 60, l: 58 },
    enabled: true,
  },
  */
];

export function getEnabledProjects(): Project[] {
  return PROJECTS.filter((p) => p.enabled);
}
