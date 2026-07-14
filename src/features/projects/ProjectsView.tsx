import { FormEvent, useState } from "react";
import type { ProjectModel } from "../../models/project.model";

interface ProjectsViewProps {
  projects: ProjectModel[];
  isLoading: boolean;
  error: string | null;
  onCreateProject: (name: string) => Promise<void>;
  onOpenProject: (projectId: number) => void;
  onRetry: () => void;
}

export function ProjectsView({ projects, isLoading, error, onCreateProject, onOpenProject, onRetry }: ProjectsViewProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function closeDialog(): void {
    if (isCreating) return;
    setIsDialogOpen(false);
    setProjectName("");
    setCreateError(null);
  }

  async function submitProject(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!projectName.trim()) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      await onCreateProject(projectName);
      setIsDialogOpen(false);
      setProjectName("");
    } catch (cause) {
      setCreateError(cause instanceof Error ? cause.message : "Could not create the project.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="projects-view">
      <header className="projects-view__header">
        <div><p className="projects-view__eyebrow">MC Planner</p><h1 className="projects-view__title">Projects</h1><p className="projects-view__subtitle">Plan your bases, production chains, and multiblock builds.</p></div>
        <button className="button button--primary" type="button" onClick={() => setIsDialogOpen(true)}>New project</button>
      </header>

      {isLoading ? <section className="projects-view__message" aria-live="polite">Loading projects…</section> : error ? (
        <section className="projects-view__message projects-view__message--error" role="alert"><p>{error}</p><button className="button button--secondary" type="button" onClick={onRetry}>Try again</button></section>
      ) : projects.length ? (
        <section className="projects-view__grid" aria-label="Projects">{projects.map((project) => (
          <button className="project-card" type="button" key={project.id} onClick={() => onOpenProject(project.id)}>
            <span className="project-card__icon" aria-hidden="true">◆</span><span className="project-card__body"><strong className="project-card__title">{project.name}</strong><span className="project-card__meta">{project.baseWidthChunks} × {project.baseHeightChunks} chunks</span></span><span className="project-card__arrow" aria-hidden="true">→</span>
          </button>
        ))}</section>
      ) : (
        <section className="projects-view__empty" aria-labelledby="empty-projects-title"><div className="projects-view__empty-icon" aria-hidden="true">◆</div><h2 id="empty-projects-title">Start your first plan</h2><p>Create a project to map out your Minecraft world.</p><button className="button button--primary" type="button" onClick={() => setIsDialogOpen(true)}>Create project</button></section>
      )}

      {isDialogOpen && <div className="dialog-backdrop" role="presentation" onMouseDown={closeDialog}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="create-project-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="dialog__header"><div><p className="dialog__eyebrow">New world plan</p><h2 id="create-project-title">Create project</h2></div><button className="dialog__close" type="button" onClick={closeDialog} aria-label="Close dialog">×</button></div>
        <form className="dialog__form" onSubmit={(event) => void submitProject(event)}><label className="field"><span className="field__label">Project name</span><input className="field__input" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="My survival world" autoFocus disabled={isCreating} /></label>
          {createError && <p className="dialog__error" role="alert">{createError}</p>}<div className="dialog__actions"><button className="button button--secondary" type="button" onClick={closeDialog} disabled={isCreating}>Cancel</button><button className="button button--primary" type="submit" disabled={!projectName.trim() || isCreating}>{isCreating ? "Creating…" : "Create project"}</button></div>
        </form>
      </section></div>}
    </main>
  );
}
