import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PROJECTS } from "@/lib/projects";
import { ProjectFullView, projectTint } from "@/components/ProjectFullView";

// standalone /work/[id] page for direct visits; modal route handles card clicks.

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  return PROJECTS.filter((p) => p.enabled).map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const project = PROJECTS.find((p) => p.id === id);
  if (!project) return { title: "Project not found · Ryan Polasky" };
  return {
    title: `${project.name} · Ryan Polasky`,
    description: project.tagline,
  };
}

export default async function ProjectStandalonePage({ params }: PageProps) {
  const { id } = await params;
  const project = PROJECTS.find((p) => p.id === id);
  if (!project) notFound();

  return (
    <main className="min-h-[100svh] bg-[var(--color-bg)] p-4 sm:p-6">
      <div
        data-stage="dark"
        className="stage relative h-[calc(100svh-32px)] w-full overflow-hidden"
        style={{ borderRadius: "28px", minHeight: "600px" }}
      >
        {/* back link to home */}
        <Link
          href="/"
          className="absolute left-4 top-4 z-20 inline-flex items-center gap-2 rounded-full border border-[var(--color-line-invert-strong)] px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-[var(--color-text-invert)] transition-colors hover:border-[var(--color-accent-soft)] hover:text-[var(--color-accent-soft)] sm:left-6 sm:top-6"
          style={{ fontFamily: "var(--font-mono)" }}
          data-hoverable
        >
          ← back
        </Link>

        <ProjectFullView project={project} tintColor={projectTint(project)} />
      </div>
    </main>
  );
}
