import { useEffect, useMemo, useRef, useState } from "react";
import type { CatalogCategory, CatalogItemModel } from "../../models/catalog.model";
import type { MultiblockModel } from "../../models/multiblock.model";

const PAGE_SIZE = 40;
const categoryLabels: Record<CatalogCategory, string> = { block: "Blocks", cable: "Cables", pipe: "Pipes", tool: "Tools" };
type ToolOption = { value: string; name: string; detail: string; category: string; symbol: string };

interface ProcessToolPaletteProps {
  catalog: CatalogItemModel[];
  multiblocks: MultiblockModel[];
  value: string;
  onChange: (value: string) => void;
}

export function ProcessToolPalette({ catalog, multiblocks, value, onChange }: ProcessToolPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const rootRef = useRef<HTMLDivElement>(null);
  const options = useMemo<ToolOption[]>(() => [
    ...multiblocks.map((item) => ({ value: `multiblock:${item.id}`, name: item.name, detail: `${item.widthBlocks}×${item.depthBlocks} blocks`, category: "Multiblocks", symbol: "⬡" })),
    ...catalog.map((item) => ({ value: `catalog:${item.id}`, name: item.name, detail: item.modName || item.itemIdentifier || "Minecraft", category: item.category === "block" && item.modName ? `Blocks · ${item.modName}` : categoryLabels[item.category], symbol: symbolFor(item.category) })),
  ].sort((left, right) => left.category.localeCompare(right.category) || left.name.localeCompare(right.name)), [catalog, multiblocks]);
  const selected = options.find((item) => item.value === value);
  const filtered = useMemo(() => { const text = query.trim().toLocaleLowerCase(); return options.filter((item) => !text || `${item.name} ${item.detail} ${item.category}`.toLocaleLowerCase().includes(text)); }, [options, query]);
  const visible = filtered.slice(0, visibleCount);
  const groups = useMemo(() => { const result = new Map<string, ToolOption[]>(); for (const item of visible) result.set(item.category, [...(result.get(item.category) || []), item]); return [...result.entries()]; }, [visible]);

  useEffect(() => {
    function close(event: MouseEvent): void { if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false); }
    document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close);
  }, []);

  function togglePicker(): void { setIsOpen((current) => !current); setVisibleCount(PAGE_SIZE); }
  function choose(option: ToolOption): void { onChange(option.value); setIsOpen(false); setQuery(""); }

  return <div className="process-tools" ref={rootRef} aria-label="Placement tools">
    <span className="process-tools__label">Tools</span>
    <div className="process-tools__buttons" role="toolbar" aria-label="Process editing tools">
      <button type="button" className={`process-tools__button${value === "erase" ? " process-tools__button--active" : ""}`} aria-label="Erase placement" title="Erase placement" aria-pressed={value === "erase"} onClick={() => { onChange("erase"); setIsOpen(false); }}><span aria-hidden="true">⌫</span></button>
      <button type="button" className={`process-tools__button process-tools__picker${value && value !== "erase" ? " process-tools__button--active" : ""}`} aria-label="Select placement element" title="Select placement element" aria-expanded={isOpen} onClick={togglePicker}><span aria-hidden="true">{selected?.symbol || "＋"}</span><small>{selected?.name || "Element"}</small></button>
    </div>
    {isOpen && <section className="process-tools__panel" aria-label="Element library"><input className="field__input" aria-label="Filter placement elements" placeholder="Search blocks, mods, or categories…" value={query} autoFocus onChange={(event) => { setQuery(event.target.value); setVisibleCount(PAGE_SIZE); }} /><div className="process-tools__options" role="listbox" onScroll={(event) => { const target = event.currentTarget; if (target.scrollTop + target.clientHeight >= target.scrollHeight - 32) setVisibleCount((current) => Math.min(current + PAGE_SIZE, filtered.length)); }}>{groups.map(([category, items]) => <section className="process-tools__group" aria-label={category} key={category}><div className="process-tools__group-label">{category}</div>{items.map((item) => <button type="button" role="option" aria-selected={item.value === value} className="process-tools__option" key={item.value} onClick={() => choose(item)}><span aria-hidden="true">{item.symbol}</span><strong>{item.name}</strong><small>{item.detail}</small></button>)}</section>)}{!visible.length && <p className="process-tools__empty">No matching elements</p>}{visibleCount < filtered.length && <p className="process-tools__more">Scroll to load more · {filtered.length - visibleCount} remaining</p>}</div></section>}
  </div>;
}

function symbolFor(category: CatalogCategory): string { return { block: "■", cable: "╱", pipe: "│", tool: "◆" }[category]; }
