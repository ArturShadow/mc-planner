import { useState } from "react";
import "./App.css";

type AppView = 'projects' | 'planner'

function App() {
  const [view, setView] = useState<AppView>('projects');
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);

  function openProject(projectId: number): void {
    setActiveProjectId(projectId);
    setView('planner');
  }

  function closeProject(): void {
    setActiveProjectId(null);
    setView('projects');
  }

  return view === 'projects' ? (
    <ProjectsView onOpenProject={openProject} />
  ) : (
    <PlannerLayout
      projectId={activeProjectId!}
      onCloseProject={closeProject}
    />
  );
}

export default App;
