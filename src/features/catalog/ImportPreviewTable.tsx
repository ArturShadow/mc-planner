import { useMemo, useState } from "react";
import { Column } from "primereact/column";
import { DataTable, type DataTableExpandedRows, type DataTableSelectionMultipleChangeEvent } from "primereact/datatable";
import { Dropdown, type DropdownChangeEvent } from "primereact/dropdown";
import type { JarAnalysis } from "../../models/catalog.model";

export type ImportStatusFilter = "all" | "new" | "duplicate" | "warning" | "error";

export interface ImportPreviewRow extends JarAnalysis {
  rowKey: string;
  exact: boolean;
  newCount: number;
  duplicateCount: number;
  disabled: boolean;
}

interface ImportPreviewTableProps {
  rows: ImportPreviewRow[];
  selectedKeys: Record<string, boolean>;
  statusFilter: ImportStatusFilter;
  onSelectionChange: (keys: Record<string, boolean>) => void;
  onStatusFilterChange: (value: ImportStatusFilter) => void;
}

const STATUS_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Has new blocks", value: "new" },
  { label: "Duplicates", value: "duplicate" },
  { label: "Warnings", value: "warning" },
  { label: "Errors", value: "error" },
] satisfies Array<{ label: string; value: ImportStatusFilter }>;

export function ImportPreviewTable({
  rows,
  selectedKeys,
  statusFilter,
  onSelectionChange,
  onStatusFilterChange,
}: ImportPreviewTableProps) {
  const [expandedRows, setExpandedRows] = useState<DataTableExpandedRows>({});
  const selectedRows = useMemo(() => rows.filter((row) => selectedKeys[row.rowKey]), [rows, selectedKeys]);

  function handleSelection(event: DataTableSelectionMultipleChangeEvent<ImportPreviewRow[]>): void {
    const selection = event.value as ImportPreviewRow[];
    onSelectionChange(Object.fromEntries(selection.filter((row) => !row.disabled).map((row) => [row.rowKey, true])));
  }

  return <>
    <label className="field">
      <span className="field__label">Status</span>
      <Dropdown
        className="mc-select"
        panelClassName="mc-select__popup"
        value={statusFilter}
        options={STATUS_OPTIONS}
        optionLabel="label"
        optionValue="value"
        filter
        filterPlaceholder="Filter statuses"
        aria-label="Filter imports by status"
        onChange={(event: DropdownChangeEvent) => onStatusFilterChange(event.value as ImportStatusFilter)}
      />
    </label>

    <DataTable
      className="mc-datatable"
      value={rows}
      dataKey="rowKey"
      selectionMode="multiple"
      selection={selectedRows}
      onSelectionChange={handleSelection}
      isDataSelectable={(event) => !event.data.disabled}
      expandedRows={expandedRows}
      onRowToggle={(event) => setExpandedRows(event.data as DataTableExpandedRows)}
      rowExpansionTemplate={(row: ImportPreviewRow) => <ExpandedBlocks row={row} />}
      paginator
      rows={10}
      rowsPerPageOptions={[10, 25, 50]}
      paginatorTemplate="RowsPerPageDropdown CurrentPageReport PrevPageLink PageLinks NextPageLink"
      currentPageReportTemplate="{first}–{last} of {totalRecords}"
      emptyMessage="No mods match these filters."
      stripedRows
      removableSort
      tableStyle={{ minWidth: "820px" }}
    >
      <Column expander className="mc-datatable__toggle-column" />
      <Column selectionMode="multiple" className="mc-datatable__select-column" />
      <Column field="modName" header="Mod" body={(row: ImportPreviewRow) => <><strong>{row.modName}</strong><small>{row.modId} · {row.modVersion}</small></>} />
      <Column field="fileName" header="File" />
      <Column field="newCount" header="New" body={(row: ImportPreviewRow) => <><strong>{row.newCount}</strong><small>new</small></>} />
      <Column field="duplicateCount" header="Duplicates" body={(row: ImportPreviewRow) => <><strong>{row.duplicateCount}</strong><small>duplicates</small></>} />
      <Column header="Status" body={(row: ImportPreviewRow) => <ImportStatus row={row} />} />
    </DataTable>
  </>;
}

function ExpandedBlocks({ row }: { row: ImportPreviewRow }) {
  const [visibleCount, setVisibleCount] = useState(50);
  const visibleBlocks = row.blocks.slice(0, visibleCount);

  return <div className="mc-datatable__blocks">
    {row.error && <p className="mc-datatable__message mc-datatable__message--error">{row.error}</p>}
    {row.warnings.map((warning) => <p className="mc-datatable__message" key={warning}>{warning}</p>)}
    {visibleBlocks.map((block) =>
      <div className="mc-datatable__block" key={block.itemIdentifier}>
        <strong>{block.name}</strong>
        <code>{block.itemIdentifier}</code>
      </div>)}
    {visibleCount < row.blocks.length &&
      <button type="button" onClick={() => setVisibleCount((current) => current + 50)}>
        Load 50 more ({row.blocks.length - visibleCount} remaining)
      </button>}
  </div>;
}

function ImportStatus({ row }: { row: ImportPreviewRow }) {
  if (row.error) return <span className="mc-datatable__status mc-datatable__status--error">Error</span>;
  if (row.exact) return <span className="mc-datatable__status">Imported</span>;
  if (row.warnings.length) return <span className="mc-datatable__status mc-datatable__status--warning">Warning</span>;
  return <span className="mc-datatable__status mc-datatable__status--ready">Ready</span>;
}
