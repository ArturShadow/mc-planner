import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { createPortal } from "react-dom";
import type { BaseAssignmentModel } from "../../models/base.model";
import type { ProcessModel } from "../../models/process.model";
import type { ProjectModel } from "../../models/project.model";
import { listProcesses } from "../processes/processes.repository";
import { resizeProjectBase } from "../projects/projects.repository";
import { assignProcessArea, clearProcessAssignment, listBaseAssignments } from "./base.repository";

interface BasePlanningViewProps {
  project: ProjectModel;
  onProjectBaseSizeChange?: (widthChunks: number, heightChunks: number) => void;
  onOpenProcess?: (processId: number | null) => void;
}

const MAX_BASE_CHUNKS = 20;

export function BasePlanningView({ project, onProjectBaseSizeChange, onOpenProcess }: BasePlanningViewProps) {
  const [processes, setProcesses] = useState<ProcessModel[]>([]);
  const [assignments, setAssignments] = useState<BaseAssignmentModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [contextChunk, setContextChunk] = useState<{ x: number; y: number; cursorX: number; cursorY: number } | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => { void loadPlan(); }, [project.id]);
  useEffect(() => {
    if (!contextChunk) return;
    const closeContextMenu = (): void => setContextChunk(null);
    window.addEventListener("scroll", closeContextMenu, true);
    window.addEventListener("resize", closeContextMenu);
    return () => {
      window.removeEventListener("scroll", closeContextMenu, true);
      window.removeEventListener("resize", closeContextMenu);
    };
  }, [contextChunk]);

  async function loadPlan(): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const [loadedProcesses, loadedAssignments] = await Promise.all([
        listProcesses(project.id), listBaseAssignments(project.id),
      ]);
      setProcesses(loadedProcesses);
      setAssignments(loadedAssignments);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the base plan.");
    } finally { setIsLoading(false); }
  }

  const assignmentsByChunk = useMemo(() => new Map(assignments.map((item) => [`${item.chunkX}:${item.chunkY}`, item])), [assignments]);
  const processesById = useMemo(() => new Map(processes.map((process) => [process.id, process])), [processes]);
  const contextAssignment = contextChunk ? assignmentsByChunk.get(`${contextChunk.x}:${contextChunk.y}`) : undefined;
  const contextProcess = contextAssignment?.processId ? processesById.get(contextAssignment.processId) : undefined;
  const totalChunks = project.baseWidthChunks * project.baseHeightChunks;
  const lastColumnHasProcess = assignments.some((item) => item.chunkX === project.baseWidthChunks - 1 && item.processId !== null);
  const lastRowHasProcess = assignments.some((item) => item.chunkY === project.baseHeightChunks - 1 && item.processId !== null);

  async function resizeBase(axis: "width" | "height", delta: -1 | 1): Promise<void> {
    const nextWidth = project.baseWidthChunks + (axis === "width" ? delta : 0);
    const nextHeight = project.baseHeightChunks + (axis === "height" ? delta : 0);
    if (nextWidth < 1 || nextHeight < 1) return;
    if (nextWidth * nextHeight > MAX_BASE_CHUNKS || isResizing) return;
    setIsResizing(true);
    setError(null);
    try {
      await resizeProjectBase(project.id, nextWidth, nextHeight);
      onProjectBaseSizeChange?.(nextWidth, nextHeight);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not resize the base.");
    } finally { setIsResizing(false); }
  }

  async function assignProcess(process: ProcessModel, chunkX: number, chunkY: number): Promise<void> {
    const targetChunks = Array.from({ length: process.heightChunks }, (_, offsetY) =>
      Array.from({ length: process.widthChunks }, (_, offsetX) => ({ chunkX: chunkX + offsetX, chunkY: chunkY + offsetY })),
    ).flat();
    if (targetChunks.some((chunk) => chunk.chunkX >= project.baseWidthChunks || chunk.chunkY >= project.baseHeightChunks)) {
      setError(`${process.name} needs ${process.widthChunks} × ${process.heightChunks} chunks and does not fit there.`);
      return;
    }
    const targetKeys = new Set(targetChunks.map((chunk) => `${chunk.chunkX}:${chunk.chunkY}`));
    if (assignments.some((assignment) => targetKeys.has(`${assignment.chunkX}:${assignment.chunkY}`))) {
      setError("Clear the occupied chunks before assigning a process there.");
      return;
    }
    setIsAssigning(true); setError(null);
    try {
      const assignmentGroup = await assignProcessArea(project.id, process.id, targetChunks);
      setAssignments((current) => [...current, ...targetChunks.map((chunk) => ({ id: -1, projectId: project.id, processId: process.id, assignmentGroup, ...chunk }))]);
      setContextChunk(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not assign the process."); }
    finally { setIsAssigning(false); }
  }

  async function removeAssignment(chunkX: number, chunkY: number): Promise<void> {
    setIsAssigning(true); setError(null);
    try {
      const assignmentGroup = await clearProcessAssignment(project.id, chunkX, chunkY);
      setAssignments((current) => current.filter((assignment) => assignmentGroup
        ? assignment.assignmentGroup !== assignmentGroup
        : assignment.chunkX !== chunkX || assignment.chunkY !== chunkY));
      setContextChunk(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not clear the chunk."); }
    finally { setIsAssigning(false); }
  }

  function openContextMenu(event: MouseEvent<HTMLButtonElement>, x: number, y: number): void {
    const sameChunk = contextChunk?.x === x && contextChunk.y === y;
    setContextChunk(sameChunk ? null : { x, y, cursorX: event.clientX, cursorY: event.clientY });
  }

  if (isLoading) return <section className="base-plan__message" aria-live="polite">Loading base plan…</section>;
  if (error && !processes.length && !assignments.length) return <section className="base-plan__message base-plan__message--error" role="alert"><p>{error}</p><button className="button button--secondary" type="button" onClick={() => void loadPlan()}>Try again</button></section>;

  return <section className="base-plan" aria-label="Base planning board">
    <div className="base-plan__toolbar">
      <div><strong>Chunk map</strong><span>{assignments.length} of {totalChunks} chunks assigned · maximum {MAX_BASE_CHUNKS}</span></div>
      <div className="base-plan__tools" role="toolbar" aria-label="Chunk assignment tools">
        <button type="button" className="base-plan__tool" title={lastColumnHasProcess ? "Clear the processes in the last column before removing it" : undefined} disabled={isResizing || project.baseWidthChunks <= 1 || lastColumnHasProcess} onClick={() => void resizeBase("width", -1)}>− Column</button>
        <button type="button" className="base-plan__tool" disabled={isResizing || (project.baseWidthChunks + 1) * project.baseHeightChunks > MAX_BASE_CHUNKS} onClick={() => void resizeBase("width", 1)}>＋ Column</button>
        <button type="button" className="base-plan__tool" title={lastRowHasProcess ? "Clear the processes in the last row before removing it" : undefined} disabled={isResizing || project.baseHeightChunks <= 1 || lastRowHasProcess} onClick={() => void resizeBase("height", -1)}>− Row</button>
        <button type="button" className="base-plan__tool" disabled={isResizing || project.baseWidthChunks * (project.baseHeightChunks + 1) > MAX_BASE_CHUNKS} onClick={() => void resizeBase("height", 1)}>＋ Row</button>
      </div>
    </div>

    {error && <p className="base-plan__inline-error" role="alert">{error}</p>}
    {!processes.length && <div className="base-plan__notice"><strong>No processes available</strong><span>Select an empty chunk to create the first process.</span></div>}

    <div className="base-plan__canvas-wrap">
      <div className="base-plan__axis base-plan__axis--x" style={{ gridTemplateColumns: `repeat(${project.baseWidthChunks}, 220px)` }} aria-hidden="true">{Array.from({ length: project.baseWidthChunks }, (_, x) => <span key={x}>X {x}</span>)}</div>
      <div className="base-plan__axis base-plan__axis--y" style={{ gridTemplateRows: `repeat(${project.baseHeightChunks}, 220px)` }} aria-hidden="true">{Array.from({ length: project.baseHeightChunks }, (_, y) => <span key={y}>Z {y}</span>)}</div>
      <div className="base-plan__grid" style={{ gridTemplateColumns: `repeat(${project.baseWidthChunks}, 220px)` }}>
        {Array.from({ length: project.baseHeightChunks }, (_, y) => Array.from({ length: project.baseWidthChunks }, (_, x) => {
          const assignment = assignmentsByChunk.get(`${x}:${y}`);
          const process = assignment?.processId ? processesById.get(assignment.processId) : undefined;
          const isContextOpen = contextChunk?.x === x && contextChunk.y === y;
          return <div className="base-plan__chunk-wrap" key={`${x}:${y}`}><button type="button" className={`base-plan__chunk${process ? " base-plan__chunk--assigned" : ""}`} style={process ? { "--process-color": process.color } as CSSProperties : undefined} aria-label={`Chunk ${x}, ${y}${process ? `: ${process.name}` : ": Unassigned"}`} aria-expanded={isContextOpen} aria-haspopup="menu" onClick={(event) => openContextMenu(event, x, y)}>
            <span className="base-plan__chunk-coordinate">{x}, {y}</span>
            {process ? <><strong>{process.letter}</strong><span>{process.name}</span></> : <span className="base-plan__chunk-empty">Unassigned</span>}
          </button></div>;
        }))}
      </div>
    </div>
    {contextChunk && createPortal(<div className={`base-plan__context-menu${contextChunk.cursorY > 320 ? " base-plan__context-menu--above" : ""}`} role="menu" aria-label={`Chunk ${contextChunk.x}, ${contextChunk.y} actions`} style={{ left: Math.max(8, Math.min(contextChunk.cursorX, window.innerWidth - 230)), top: contextChunk.cursorY > 320 ? contextChunk.cursorY - 6 : contextChunk.cursorY + 6 }} onKeyDown={(event) => { if (event.key === "Escape") setContextChunk(null); }}>
      {contextProcess && <button role="menuitem" type="button" onClick={() => onOpenProcess?.(contextProcess.id)}>Open {contextProcess.name}</button>}
      <span className="base-plan__context-label">Assign process</span>
      {processes.map((candidate) => <button role="menuitem" type="button" key={candidate.id} disabled={isAssigning} onClick={() => void assignProcess(candidate, contextChunk.x, contextChunk.y)}><span className="base-plan__context-swatch" style={{ backgroundColor: candidate.color }}>{candidate.letter}</span>{candidate.name}</button>)}
      <button role="menuitem" type="button" onClick={() => onOpenProcess?.(null)}>＋ Create new process</button>
      {contextAssignment && <button className="base-plan__context-danger" role="menuitem" type="button" disabled={isAssigning} onClick={() => void removeAssignment(contextChunk.x, contextChunk.y)}>Clear assignment</button>}
    </div>, document.body)}
  </section>;
}
