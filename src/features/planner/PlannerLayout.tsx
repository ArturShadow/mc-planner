import { useState } from "react";
import type { ProjectModel } from "../../models/project.model";
import { BasePlanningView } from "../base/BasePlanningView";
import { ProcessView } from "../processes/ProcessView";
import { CatalogView } from "../catalog/CatalogView";

type PlannerTab = "base" | "processes" | "catalog";
interface ProcessNavigationRequest { processId: number | null; nonce: number }

interface PlannerLayoutProps {
  project: ProjectModel;
  onCloseProject: () => void;
  onProjectBaseSizeChange?: (widthChunks: number, heightChunks: number) => void;
}

const tabs: Array<{ id: PlannerTab; label: string; symbol: string }> = [
  { id: "base", label: "Base", symbol: "▦" },
  { id: "processes", label: "Processes", symbol: "⇄" },
  { id: "catalog", label: "Catalog", symbol: "⬡" },
];

export function PlannerLayout({ project, onCloseProject, onProjectBaseSizeChange }: PlannerLayoutProps) {
  const [activeTab, setActiveTab] = useState<PlannerTab>("base");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [processNavigation, setProcessNavigation] = useState<ProcessNavigationRequest | null>(null);

  function openProcess(processId: number | null): void {
    setProcessNavigation({ processId, nonce: Date.now() });
    setActiveTab("processes");
  }

  return (
    <div className={`planner${isSidebarOpen ? "" : " planner--sidebar-collapsed"}`}>
      <aside className={`planner__sidebar${isSidebarOpen ? "" : " planner__sidebar--collapsed"}`}>
        <div className="planner__brand">
          <span className="planner__brand-mark" aria-hidden="true">◆</span>
          {isSidebarOpen && <span>MC Planner</span>}
          <button className="planner__sidebar-toggle" type="button" aria-label={isSidebarOpen ? "Collapse main menu" : "Expand main menu"} title={isSidebarOpen ? "Collapse main menu" : "Expand main menu"} onClick={() => setIsSidebarOpen((current) => !current)}>{isSidebarOpen ? "‹" : "›"}</button>
        </div>

        {isSidebarOpen && <div className="planner__project">
          <span className="planner__project-label">Current project</span>
          <strong>{project.name}</strong>
          <small>{project.baseWidthChunks} × {project.baseHeightChunks} chunks</small>
        </div>}

        <nav className="planner__nav" aria-label="Planner sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`planner__nav-item${activeTab === tab.id ? " planner__nav-item--active" : ""}`}
              type="button"
              aria-label={tab.label}
              aria-current={activeTab === tab.id ? "page" : undefined}
              onClick={() => { if (tab.id === "processes") setProcessNavigation(null); setActiveTab(tab.id); }}
            >
              <span aria-hidden="true">{tab.symbol}</span>
              {isSidebarOpen && tab.label}
            </button>
          ))}
        </nav>

        <button className="planner__back" type="button" title="All projects" aria-label="All projects" onClick={onCloseProject}>←{isSidebarOpen && " All projects"}</button>
      </aside>

      <main className="planner__main">
        <header className="planner__header">
          <div>
            <p className="planner__eyebrow">Workspace</p>
            <h1>{tabs.find((tab) => tab.id === activeTab)?.label}</h1>
          </div>
          <span className="planner__status">Local draft</span>
        </header>

        {activeTab === "base" ? <BasePlanningView project={project} onProjectBaseSizeChange={onProjectBaseSizeChange} onOpenProcess={openProcess} /> : activeTab === "processes" ? <ProcessView project={project} navigationRequest={processNavigation} /> : <CatalogView project={project} />}
      </main>
    </div>
  );
}
