// Visual variant manifest. Each entry is a self-contained HTML file loaded
// into an iframe by the gallery picker. Order = picker order.
export type Variant = {
  key: string;
  name: string;
  title: string;
  src: string;
};

export const VARIANTS: Variant[] = [
  {
    key: "original",
    name: "The Original",
    title: "The Original",
    src: "/variants/original.html",
  },
  {
    key: "observability",
    name: "Observability",
    title: "Observability: systems dashboard",
    src: "/variants/observability.html",
  },
  {
    key: "geocities",
    name: "Homepage '04",
    title: "Homepage '04: Geocities-era",
    src: "/variants/geocities.html",
  },
  {
    key: "risograph",
    name: "Risograph",
    title: "Risograph: 2-color print zine",
    src: "/variants/risograph.html",
  },
  {
    key: "grimoire",
    name: "Grimoire",
    title: "Grimoire: dark medieval pixel RPG",
    src: "/variants/grimoire.html",
  },
  {
    key: "acid",
    name: "Acid",
    title: "Acid: neo-Y2K dark graphics",
    src: "/variants/acid.html",
  },
  {
    key: "no-css",
    name: "No CSS",
    title: "No CSS: unstyled HTML",
    src: "/variants/no-css.html",
  },
  {
    key: "gamebro",
    name: "Gamebro",
    title: "Gamebro: portable cartridge",
    src: "/variants/gamebro.html",
  },
  {
    key: "liminal",
    name: "Liminal",
    title: "Liminal: empty transitional space",
    src: "/variants/liminal.html",
  },
  {
    key: "ryanwiki",
    name: "RyanWiki",
    title: "RyanWiki: Encyclopedia article",
    src: "/variants/wikipedia.html",
  },
];

export const VARIANT_BY_KEY: Record<string, Variant> = Object.fromEntries(
  VARIANTS.map((v) => [v.key, v]),
);
