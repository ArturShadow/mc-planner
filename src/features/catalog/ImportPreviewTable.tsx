import { DataTable } from "primereact/datatable";
import { Select } from "primereact/select";
import { type SyntheticEvent, useState } from "react";
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

interface SelectionRenderProps {
  isAllSelected: boolean;
  isSomeSelected: boolean;
  isSelected: boolean;
  toggleAll: (event: SyntheticEvent) => void;
  toggle: (event: SyntheticEvent) => void;
}

interface PaginationRenderProps {
  page: number;
  pageCount: number;
  rows: number;
  totalRecords: number;
  canPrev: boolean;
  canNext: boolean;
  onPageChange: (event: SyntheticEvent, page: number) => void;
  onRowsChange: (event: SyntheticEvent, rows: number) => void;
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
  return <>
    <label className="field">
      <span className="field__label">Status</span>
      <Select.Root
        className="mc-select"
        value={statusFilter}
        options={STATUS_OPTIONS}
        optionLabel="label"
        optionValue="value"
        filter
        ariaLabel="Filter imports by status"
        onValueChange={(event: { value: unknown }) => onStatusFilterChange(event.value as ImportStatusFilter)}
      >
        <Select.Trigger className="mc-select__trigger">
          <Select.Value />
          <Select.Indicator className="mc-select__indicator">
            <i className="pi pi-chevron-down" aria-hidden="true" />
          </Select.Indicator>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner className="mc-select__positioner">
            <Select.Popup className="mc-select__popup">
              <Select.Filter className="mc-select__filter" placeholder="Filter statuses" />
              <Select.List className="mc-select__list" />
              <Select.Empty className="mc-select__empty">No status found.</Select.Empty>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </label>

    <DataTable.Root
      className="mc-datatable"
      data={rows}
      dataKey="rowKey"
      selectionMode="multiple"
      selectionKeys={selectedKeys}
      onSelectionChange={(event: { value: Record<string, boolean> }) => onSelectionChange(event.value)}
      paginator
      defaultRows={10}
      rowsPerPageOptions={[10, 25, 50]}
      rowHover
    >
      <DataTable.TableContainer className="mc-datatable__container">
        <DataTable.Table className="mc-datatable__table">
          <DataTable.THead>
            <DataTable.THeadRow>
              <DataTable.THeadCell className="mc-datatable__toggle-column" aria-label="Expansion" />
              <DataTable.THeadCell className="mc-datatable__select-column">
                <DataTable.Selection>
                  {({ isAllSelected, isSomeSelected, toggleAll }: SelectionRenderProps) =>
                    <input
                      type="checkbox"
                      aria-label="Select all visible mods"
                      checked={isAllSelected}
                      ref={(element) => { if (element) element.indeterminate = isSomeSelected; }}
                      onChange={toggleAll}
                    />}
                </DataTable.Selection>
              </DataTable.THeadCell>
              <DataTable.THeadCell>Mod</DataTable.THeadCell>
              <DataTable.THeadCell>File</DataTable.THeadCell>
              <DataTable.THeadCell>New</DataTable.THeadCell>
              <DataTable.THeadCell>Duplicates</DataTable.THeadCell>
              <DataTable.THeadCell>Status</DataTable.THeadCell>
            </DataTable.THeadRow>
          </DataTable.THead>
          <DataTable.TBody>
            {({ item, index }) => {
              const row = item as unknown as ImportPreviewRow;
              return <>
                <DataTable.Row index={index} data-disabled={row.disabled || undefined}>
                  <DataTable.Cell className="mc-datatable__toggle-column">
                    <DataTable.RowToggle className="mc-datatable__toggle" aria-label={`Toggle blocks for ${row.modName}`}>
                      <DataTable.RowToggleIndicator match="collapsed"><i className="pi pi-chevron-right" aria-hidden="true" /></DataTable.RowToggleIndicator>
                      <DataTable.RowToggleIndicator match="expanded"><i className="pi pi-chevron-down" aria-hidden="true" /></DataTable.RowToggleIndicator>
                    </DataTable.RowToggle>
                  </DataTable.Cell>
                  <DataTable.Cell className="mc-datatable__select-column">
                    <DataTable.Selection mode="checkbox">
                      {({ isSelected, toggle }: SelectionRenderProps) =>
                        <input
                          type="checkbox"
                          aria-label={`Import ${row.modName}`}
                          checked={isSelected}
                          disabled={row.disabled}
                          onChange={toggle}
                        />}
                    </DataTable.Selection>
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <strong>{row.modName}</strong>
                    <small>{row.modId} · {row.modVersion}</small>
                  </DataTable.Cell>
                  <DataTable.Cell>{row.fileName}</DataTable.Cell>
                  <DataTable.Cell><strong>{row.newCount}</strong><small>new</small></DataTable.Cell>
                  <DataTable.Cell><strong>{row.duplicateCount}</strong><small>duplicates</small></DataTable.Cell>
                  <DataTable.Cell><ImportStatus row={row} /></DataTable.Cell>
                </DataTable.Row>
                <DataTable.RowExpansion>
                  <DataTable.Cell colSpan={7}>
                    <ExpandedBlocks row={row} />
                  </DataTable.Cell>
                </DataTable.RowExpansion>
              </>;
            }}
          </DataTable.TBody>
        </DataTable.Table>
      </DataTable.TableContainer>
      <DataTable.Pagination>
        {({ page, pageCount, rows: pageSize, totalRecords, canPrev, canNext, onPageChange, onRowsChange }: PaginationRenderProps) =>
          <div className="mc-datatable__pagination">
            <span>{totalRecords ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, totalRecords)} of ${totalRecords}` : "0 results"}</span>
            <label>
              <span>Rows</span>
              <select value={pageSize} onChange={(event) => onRowsChange(event, Number(event.target.value))}>
                {[10, 25, 50].map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <button type="button" aria-label="Previous page" disabled={!canPrev} onClick={(event) => onPageChange(event, page - 1)}><i className="pi pi-chevron-left" aria-hidden="true" /></button>
            <span>Page {pageCount ? page + 1 : 0} of {pageCount}</span>
            <button type="button" aria-label="Next page" disabled={!canNext} onClick={(event) => onPageChange(event, page + 1)}><i className="pi pi-chevron-right" aria-hidden="true" /></button>
          </div>}
      </DataTable.Pagination>
    </DataTable.Root>
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
