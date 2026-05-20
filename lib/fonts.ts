import { Inter, JetBrains_Mono, Fraunces } from "next/font/google";

// v9 typography: inter for ui/body, fraunces for display (variable, supports
// opsz + SOFT for high-contrast editorial italics), jetbrains mono for the
// small eyebrow / numeric labels.

export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const fraunces = Fraunces({
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  axes: ["SOFT", "opsz", "WONK"],
  variable: "--font-fraunces",
  display: "swap",
});
