import { useState } from "react";
import type { ProjectModel } from "../../models/project.model";

type PlannerTab = "base" | "processes" | "multiblocks";

interface PlannerLayoutProps {
  project: ProjectModel;
  onCloseProject: () => void;
}

const tabs: Array<{ id: PlannerTab; label: string; symbol: string }> = [
  { id: "base", label: "Base", symbol: "▦" },
  { id: "processes", label: "Processes", symbol: "⇄" },
  { id: "multiblocks", label: "Multiblocks", symbol: "⬡" },
];

const emptyContent: Record<PlannerTab, { title: string; description: string }> = {
  base: { title: "Your base is ready to be planned", description: "Arrange chunks and reserve space for every part of your build." },
  processes: { title: "No processes yet", description: "Production chains and technical workflows will appear here." },
  multiblocks: { title: "No multiblocks yet", description: "Keep track of large structures and their material requirements." },
};

export function PlannerLayout({ project, onCloseProject }: PlannerLayoutProps) {
  const [activeTab, setActiveTab] = useState<PlannerTab>("base");
  const content = emptyContent[activeTab];

  return (
    <div className="planner">
      <aside className="planner__sidebar">
        <div className="planner__brand">
          <span className="planner__brand-mark" aria-hidden="true">◆</span>
          <span>MC Planner</span>
        </div>

        <div className="planner__project">
          <span className="planner__project-label">Current project</span>
          <strong>{project.name}</strong>
          <small>{project.baseWidthChunks} × {project.baseHeightChunks} chunks</small>
        </div>

        <nav className="planner__nav" aria-label="Planner sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`planner__nav-item${activeTab === tab.id ? " planner__nav-item--active" : ""}`}
              type="button"
              aria-current={activeTab === tab.id ? "page" : undefined}
              onClick={() => setActiveTab(tab.id)}
            >
              <span aria-hidden="true">{tab.symbol}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        <button className="planner__back" type="button" onClick={onCloseProject}>← All projects</button>
      </aside>

      <main className="planner__main">
        <header className="planner__header">
          <div>
            <p className="planner__eyebrow">Workspace</p>
            <h1>{tabs.find((tab) => tab.id === activeTab)?.label}</h1>
          </div>
          <span className="planner__status">Local draft</span>
        </header>

        <section className="planner__empty" aria-labelledby="planner-empty-title">
          <div className="planner__empty-grid" aria-hidden="true"><span>◆</span></div>
          <h2 id="planner-empty-title">{content.title}</h2>
          <p>{content.description}</p>
        </section>
      </main>
    </div>
  );
}
