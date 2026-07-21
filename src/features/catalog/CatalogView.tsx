import { FormEvent, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { CatalogItemModel, CatalogSourceModel, JarAnalysis } from "../../models/catalog.model";
import type { MultiblockModel } from "../../models/multiblock.model";
import type { ProjectModel } from "../../models/project.model";
import { createMultiblock, deleteMultiblock, importJarAnalyses, listCatalogIdentifiers, listCatalogSources, listCompatibleCatalog, listMultiblocks, updateMultiblock } from "./catalog.repository";
import { BlockCombobox } from "./BlockCombobox";
import { ImportPreviewTable, type ImportPreviewRow, type ImportStatusFilter } from "./ImportPreviewTable";

interface CatalogViewProps { project: ProjectModel }
const IMPORT_BATCH_SIZE = 6;

export function CatalogView({ project }: CatalogViewProps) {
  const [catalog, setCatalog] = useState<CatalogItemModel[]>([]);
  const [multiblocks, setMultiblocks] = useState<MultiblockModel[]>([]);
  const [sources, setSources] = useState<CatalogSourceModel[]>([]);
  const [knownIdentifiers, setKnownIdentifiers] = useState<Set<string>>(new Set());
  const [analyses, setAnalyses] = useState<JarAnalysis[]>([]);
  const [selectedMods, setSelectedMods] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ImportStatusFilter>("all");
  const [isBusy, setIsBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMultiblockFormOpen, setIsMultiblockFormOpen] = useState(false);
  const [editingMultiblockId, setEditingMultiblockId] = useState<number | null>(null);
  const [multiblockName, setMultiblockName] = useState("");
  const [dimensions, setDimensions] = useState({ width: 1, depth: 1, height: 1 });
  const [canShareWalls, setCanShareWalls] = useState(false);
  const [requirements, setRequirements] = useState<Array<{ itemId: number; quantity: number }>>([{ itemId: 0, quantity: 1 }]);

  async function loadCatalog(): Promise<void> {
    const [items, loadedMultiblocks, loadedSources, identifiers] = await Promise.all([
      listCompatibleCatalog(project), listMultiblocks(), listCatalogSources(project.id), listCatalogIdentifiers(),
    ]);
    setCatalog(items); setMultiblocks(loadedMultiblocks); setSources(loadedSources); setKnownIdentifiers(new Set(identifiers));
  }

  useEffect(() => { void loadCatalog().catch((cause) => setError(toMessage(cause))); }, [project.id]);
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void getCurrentWindow().onDragDropEvent((event) => {
      if (event.payload.type === "over") setIsDragging(true);
      if (event.payload.type === "leave") setIsDragging(false);
      if (event.payload.type === "drop") { setIsDragging(false); void analyzePaths(event.payload.paths); }
    }).then((handler) => { unlisten = handler; });
    return () => unlisten?.();
  }, [project.id, sources.length, knownIdentifiers.size]);

  async function analyzePaths(paths: string[]): Promise<void> {
    if (!paths.length) return;
    setIsBusy(true); setError(null); setMessage(null);
    try {
      const jarPaths = await invoke<string[]>("collect_mod_jar_paths", { paths });
      setAnalyses([]); setSelectedMods(new Set()); setProgress({ processed: 0, total: jarPaths.length });
      if (!jarPaths.length) { setMessage("No JAR files were found at the selected location."); return; }
      const result: JarAnalysis[] = [];
      for (let offset = 0; offset < jarPaths.length; offset += IMPORT_BATCH_SIZE) {
        const batchPaths = jarPaths.slice(offset, offset + IMPORT_BATCH_SIZE);
        const batch = await invoke<JarAnalysis[]>("scan_mod_jars", { paths: batchPaths, locale: "en_us" });
        result.push(...batch);
        setAnalyses([...result]);
        setSelectedMods(new Set(result.filter((item) => !item.error && !isExact(item)).map(keyFor)));
        setProgress({ processed: Math.min(offset + batchPaths.length, jarPaths.length), total: jarPaths.length });
        await nextPaint();
      }
      const skipped = jarPaths.length - result.length;
      if (!result.length) {
        setMessage(skipped ? `${skipped} JAR file${skipped === 1 ? " was" : "s were"} skipped because no block language entries were found.` : "No importable mods were found.");
        return;
      }
      if (result.every((item) => item.error || isExact(item))) {
        setMessage("Every valid selected JAR has already been imported without changes.");
      } else if (skipped > 0) {
        setMessage(`${skipped} JAR file${skipped === 1 ? " was" : "s were"} skipped because no block language entries were found.`);
      }
    } catch (cause) { setError(toMessage(cause)); }
    finally { setIsBusy(false); setProgress(null); }
  }

  async function selectFiles(): Promise<void> {
    const result = await open({ multiple: true, directory: false, filters: [{ name: "Minecraft mods", extensions: ["jar"] }] });
    if (result) await analyzePaths(Array.isArray(result) ? result : [result]);
  }

  async function selectFolder(): Promise<void> {
    const result = await open({ multiple: false, directory: true });
    if (result) await analyzePaths([result]);
  }

  function isExact(item: JarAnalysis): boolean {
    return sources.some((source) => source.sourceIdentifier === item.modId && source.contentHash === item.contentHash);
  }

  function newCount(item: JarAnalysis): number { return item.blocks.filter((block) => !knownIdentifiers.has(block.itemIdentifier)).length; }
  function duplicateCount(item: JarAnalysis): number { return item.blocks.length - newCount(item); }

  async function saveImport(): Promise<void> {
    const chosen = analyses.filter((item) => selectedMods.has(keyFor(item)) && !item.error && !isExact(item) && newCount(item) > 0);
    if (!chosen.length) { setMessage("There are no new selected blocks to import."); return; }
    setIsBusy(true); setError(null);
    try {
      const count = await importJarAnalyses(project, chosen);
      await loadCatalog();
      setAnalyses([]); setSelectedMods(new Set()); setMessage(`${count} new block${count === 1 ? "" : "s"} imported.`);
    } catch (cause) { setError(toMessage(cause)); }
    finally { setIsBusy(false); }
  }

  async function exportManifest(): Promise<void> {
    const path = await save({ defaultPath: "mc-planner-catalog-analysis.json", filters: [{ name: "JSON", extensions: ["json"] }] });
    if (!path) return;
    const mods = analyses.map((analysis) => ({ fileName: analysis.fileName, contentHash: analysis.contentHash, modId: analysis.modId, modName: analysis.modName, modVersion: analysis.modVersion, blocks: analysis.blocks, warnings: analysis.warnings, error: analysis.error }));
    await invoke("export_catalog_manifest", { path, manifest: { schemaVersion: 1, locale: "en_us", mods } });
    setMessage(`Analysis exported to ${path}.`);
  }

  async function saveMultiblock(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const validRequirements = requirements.filter((item) => item.itemId > 0 && item.quantity > 0);
    if (!multiblockName.trim() || validRequirements.length !== requirements.length || !validRequirements.length) return;
    setIsBusy(true); setError(null);
    try {
      const input = { name: multiblockName, widthBlocks: dimensions.width, depthBlocks: dimensions.depth, heightBlocks: dimensions.height, canShareWalls, requirements: validRequirements };
      if (editingMultiblockId === null) await createMultiblock(input);
      else await updateMultiblock(editingMultiblockId, input);
      setMultiblocks(await listMultiblocks());
      closeMultiblockForm();
      setMessage(`${multiblockName.trim()} ${editingMultiblockId === null ? "created" : "updated"}.`);
    } catch (cause) { setError(toMessage(cause)); }
    finally { setIsBusy(false); }
  }

  function closeMultiblockForm(): void {
    setIsMultiblockFormOpen(false); setEditingMultiblockId(null); setMultiblockName(""); setDimensions({ width: 1, depth: 1, height: 1 }); setCanShareWalls(false); setRequirements([{ itemId: 0, quantity: 1 }]);
  }

  function editMultiblock(multiblock: MultiblockModel): void {
    setEditingMultiblockId(multiblock.id); setMultiblockName(multiblock.name);
    setDimensions({ width: multiblock.widthBlocks, depth: multiblock.depthBlocks, height: multiblock.heightBlocks });
    setCanShareWalls(multiblock.canShareWalls);
    setRequirements(multiblock.requirements.map((requirement) => ({ itemId: requirement.item.id, quantity: requirement.quantity })));
    setIsMultiblockFormOpen(true);
  }

  async function removeMultiblock(multiblock: MultiblockModel): Promise<void> {
    if (!window.confirm(`Delete ${multiblock.name}?`)) return;
    setIsBusy(true); setError(null);
    try { await deleteMultiblock(multiblock.id); setMultiblocks((current) => current.filter((item) => item.id !== multiblock.id)); setMessage(`${multiblock.name} deleted.`); }
    catch (cause) { setError(toMessage(cause)); }
    finally { setIsBusy(false); }
  }

  const rows = useMemo(() => analyses.filter((item) => {
    const normalizedQuery = query.trim().toLowerCase();
    const modText = `${item.fileName} ${item.modName} ${item.modId}`.toLowerCase();
    const matchesBlock = normalizedQuery.length > 0 && item.blocks.some((block) =>
      `${block.name} ${block.itemIdentifier}`.toLowerCase().includes(normalizedQuery),
    );
    if (normalizedQuery && !modText.includes(normalizedQuery) && !matchesBlock) return false;
    if (statusFilter === "error") return Boolean(item.error);
    if (statusFilter === "warning") return item.warnings.length > 0;
    if (statusFilter === "new") return !item.error && !isExact(item) && newCount(item) > 0;
    if (statusFilter === "duplicate") return isExact(item) || duplicateCount(item) > 0;
    return true;
  }), [analyses, query, statusFilter, sources, knownIdentifiers]);
  const previewRows = useMemo<ImportPreviewRow[]>(() => rows.map((item) => {
    const exact = isExact(item);
    const added = newCount(item);
    return {
      ...item,
      rowKey: keyFor(item),
      exact,
      newCount: added,
      duplicateCount: duplicateCount(item),
      disabled: Boolean(item.error) || exact || added === 0,
    };
  }), [rows, sources, knownIdentifiers]);
  const selectionKeys = useMemo(() => Object.fromEntries([...selectedMods].map((key) => [key, true])), [selectedMods]);

  const selectedNewCount = analyses.filter((item) => selectedMods.has(keyFor(item))).reduce((total, item) => total + newCount(item), 0);

  return <section className="catalog-view" aria-labelledby="catalog-view-title">
    <div className="catalog-view__summary"><div><h2 id="catalog-view-title">Mod block catalog</h2><p>Import localized block names from Fabric, Forge, or NeoForge JARs.</p></div><div className="catalog-view__counts"><span><strong>{catalog.filter((item) => item.category === "block").length}</strong> blocks</span><span><strong>{sources.length}</strong> sources</span><span><strong>{multiblocks.length}</strong> multiblocks</span></div></div>
    <div className={`catalog-drop${isDragging ? " catalog-drop--active" : ""}`} aria-label="Drop JAR files or a mods folder here">
      <strong>{isDragging ? "Drop to analyze" : "Drop JAR files or a mods folder here"}</strong><span>Folders are scanned only at their first level.</span>
      <div className="catalog-drop__actions"><button className="button button--primary" type="button" onClick={() => void selectFiles()} disabled={isBusy}>Select JAR files</button><button className="button button--secondary" type="button" onClick={() => void selectFolder()} disabled={isBusy}>Select mods folder</button></div>
    </div>
    {isBusy && <p className="catalog-view__notice" aria-live="polite">{progress ? `Analyzing mod files… ${progress.processed} of ${progress.total}` : "Preparing mod files…"}</p>}
    {message && <p className="catalog-view__notice" role="status">{message}</p>}
    {error && <p className="catalog-view__notice catalog-view__notice--error" role="alert">{error}</p>}
    {analyses.length > 0 && <section className="catalog-preview" aria-labelledby="catalog-preview-title">
      <div className="catalog-preview__header"><div><h3 id="catalog-preview-title">Import preview</h3><p>{selectedNewCount} new block{selectedNewCount === 1 ? "" : "s"} selected</p></div><div className="catalog-preview__actions"><button className="button button--secondary" type="button" disabled={isBusy} onClick={() => void exportManifest()}>Export analysis JSON</button><button className="button button--primary" type="button" disabled={isBusy || selectedNewCount === 0} onClick={() => void saveImport()}>Import selected</button></div></div>
      <ImportPreviewTable rows={previewRows} selectedKeys={selectionKeys} query={query} statusFilter={statusFilter} onQueryChange={setQuery} onStatusFilterChange={setStatusFilter} onSelectionChange={(keys) => setSelectedMods(new Set(Object.keys(keys).filter((key) => keys[key])))} />
      {!rows.length && <p className="catalog-preview__empty">No mods match these filters.</p>}
    </section>}
    <div className="catalog-view__lists"><section><h3>Imported sources</h3>{sources.length ? <ul>{sources.map((source) => <li key={source.id}><strong>{source.displayName}</strong><span>{source.modVersion || source.sourceIdentifier}</span></li>)}</ul> : <p>No mod sources imported yet.</p>}</section><section className="multiblock-list"><div className="multiblock-list__header"><h3>Multiblocks</h3><button className="button button--secondary" type="button" onClick={() => setIsMultiblockFormOpen(true)}>New multiblock</button></div>{multiblocks.length ? <ul>{multiblocks.map((item) => <li className="multiblock-list__item" key={item.id}><div><div><strong>{item.name}</strong><span>{item.widthBlocks} × {item.depthBlocks} × {item.heightBlocks}{item.canShareWalls ? " · Shared walls" : ""}</span></div><div className="multiblock-list__actions"><button type="button" onClick={() => editMultiblock(item)}>Edit</button><button type="button" onClick={() => void removeMultiblock(item)}>Delete</button></div></div>{item.requirements.length ? <ul className="multiblock-list__requirements">{item.requirements.map((requirement) => <li key={requirement.id}><span>{requirement.item.name}</span><strong>× {requirement.quantity}</strong></li>)}</ul> : <small>No block requirements</small>}</li>)}</ul> : <p>No multiblocks yet.</p>}</section></div>
    {isMultiblockFormOpen && <div className="dialog-backdrop" role="presentation"><section className="dialog multiblock-form" role="dialog" aria-modal="true" aria-labelledby="multiblock-form-title"><div className="dialog__header"><div><p className="dialog__eyebrow">Catalog</p><h2 id="multiblock-form-title">{editingMultiblockId === null ? "Create multiblock" : "Edit multiblock"}</h2></div><button className="dialog__close" type="button" aria-label="Close" disabled={isBusy} onClick={closeMultiblockForm}>×</button></div><form className="dialog__form" onSubmit={(event) => void saveMultiblock(event)}><label className="field"><span className="field__label">Name</span><input className="field__input" value={multiblockName} onChange={(event) => setMultiblockName(event.target.value)} autoFocus disabled={isBusy} /></label><fieldset className="multiblock-form__dimensions"><legend>Dimensions in blocks</legend>{(["width", "depth", "height"] as const).map((dimension) => <label className="field" key={dimension}><span className="field__label">{dimension}</span><input className="field__input" type="number" min="1" value={dimensions[dimension]} onChange={(event) => setDimensions((current) => ({ ...current, [dimension]: Math.max(1, Number(event.target.value)) }))} disabled={isBusy} /></label>)}</fieldset><label className="multiblock-form__sharing"><input type="checkbox" checked={canShareWalls} onChange={(event) => setCanShareWalls(event.target.checked)} disabled={isBusy} /><span><strong>Allow shared walls</strong><small>Instances of this same multiblock may share walls.</small></span></label><fieldset className="multiblock-form__requirements"><legend>Required blocks</legend>{requirements.map((requirement, index) => { const used = new Set(requirements.filter((_, candidate) => candidate !== index).map((item) => item.itemId)); return <div className="multiblock-form__requirement" key={index}><label className="field"><span className="field__label">Block</span><BlockCombobox items={catalog.filter((item) => item.category === "block")} value={requirement.itemId} excludedIds={used} disabled={isBusy} onChange={(itemId) => setRequirements((current) => current.map((item, candidate) => candidate === index ? { ...item, itemId } : item))} /></label><label className="field multiblock-form__quantity"><span className="field__label">Quantity</span><input className="field__input" type="number" min="1" value={requirement.quantity} onChange={(event) => setRequirements((current) => current.map((item, candidate) => candidate === index ? { ...item, quantity: Math.max(1, Number(event.target.value)) } : item))} disabled={isBusy} /></label><button className="button button--secondary" type="button" aria-label={`Remove requirement ${index + 1}`} disabled={isBusy || requirements.length === 1} onClick={() => setRequirements((current) => current.filter((_, candidate) => candidate !== index))}>×</button></div>; })}<button className="button button--secondary" type="button" disabled={isBusy || requirements.length >= catalog.filter((item) => item.category === "block").length} onClick={() => setRequirements((current) => [...current, { itemId: 0, quantity: 1 }])}>Add block</button></fieldset><div className="dialog__actions"><button className="button button--secondary" type="button" onClick={closeMultiblockForm} disabled={isBusy}>Cancel</button><button className="button button--primary" type="submit" disabled={isBusy || !multiblockName.trim() || requirements.some((item) => item.itemId <= 0 || item.quantity <= 0)}>{editingMultiblockId === null ? "Create multiblock" : "Save changes"}</button></div></form></section></div>}
  </section>;
}

function keyFor(item: JarAnalysis): string { return `${item.path}:${item.contentHash}`; }
function toMessage(cause: unknown): string { return cause instanceof Error ? cause.message : String(cause || "Catalog operation failed."); }
function nextPaint(): Promise<void> { return new Promise((resolve) => window.requestAnimationFrame(() => resolve())); }
