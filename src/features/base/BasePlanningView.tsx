import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { BaseAssignmentModel } from "../../models/base.model";
import type { ProcessModel } from "../../models/process.model";
import type { ProjectModel } from "../../models/project.model";
import { listProcesses } from "../processes/processes.repository";
import { resizeProjectBase } from "../projects/projects.repository";
import { assignProcessArea, clearChunk, listBaseAssignments } from "./base.repository";

interface BasePlanningViewProps {
  project: ProjectModel;
  onProjectBaseSizeChange?: (widthChunks: number, heightChunks: number) => void;
}

const MAX_BASE_CHUNKS = 20;

export function BasePlanningView({ project, onProjectBaseSizeChange }: BasePlanningViewProps) {
  const [processes, setProcesses] = useState<ProcessModel[]>([]);
  const [assignments, setAssignments] = useState<BaseAssignmentModel[]>([]);
  const [selectedProcessId, setSelectedProcessId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingChunk, setSavingChunk] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => { void loadPlan(); }, [project.id]);

  async function loadPlan(): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const [loadedProcesses, loadedAssignments] = await Promise.all([
        listProcesses(project.id), listBaseAssignments(project.id),
      ]);
      setProcesses(loadedProcesses);
      setAssignments(loadedAssignments);
      setSelectedProcessId(loadedProcesses[0]?.id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the base plan.");
    } finally { setIsLoading(false); }
  }

  const assignmentsByChunk = useMemo(() => new Map(assignments.map((item) => [`${item.chunkX}:${item.chunkY}`, item])), [assignments]);
  const processesById = useMemo(() => new Map(processes.map((process) => [process.id, process])), [processes]);
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

  async function updateChunk(chunkX: number, chunkY: number): Promise<void> {
    const key = `${chunkX}:${chunkY}`;
    if (savingChunk) return;
    const selectedProcess = selectedProcessId === null ? undefined : processesById.get(selectedProcessId);
    const targetChunks = selectedProcess ? Array.from({ length: selectedProcess.heightChunks }, (_, offsetY) =>
      Array.from({ length: selectedProcess.widthChunks }, (_, offsetX) => ({ chunkX: chunkX + offsetX, chunkY: chunkY + offsetY })),
    ).flat() : [{ chunkX, chunkY }];
    if (selectedProcess && targetChunks.some((chunk) => chunk.chunkX >= project.baseWidthChunks || chunk.chunkY >= project.baseHeightChunks)) {
      setError(`${selectedProcess.name} needs ${selectedProcess.widthChunks} × ${selectedProcess.heightChunks} chunks and does not fit there.`);
      return;
    }
    const targetKeys = new Set(targetChunks.map((chunk) => `${chunk.chunkX}:${chunk.chunkY}`));
    const previousTargets = assignments.filter((item) => targetKeys.has(`${item.chunkX}:${item.chunkY}`));
    const nextAssignments = selectedProcess ? targetChunks.map((chunk) => ({
      id: assignmentsByChunk.get(`${chunk.chunkX}:${chunk.chunkY}`)?.id ?? -1,
      projectId: project.id,
      processId: selectedProcess.id,
      ...chunk,
    })) : [];
    setSavingChunk(key);
    setError(null);
    setAssignments((current) => [...current.filter((item) => !targetKeys.has(`${item.chunkX}:${item.chunkY}`)), ...nextAssignments]);
    try {
      if (selectedProcessId === null) await clearChunk(project.id, chunkX, chunkY);
      else await assignProcessArea(project.id, selectedProcessId, targetChunks);
    } catch (cause) {
      setAssignments((current) => [...current.filter((item) => !targetKeys.has(`${item.chunkX}:${item.chunkY}`)), ...previousTargets]);
      setError(cause instanceof Error ? cause.message : "Could not save the chunk.");
    } finally { setSavingChunk(null); }
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
        {processes.map((process) => <button key={process.id} type="button" className={`base-plan__tool${selectedProcessId === process.id ? " base-plan__tool--active" : ""}`} aria-pressed={selectedProcessId === process.id} onClick={() => setSelectedProcessId(process.id)}>
          <span className="base-plan__swatch" style={{ backgroundColor: process.color }}>{process.letter}</span><span>{process.name}<small>{process.widthChunks} × {process.heightChunks}</small></span>
        </button>)}
        <button type="button" className={`base-plan__tool${selectedProcessId === null ? " base-plan__tool--active" : ""}`} aria-pressed={selectedProcessId === null} onClick={() => setSelectedProcessId(null)}>⌫ Clear</button>
      </div>
    </div>

    {error && <p className="base-plan__inline-error" role="alert">{error}</p>}
    {!processes.length && <div className="base-plan__notice"><strong>No processes available</strong><span>Create a process first; you can still inspect and clear the chunk map.</span></div>}

    <div className="base-plan__canvas-wrap">
      <div className="base-plan__axis base-plan__axis--x" style={{ gridTemplateColumns: `repeat(${project.baseWidthChunks}, minmax(112px, 1fr))` }} aria-hidden="true">{Array.from({ length: project.baseWidthChunks }, (_, x) => <span key={x}>X {x}</span>)}</div>
      <div className="base-plan__axis base-plan__axis--y" style={{ gridTemplateRows: `repeat(${project.baseHeightChunks}, minmax(112px, 1fr))` }} aria-hidden="true">{Array.from({ length: project.baseHeightChunks }, (_, y) => <span key={y}>Z {y}</span>)}</div>
      <div className="base-plan__grid" style={{ gridTemplateColumns: `repeat(${project.baseWidthChunks}, minmax(92px, 1fr))` }}>
        {Array.from({ length: project.baseHeightChunks }, (_, y) => Array.from({ length: project.baseWidthChunks }, (_, x) => {
          const assignment = assignmentsByChunk.get(`${x}:${y}`);
          const process = assignment?.processId ? processesById.get(assignment.processId) : undefined;
          const isSaving = savingChunk === `${x}:${y}`;
          return <button key={`${x}:${y}`} type="button" className={`base-plan__chunk${process ? " base-plan__chunk--assigned" : ""}`} style={process ? { "--process-color": process.color } as CSSProperties : undefined} aria-label={`Chunk ${x}, ${y}${process ? `: ${process.name}` : ": Unassigned"}`} disabled={isSaving} onClick={() => void updateChunk(x, y)}>
            <span className="base-plan__chunk-coordinate">{x}, {y}</span>
            {process ? <><strong>{process.letter}</strong><span>{process.name}</span></> : <span className="base-plan__chunk-empty">Unassigned</span>}
          </button>;
        }))}
      </div>
    </div>
  </section>;
}
