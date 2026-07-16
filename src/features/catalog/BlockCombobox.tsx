import { useEffect, useMemo, useRef, useState } from "react";
import type { CatalogItemModel } from "../../models/catalog.model";

const PAGE_SIZE = 40;

interface BlockComboboxProps {
  items: CatalogItemModel[];
  value: number;
  excludedIds: Set<number>;
  disabled?: boolean;
  onChange: (itemId: number) => void;
}

export function BlockCombobox({ items, value, excludedIds, disabled, onChange }: BlockComboboxProps) {
  const selected = items.find((item) => item.id === value);
  const [query, setQuery] = useState(selected ? labelFor(selected) : "");
  const [isOpen, setIsOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!isOpen) setQuery(selected ? labelFor(selected) : ""); }, [selected?.id, isOpen]);
  useEffect(() => {
    function close(event: MouseEvent): void { if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return items.filter((item) => item.id === value || !excludedIds.has(item.id)).filter((item) =>
      !normalized || `${item.name} ${item.modName || ""} ${item.itemIdentifier || ""}`.toLocaleLowerCase().includes(normalized),
    ).sort((left, right) => groupFor(left).localeCompare(groupFor(right)) || left.name.localeCompare(right.name));
  }, [items, excludedIds, query, value]);
  const visible = filtered.slice(0, visibleCount);
  const groups = useMemo(() => {
    const result = new Map<string, CatalogItemModel[]>();
    for (const item of visible) {
      const group = groupFor(item);
      result.set(group, [...(result.get(group) || []), item]);
    }
    return [...result.entries()];
  }, [visible]);

  function open(): void { if (!disabled) { setIsOpen(true); setVisibleCount(PAGE_SIZE); } }
  function choose(item: CatalogItemModel): void { onChange(item.id); setQuery(labelFor(item)); setIsOpen(false); }

  return <div className="block-combobox" ref={rootRef}>
    <input className="field__input block-combobox__input" role="combobox" aria-label="Block" aria-expanded={isOpen} aria-controls="block-combobox-options" aria-autocomplete="list" placeholder="Search blocks…" value={query} disabled={disabled} onFocus={open} onClick={open} onChange={(event) => { setQuery(event.target.value); setIsOpen(true); setVisibleCount(PAGE_SIZE); if (value) onChange(0); }} onKeyDown={(event) => { if (event.key === "Escape") setIsOpen(false); if (event.key === "ArrowDown") { event.preventDefault(); open(); } }} />
    {isOpen && <div id="block-combobox-options" className="block-combobox__options" role="listbox" onScroll={(event) => { const target = event.currentTarget; if (target.scrollTop + target.clientHeight >= target.scrollHeight - 32) setVisibleCount((current) => Math.min(current + PAGE_SIZE, filtered.length)); }}>
      {groups.map(([group, groupItems]) => <section className="block-combobox__group" aria-label={group} key={group}><div className="block-combobox__group-label">{group}<span>{groupItems.length}</span></div>{groupItems.map((item) => <button className="block-combobox__option" type="button" role="option" aria-selected={item.id === value} key={item.id} onClick={() => choose(item)}><strong>{item.name}</strong><span>{item.itemIdentifier || "No identifier"}</span></button>)}</section>)}
      {!visible.length && <p className="block-combobox__empty">No matching blocks</p>}
      {visibleCount < filtered.length && <p className="block-combobox__more">Scroll to load more · {filtered.length - visibleCount} remaining</p>}
    </div>}
  </div>;
}

function labelFor(item: CatalogItemModel): string { return `${item.name}${item.modName ? ` — ${item.modName}` : ""}`; }
function groupFor(item: CatalogItemModel): string { return item.modName || (item.sourceType === "vanilla" ? "Minecraft" : "Manual blocks"); }
