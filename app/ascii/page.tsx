import type { Metadata, Viewport } from "next";
import { AsciiGallery } from "@/components/ascii/AsciiGallery";

export const metadata: Metadata = {
  title: "ASCII Rooms · Ryan Polasky",
  description:
    "A tiny gallery of full-screen ASCII places. First room: snow outside, fire inside, cat asleep.",
  alternates: {
    canonical: "https://ryanpolasky.com/ascii/",
  },
  openGraph: {
    type: "website",
    url: "https://ryanpolasky.com/ascii/",
    title: "ASCII Rooms",
    description:
      "Full-screen ASCII places for disappearing into for a little while.",
  },
  twitter: {
    card: "summary",
    title: "ASCII Rooms",
    description:
      "Full-screen ASCII places for disappearing into for a little while.",
  },
};

export const viewport: Viewport = {
  themeColor: "#080b10",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function AsciiPage() {
  return <AsciiGallery />;
}
