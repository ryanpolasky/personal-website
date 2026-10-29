import Link from "next/link";
import { ROLES } from "@/lib/profile";

export function StudioAbout() {
  return (
    <section id="about" className="studio-about" aria-labelledby="about-title">
      <div className="section-label"><span>02 / a little context</span><span>ut dallas ’26 → cupertino</span></div>
      <div className="about-statement" data-nav-anchor="about">
        <h2 id="about-title" className="oversize-heading" data-reveal>a little<br /><span>about me.</span></h2>
      </div>
      <div className="about-body" data-reveal>
        <p>i’m a computer science graduate from ut dallas (’26), now a software engineer on apple’s camera &amp; edits team. before going full-time i spent two summers there as an intern, building ai tooling for the wireless tech (WTE) &amp; camera &amp; edits orgs.</p>
        <p>i enjoy backend, devops, and making llms actually do what you want them to do. i also have a bad habit of rebuilding this website. the <Link href="/gallery/">older ones are still around ↗</Link> if you want to see them.</p>
      </div>
      <div className="about-disciplines"><span>backend systems</span><span>ai / llm tooling</span><span>interactive experiences</span><span>developer productivity</span></div>
      <section id="experience" className="studio-experience" aria-labelledby="experience-title">
        <div className="section-label"><span>03 / along the way</span><span>the short version</span></div>
        <h3 id="experience-title" className="experience-heading" data-reveal>where i’ve worked.</h3>
        <div className="experience-rows">{ROLES.map((role) => <article key={`${role.company}-${role.title}`} data-reveal><span className="experience-when">{role.when}</span><div><h4>{role.company} <span>— {role.title}</span></h4><p>{role.body}</p></div><span className="experience-detail">{role.metric.value}<br />{role.metric.label}</span></article>)}</div>
      </section>
    </section>
  );
}
