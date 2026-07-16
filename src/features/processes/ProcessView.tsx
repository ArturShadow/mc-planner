import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import type { CatalogItemModel } from "../../models/catalog.model";
import type { MultiblockModel } from "../../models/multiblock.model";
import type { ProcessPlacement } from "../../models/process-placement.model";
import type { ProcessModel } from "../../models/process.model";
import type { ProjectModel } from "../../models/project.model";
import { listCompatibleCatalog, listMultiblocks } from "../catalog/catalog.repository";
import { createPlacement, deletePlacement, listProcessPlacements } from "./process-placements.repository";
import { createProcess, deleteProcess, listProcesses, updateProcess } from "./processes.repository";
import { ProcessToolPalette } from "./ProcessToolPalette";

interface ProcessViewProps {
  project: ProjectModel;
  navigationRequest?: { processId: number | null; nonce: number } | null;
}
interface ProcessFormState { name: string; color: string; widthChunks: number; heightChunks: number }
type SelectedElement = { type: "catalog_item"; item: CatalogItemModel } | { type: "multiblock"; multiblock: MultiblockModel } | { type: "erase" };

const emptyForm: ProcessFormState = { name: "", color: "#8fd694", widthChunks: 1, heightChunks: 1 };
function placementAt(placements: ProcessPlacement[], x: number, z: number): ProcessPlacement | undefined {
  return placements.find((placement) => x >= placement.originX && x < placement.originX + placement.widthBlocks
    && z >= placement.originZ && z < placement.originZ + placement.depthBlocks);
}

export function ProcessView({ project, navigationRequest }: ProcessViewProps) {
  const [processes, setProcesses] = useState<ProcessModel[]>([]);
  const [activeProcessId, setActiveProcessId] = useState<number | null>(null);
  const [catalog, setCatalog] = useState<CatalogItemModel[]>([]);
  const [multiblocks, setMultiblocks] = useState<MultiblockModel[]>([]);
  const [placements, setPlacements] = useState<ProcessPlacement[]>([]);
  const [selectedValue, setSelectedValue] = useState("");
  const [hoveredCell, setHoveredCell] = useState<{ x: number; z: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProcessFormState>(emptyForm);

  const activeProcess = processes.find((process) => process.id === activeProcessId);
  const widthBlocks = (activeProcess?.widthChunks ?? 1) * 16;
  const depthBlocks = (activeProcess?.heightChunks ?? 1) * 16;
  const selectedElement = useMemo<SelectedElement | null>(() => {
    if (selectedValue === "erase") return { type: "erase" };
    const [type, rawId] = selectedValue.split(":");
    const id = Number(rawId);
    if (type === "catalog") {
      const item = catalog.find((candidate) => candidate.id === id);
      return item ? { type: "catalog_item", item } : null;
    }
    if (type === "multiblock") {
      const multiblock = multiblocks.find((candidate) => candidate.id === id);
      return multiblock ? { type: "multiblock", multiblock } : null;
    }
    return null;
  }, [catalog, multiblocks, selectedValue]);

  useEffect(() => { void loadWorkspace(); }, [project.id]);
  useEffect(() => {
    if (!navigationRequest || isLoading) return;
    if (navigationRequest.processId === null) openCreateForm();
    else if (processes.some((process) => process.id === navigationRequest.processId)) setActiveProcessId(navigationRequest.processId);
  }, [navigationRequest?.nonce, isLoading]);
  useEffect(() => {
    if (activeProcessId === null) { setPlacements([]); return; }
    void loadPlacements(activeProcessId);
  }, [activeProcessId]);

  async function loadWorkspace(): Promise<void> {
    setIsLoading(true); setError(null);
    try {
      const [loadedProcesses, loadedCatalog, loadedMultiblocks] = await Promise.all([
        listProcesses(project.id), listCompatibleCatalog(project), listMultiblocks(),
      ]);
      setProcesses(loadedProcesses); setCatalog(loadedCatalog); setMultiblocks(loadedMultiblocks);
      setActiveProcessId(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load processes."); }
    finally { setIsLoading(false); }
  }

  async function loadPlacements(processId: number): Promise<void> {
    setError(null);
    try { setPlacements(await listProcessPlacements(processId)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load the process design."); }
  }

  function openCreateForm(): void { setEditingId(null); setForm(emptyForm); setIsFormOpen(true); }
  function openEditForm(process: ProcessModel): void {
    setEditingId(process.id);
    setForm({ name: process.name, color: process.color, widthChunks: process.widthChunks, heightChunks: process.heightChunks });
    setIsFormOpen(true);
  }

  async function saveProcess(event: FormEvent): Promise<void> {
    event.preventDefault(); setIsSaving(true); setError(null);
    try {
      const saved = editingId === null ? await createProcess(project.id, form) : await updateProcess(editingId, form);
      setProcesses((current) => editingId === null ? [...current, saved].sort((a, b) => a.name.localeCompare(b.name)) : current.map((item) => item.id === saved.id ? saved : item));
      setActiveProcessId(saved.id); setIsFormOpen(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the process."); }
    finally { setIsSaving(false); }
  }

  async function removeProcess(process: ProcessModel): Promise<void> {
    if (!window.confirm(`Delete ${process.name} and its complete design?`)) return;
    setIsSaving(true); setError(null);
    try {
      await deleteProcess(process.id);
      const remaining = processes.filter((item) => item.id !== process.id);
      setProcesses(remaining); setActiveProcessId(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete the process."); }
    finally { setIsSaving(false); }
  }

  function selectedFootprint(): { width: number; depth: number } {
    return selectedElement?.type === "multiblock"
      ? { width: selectedElement.multiblock.widthBlocks, depth: selectedElement.multiblock.depthBlocks }
      : { width: 1, depth: 1 };
  }

  async function updateCell(x: number, z: number): Promise<void> {
    if (!activeProcess || isSaving) return;
    const occupied = placementAt(placements, x, z);
    if (selectedElement?.type === "erase") {
      if (!occupied) return;
      setIsSaving(true); setError(null);
      try { await deletePlacement(occupied.id); setPlacements((current) => current.filter((item) => item.id !== occupied.id)); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "Could not remove the element."); }
      finally { setIsSaving(false); }
      return;
    }
    if (!selectedElement) { setError("Select an element or the erase tool first."); return; }
    const footprint = selectedFootprint();
    const overlaps = placements.some((placement) => placement.originX < x + footprint.width && placement.originX + placement.widthBlocks > x
      && placement.originZ < z + footprint.depth && placement.originZ + placement.depthBlocks > z);
    if (x + footprint.width > widthBlocks || z + footprint.depth > depthBlocks) { setError("The selected element does not fit at that position."); return; }
    if (overlaps) { setError("That area is already occupied."); return; }
    setIsSaving(true); setError(null);
    try {
      const id = await createPlacement({ processId: activeProcess.id, type: selectedElement.type,
        referenceId: selectedElement.type === "catalog_item" ? selectedElement.item.id : selectedElement.multiblock.id,
        originX: x, originZ: z, widthBlocks: footprint.width, depthBlocks: footprint.depth,
        limitWidthBlocks: widthBlocks, limitDepthBlocks: depthBlocks });
      const placement: ProcessPlacement = selectedElement.type === "catalog_item"
        ? { id, processId: activeProcess.id, type: "catalog_item", item: selectedElement.item, originX: x, originZ: z, widthBlocks: 1, depthBlocks: 1 }
        : { id, processId: activeProcess.id, type: "multiblock", multiblock: selectedElement.multiblock, originX: x, originZ: z, widthBlocks: footprint.width, depthBlocks: footprint.depth };
      setPlacements((current) => [...current, placement]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not place the element."); }
    finally { setIsSaving(false); }
  }

  if (isLoading) return <section className="process-view__message" aria-live="polite">Loading processes…</section>;

  return <section className="process-view" aria-label="Process editor">
    {activeProcess ? <div className="process-view__editor">
          <div className="process-view__editor-nav">
            <button className="button button--secondary" type="button" onClick={() => setActiveProcessId(null)}>← All processes</button>
            <label className="field"><span className="field__label">Current process</span><select aria-label="Current process" className="field__input" value={activeProcess.id} onChange={(event) => setActiveProcessId(Number(event.target.value))}>{processes.map((process) => <option key={process.id} value={process.id}>{process.name}</option>)}</select></label>
            <button className="button button--secondary" type="button" onClick={() => openEditForm(activeProcess)}>Edit</button>
          </div>
          <div className="process-view__toolbar">
            <div><strong>{activeProcess.name}</strong><span>{widthBlocks} × {depthBlocks} blocks · {placements.length} placements</span></div>
            <ProcessToolPalette catalog={catalog} multiblocks={multiblocks} value={selectedValue} onChange={setSelectedValue} />
          </div>
          {!catalog.length && <p className="process-view__catalog-note">The item catalog is empty. Multiblocks and the erase tool remain available; Vanilla data and JAR imports will be added later.</p>}
          {error && <p className="process-view__error" role="alert">{error}</p>}
          <div className="process-view__canvas" aria-busy={isSaving}>
            <div className="process-view__grid" role="grid" aria-label={`${activeProcess.name} ${widthBlocks} by ${depthBlocks} block grid`} style={{ "--process-grid-width": widthBlocks } as CSSProperties}>
              {Array.from({ length: widthBlocks * depthBlocks }, (_, index) => {
                const x = index % widthBlocks; const z = Math.floor(index / widthBlocks); const placement = placementAt(placements, x, z);
                const footprint = selectedFootprint();
                const preview = hoveredCell && selectedElement && selectedElement.type !== "erase" && x >= hoveredCell.x && x < hoveredCell.x + footprint.width && z >= hoveredCell.z && z < hoveredCell.z + footprint.depth;
                const invalidPreview = Boolean(preview && (hoveredCell!.x + footprint.width > widthBlocks || hoveredCell!.z + footprint.depth > depthBlocks || placement));
                const label = placement ? (placement.type === "catalog_item" ? placement.item.name : placement.multiblock.name) : "Empty";
                return <button key={`${x}:${z}`} role="gridcell" type="button" className={`process-view__cell${placement ? " process-view__cell--occupied" : ""}${preview ? " process-view__cell--preview" : ""}${invalidPreview ? " process-view__cell--invalid" : ""}`} aria-label={`Block ${x}, ${z}: ${label}`} title={`${x}, ${z} · ${label}`} onMouseEnter={() => setHoveredCell({ x, z })} onFocus={() => setHoveredCell({ x, z })} onClick={() => void updateCell(x, z)}>{placement ? (placement.type === "catalog_item" ? "■" : placement.multiblock.symbol) : ""}</button>;
              })}
            </div>
          </div>
      </div> : <div className="process-gallery">
        <div className="process-gallery__header"><div><p className="planner__eyebrow">Process library</p><h2>Your processes</h2><span>{processes.length} total</span></div><button className="button button--primary" type="button" onClick={openCreateForm}>New process</button></div>
        {error && <p className="process-view__error" role="alert">{error}</p>}
        {processes.length ? <div className="process-gallery__grid">{processes.map((process) => <article className="process-card" key={process.id} style={{ "--process-color": process.color } as CSSProperties}>
          <button className="process-card__open" type="button" onClick={() => setActiveProcessId(process.id)}><span className="process-card__icon">{process.letter}</span><span className="process-card__body"><strong>{process.name}</strong><small>{process.widthChunks} × {process.heightChunks} chunks · {process.widthChunks * 16} × {process.heightChunks * 16} blocks</small></span><span aria-hidden="true">→</span></button>
          <div className="process-card__actions"><button type="button" onClick={() => openEditForm(process)}>Edit</button><button type="button" onClick={() => void removeProcess(process)}>Delete</button></div>
        </article>)}</div> : <div className="process-view__empty"><span aria-hidden="true">⇄</span><h2>No processes yet</h2><p>Create a process to start designing a production area.</p><button className="button button--primary" type="button" onClick={openCreateForm}>Create process</button></div>}
      </div>}

    {isFormOpen && <div className="dialog-backdrop" role="presentation"><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="process-dialog-title">
      <div className="dialog__header"><div><p className="dialog__eyebrow">Process</p><h2 id="process-dialog-title">{editingId === null ? "Create process" : "Edit process"}</h2></div><button className="dialog__close" type="button" aria-label="Close" onClick={() => setIsFormOpen(false)}>×</button></div>
      <form className="dialog__form process-view__form" onSubmit={(event) => void saveProcess(event)}>
        <label className="field"><span className="field__label">Name</span><input required className="field__input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
        <label className="field"><span className="field__label">Color</span><input type="color" className="field__input process-view__color" value={form.color} onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))} /></label>
        <label className="field"><span className="field__label">Width (chunks)</span><input required type="number" min={1} className="field__input" value={form.widthChunks} onChange={(event) => setForm((current) => ({ ...current, widthChunks: Number(event.target.value) }))} /></label>
        <label className="field"><span className="field__label">Depth (chunks)</span><input required type="number" min={1} className="field__input" value={form.heightChunks} onChange={(event) => setForm((current) => ({ ...current, heightChunks: Number(event.target.value) }))} /></label>
        <div className="dialog__actions"><button className="button button--secondary" type="button" onClick={() => setIsFormOpen(false)}>Cancel</button><button className="button button--primary" type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save process"}</button></div>
      </form>
    </section></div>}
  </section>;
}
