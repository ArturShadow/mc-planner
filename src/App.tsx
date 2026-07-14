import { useEffect, useState } from "react";
import { PlannerLayout } from "./features/planner/PlannerLayout";
import { ProjectsView } from "./features/projects/ProjectsView";
import { createProject, listProjects } from "./features/projects/projects.repository";
import type { ProjectModel } from "./models/project.model";
import "./App.css";

type AppView = "projects" | "planner";

function App() {
  const [view, setView] = useState<AppView>("projects");
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [projects, setProjects] = useState<ProjectModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void loadProjects(); }, []);

  async function loadProjects(): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      setProjects(await listProjects());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load projects.");
    } finally {
      setIsLoading(false);
    }
  }

  function openProject(projectId: number): void {
    setActiveProjectId(projectId);
    setView("planner");
  }

  async function addProject(name: string): Promise<void> {
    const project = await createProject(name);
    setProjects((current) => [project, ...current]);
    openProject(project.id);
  }

  function closeProject(): void {
    setActiveProjectId(null);
    setView("projects");
  }

  const activeProject = projects.find((project) => project.id === activeProjectId);

  return view === "projects" || !activeProject ? (
    <ProjectsView projects={projects} isLoading={isLoading} error={error} onCreateProject={addProject} onOpenProject={openProject} onRetry={() => void loadProjects()} />
  ) : (
    <PlannerLayout project={activeProject} onCloseProject={closeProject} />
  );
}

export default App;
