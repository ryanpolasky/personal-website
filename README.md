# ryan polasky · personal site

Next.js 15 + react-three-fiber + Tailwind v4. Static-exported, deployed to Cloudflare Pages.

## architecture

- `app/`: Next.js App Router pages.
  - `app/page.tsx`: landing (lazy r3f hero, scroll content, footer "door" to the gallery).
  - `app/gallery/page.tsx`: easter-egg picker for the 14 design variants. Served via iframes from `/public/variants/*.html`.
  - `app/not-found.tsx`: 404.
- `components/`: Hero canvas, smooth scroll, custom cursor, magnetic button, gallery state machine.
- `lib/`: fonts + the canonical 14-variant manifest.
- `public/variants/*.html`: fully self-contained HTML variants. **Do not port to React**; they're intentionally weird and stay weird.
- `public/assets/`, `public/photography.html`, `public/spotify.html`, favicons, etc.: static assets carried over from the old site.

## scripts

```bash
npm install
npm run dev        # next dev (defaults to :3000)
npm run build      # static export → out/
npm run lint
npm run typecheck
```

## deploy

`next.config.mjs` is set to `output: 'export'` so `npm run build` writes a static `out/` directory. Cloudflare Pages serves that directory; `_headers` and `_redirects` live in `public/` and are copied through.

## variant gallery

- Discoverable from the about section ("...older ones are stil around") or directly at `/gallery`.
- Returning visitors are locked into their saved choice; the cog button re-opens the picker.
- Force the picker open with `/gallery?gallery=1`.
- Each variant is a static HTML file. Treat them as a museum, not a codebase; edit only when fixing absolute asset paths.

## history note

_Note: The git history of this repository was squashed and rewritten during the V2 redesign to start fresh and remove old template/fork history. The original V1 site and its various iterations over the years are preserved as interactive snapshots in the `public/variants` directory._

## credits

- The oil-film ripple effect in the hero (`components/OilFilmRipple.tsx`) is a Canvas2D port of techniques from Pavel Dobryakov's [WebGL-Fluid-Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation) (MIT). The original is a full GPU fluid sim with pressure projection; this site uses a lighter CPU version inspired by its splatting, advection, and vorticity-confinement approach.

## attribution

This site is open-source under the MIT license. Feel free to use it as inspiration, learn from it, fork it, remix it, or deploy your own version.

That said, this site wasn't built as a generic portfolio template; it's my personal website and a project I've spent an unreasonable amount of time obsessing over. If you use it as a starting point, I'd appreciate attribution by keeping the GitHub fork relationship intact or linking back to the original repository somewhere in your project. Not required, just appreciated. :)
