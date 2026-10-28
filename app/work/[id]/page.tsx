import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PROJECTS } from "@/lib/projects";
import { ProjectCaseStudy } from "@/components/ProjectCaseStudy";
import "../case-study.css";

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
  if (!project?.enabled) notFound();

  return <ProjectCaseStudy project={project} />;
}
