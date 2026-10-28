import { Cursor } from "@/components/Cursor";
import { StudioHero } from "@/components/StudioHero";
import { StudioAbout } from "@/components/StudioAbout";
import { SelectedWork } from "@/components/SelectedWork";
import { StudioContact } from "@/components/StudioContact";
import { StudioReveals } from "@/components/StudioReveals";
import "./studio.css";

export default function HomePage() {
  return (
    <main id="main" className="atelier">
      <Cursor />
      <StudioReveals />
      <StudioHero />
      <SelectedWork />
      <StudioAbout />
      <StudioContact />
    </main>
  );
}
