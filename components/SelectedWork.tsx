import { getEnabledProjects, projectCover } from "@/lib/projects";
import { WorkExperience } from "@/components/WorkExperience";

export function SelectedWork() {
  const previews = getEnabledProjects().map((project) => {
    const src = project.showcase?.src ?? projectCover(project);
    return {
      id: project.id,
      name: project.name,
      palette: project.palette,
      tagline: project.tagline,
      image: src ? { src, alt: project.showcase?.alt ?? project.cover?.alt ?? project.name } : undefined,
    };
  });
  return <WorkExperience projects={previews} />;
}
