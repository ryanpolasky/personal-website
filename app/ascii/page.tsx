import type { Metadata, Viewport } from "next";
import { AsciiGallery } from "@/components/ascii/AsciiGallery";

export const metadata: Metadata = {
  title: "ASCII Atlas · Ryan Polasky",
  description:
    "A gallery of full-screen ASCII landscapes, cityscapes, nature, and living patterns.",
  alternates: {
    canonical: "https://ryanpolasky.com/ascii/",
  },
  openGraph: {
    type: "website",
    url: "https://ryanpolasky.com/ascii/",
    title: "ASCII Atlas",
    description:
      "Full-screen ASCII landscapes, cityscapes, nature, and living patterns.",
  },
  twitter: {
    card: "summary",
    title: "ASCII Atlas",
    description:
      "Full-screen ASCII landscapes, cityscapes, nature, and living patterns.",
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
