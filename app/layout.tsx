import type { Metadata, Viewport } from "next";
import { inter, jetbrainsMono, fraunces } from "@/lib/fonts";
import { AccentProvider } from "@/components/AccentProvider";
import { SmoothScrollProvider } from "@/components/SmoothScrollProvider";
import { Nav } from "@/components/Nav";
import "./globals.css";

const SITE_URL = "https://ryanpolasky.com";
const OG_IMAGE = `${SITE_URL}/assets/images/site-preview.png`;
const OG_IMAGE_ALT =
  "ryan.polasky / runtime — terminal-style status page for Ryan Polasky's personal site";
const SHORT_DESCRIPTION =
  "Junior Software Engineer specializing in backend systems, AI/LLM tooling, and developer productivity. UT Dallas '26. Open May 2026.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title:
    "Ryan Polasky - Software Engineer · 2× Apple Intern · UT Dallas '26",
  description:
    "Ryan Polasky - Junior Software Engineer. Backend systems, AI/LLM tooling, developer productivity. UT Dallas '26. 2× Apple intern. Open May 2026.",
  keywords: [
    "Ryan Polasky",
    "ryan polasky",
    "software engineer",
    "backend developer",
    "AI engineer",
    "LLM tooling",
    "Apple intern",
    "UT Dallas",
    "computer science",
    "devops",
    "python",
    "typescript",
  ],
  applicationName: "Ryan Polasky",
  authors: [{ name: "Ryan Polasky", url: SITE_URL }],
  creator: "Ryan Polasky",
  publisher: "Ryan Polasky",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "profile",
    siteName: "Ryan Polasky",
    locale: "en_US",
    url: SITE_URL,
    title: "Ryan Polasky - Software Engineer · 2× Apple Intern",
    description: SHORT_DESCRIPTION,
    firstName: "Ryan",
    lastName: "Polasky",
    username: "ryanpolasky",
    images: [{ url: OG_IMAGE, alt: OG_IMAGE_ALT }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ryan Polasky - Software Engineer · 2× Apple Intern",
    description: SHORT_DESCRIPTION,
    images: [{ url: OG_IMAGE, alt: OG_IMAGE_ALT }],
  },
  appleWebApp: {
    capable: true,
    title: "Ryan Polasky",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#EEEEEF",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

// schema.org graph mirrored from original.html so search/social crawlers
// indexing either entrypoint get the same structured data.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": `${SITE_URL}/#person`,
      name: "Ryan Polasky",
      givenName: "Ryan",
      familyName: "Polasky",
      alternateName: "ryan.polasky",
      url: `${SITE_URL}/`,
      image: `${SITE_URL}/assets/images/my-avatar.png`,
      email: "mailto:ryanpolasky@hotmail.com",
      jobTitle: "Software Engineer",
      description:
        "Junior Software Engineer specializing in backend systems, AI/LLM tooling, test automation, and developer productivity. UT Dallas '26 graduate and 2× Apple intern.",
      address: {
        "@type": "PostalAddress",
        addressRegion: "ND",
        addressCountry: "US",
      },
      alumniOf: {
        "@type": "CollegeOrUniversity",
        name: "The University of Texas at Dallas",
        url: "https://www.utdallas.edu/",
        sameAs: "https://en.wikipedia.org/wiki/University_of_Texas_at_Dallas",
      },
      knowsAbout: [
        "Software Engineering",
        "Backend Development",
        "Artificial Intelligence",
        "Large Language Models",
        "Developer Tooling",
        "DevOps",
        "Test Automation",
        "CI/CD",
        "Python",
        "TypeScript",
        "Cloud Infrastructure",
      ],
      sameAs: [
        "https://www.linkedin.com/in/ryan-polasky/",
        "https://github.com/ryanpolasky",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: "Ryan Polasky",
      alternateName: "ryan.polasky / runtime",
      description:
        "Personal site of Ryan Polasky — Junior Software Engineer specializing in backend systems, AI/LLM tooling, and developer productivity.",
      inLanguage: "en",
      publisher: { "@id": `${SITE_URL}/#person` },
      author: { "@id": `${SITE_URL}/#person` },
      copyrightHolder: { "@id": `${SITE_URL}/#person` },
    },
    {
      "@type": "ProfilePage",
      "@id": `${SITE_URL}/#profile`,
      url: `${SITE_URL}/`,
      name: "Ryan Polasky - Software Engineer",
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#person` },
      mainEntity: { "@id": `${SITE_URL}/#person` },
      primaryImageOfPage: `${SITE_URL}/assets/images/my-avatar.png`,
    },
    {
      "@type": "VideoGame",
      "@id": "https://crashdle.com/#game",
      name: "Crashdle",
      url: "https://crashdle.com/",
      description:
        "Daily 5-letter word puzzle paired with a live crash multiplier bonus round. Solve the word in six guesses, then optionally risk your winnings on a real-time crash game.",
      image: "https://crashdle.com/og.webp",
      genre: ["Word Game", "Puzzle", "Casual"],
      playMode: "SinglePlayer",
      gamePlatform: "Web Browser",
      applicationCategory: "GameApplication",
      operatingSystem: "Any",
      inLanguage: "en",
      creator: { "@id": `${SITE_URL}/#person` },
      author: { "@id": `${SITE_URL}/#person` },
      publisher: { "@id": `${SITE_URL}/#person` },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      },
    },
    {
      "@type": "WebApplication",
      "@id": "https://ryplay.dev/#app",
      name: "ryplay",
      alternateName: "ryplay - Your Music, Visualized",
      url: "https://ryplay.dev/",
      description:
        "A real-time music dashboard powered by Last.fm. Visualize your listening habits, track streaks, and share your music taste.",
      image: "https://ryplay.dev/og.webp",
      applicationCategory: "MultimediaApplication",
      applicationSubCategory: "Music Visualization",
      operatingSystem: "Any",
      inLanguage: "en",
      creator: { "@id": `${SITE_URL}/#person` },
      author: { "@id": `${SITE_URL}/#person` },
      publisher: { "@id": `${SITE_URL}/#person` },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      },
    },
    {
      "@type": "WebApplication",
      "@id": "https://ryme.md/#app",
      name: "RyMe.md",
      alternateName: "readme-ryvamper",
      url: "https://ryme.md/",
      description:
        "A browser-based generator for animated GitHub profile README banners. Pick a template, fill in your info, and export as SVG or GIF — entirely client-side.",
      image: "https://ryme.md/og.webp",
      applicationCategory: "DeveloperApplication",
      applicationSubCategory: "Profile README Generator",
      operatingSystem: "Any",
      inLanguage: "en",
      creator: { "@id": `${SITE_URL}/#person` },
      author: { "@id": `${SITE_URL}/#person` },
      publisher: { "@id": `${SITE_URL}/#person` },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      },
    },
    {
      "@type": "WebApplication",
      "@id": "https://rycord.dev/#app",
      name: "rycord",
      alternateName: "rycord - 3D Record Room",
      url: "https://rycord.dev/",
      description:
        "A cache-first 3D record room built from a personal Discogs collection. Pull records off a Kallax-style shelf, flip the jackets, and browse tracklists in a cozy bedroom scene.",
      image: "https://rycord.dev/og.webp",
      applicationCategory: "MultimediaApplication",
      applicationSubCategory: "Record Collection Visualizer",
      operatingSystem: "Any",
      inLanguage: "en",
      creator: { "@id": `${SITE_URL}/#person` },
      author: { "@id": `${SITE_URL}/#person` },
      publisher: { "@id": `${SITE_URL}/#person` },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      },
    },
    {
      "@type": "WebApplication",
      "@id": "https://status.ryanpolasky.com/#app",
      name: "WRLT",
      alternateName: "What's Ryan Up To?",
      url: "https://status.ryanpolasky.com/",
      description:
        "A live personal dashboard with mini-games, an in-app economy, and a desktop-style UI in the browser.",
      image: "https://status.ryanpolasky.com/og.webp",
      applicationCategory: "LifestyleApplication",
      applicationSubCategory: "Personal Dashboard",
      operatingSystem: "Any",
      inLanguage: "en",
      creator: { "@id": `${SITE_URL}/#person` },
      author: { "@id": `${SITE_URL}/#person` },
      publisher: { "@id": `${SITE_URL}/#person` },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      },
    },
  ],
};

// root layout wires global fonts, smooth scrolling, nav, and temporary mobile fallback.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${fraunces.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var A=[{n:'cobalt',b:'#2D2BC8',w:'#4A48E4',s:'#C5C4F2'},{n:'ember',b:'#FF5A36',w:'#FF7A56',s:'#FCD0BE'},{n:'plasma',b:'#D6189E',w:'#F23BB7',s:'#F8C5E5'},{n:'iris',b:'#7A2DEE',w:'#9054F6',s:'#DCC9FA'},{n:'monstera',b:'#0FA968',w:'#23C781',s:'#BBE9D2'},{n:'pollen',b:'#E0A60E',w:'#F2BD33',s:'#F4E2A6'},{n:'lagoon',b:'#1E7A8E',w:'#2C9AB0',s:'#B6D9E1'}];var i=Math.floor(Math.random()*A.length);var a=A[i];window.__bootAccentIndex=i;var r=document.documentElement;r.style.setProperty('--color-accent',a.b);r.style.setProperty('--color-accent-warm',a.w);r.style.setProperty('--color-accent-soft',a.s);r.setAttribute('data-accent',a.n);var h=location.hash;var L={about:'about',experience:'experience',projects:'projects',contact:'contact',hero:'ryan',main:'ryan'};var label='ryan';if(h&&h!=='#'){var key=h.slice(1).toLowerCase();label=L[key]||h.slice(1);window.__bootHash=h;history.replaceState(null,'',location.pathname+location.search);}var d=document.createElement('div');d.id='__boot-curtain';d.style.cssText='position:fixed;inset:0;background:'+a.b+';z-index:250;transform:translate3d(0,0,0);transition:transform 620ms cubic-bezier(0.83,0,0.17,1);will-change:transform;display:flex;align-items:center;justify-content:center;overflow:hidden';var s=document.createElement('span');s.textContent=label;s.style.cssText="font-family:var(--font-display),'Times New Roman',serif;font-style:italic;font-weight:400;font-size:clamp(3.5rem,12vw,10rem);line-height:1;letter-spacing:-0.02em;color:#fff;font-variation-settings:'opsz' 144,'SOFT' 80,'WONK' 1;opacity:0;transition:opacity 360ms ease 80ms";d.appendChild(s);(document.body||document.documentElement).appendChild(d);requestAnimationFrame(function(){s.style.opacity='1';});}catch(e){}})();`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body className="grain" suppressHydrationWarning>
        <AccentProvider>
          <SmoothScrollProvider>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded focus:bg-[var(--color-text)] focus:px-3 focus:py-2 focus:text-[var(--color-bg)]"
            >
              skip to content
            </a>
            <Nav />
            {children}
          </SmoothScrollProvider>
        </AccentProvider>
      </body>
    </html>
  );
}
