export type CatalogCategory = "block" | "cable" | "pipe" | "tool";
export type CatalogSourceType = "vanilla" | "mod" | "manual";

export interface CatalogItemModel {
  id: number;
  name: string;
  modName: string | null;
  itemIdentifier: string | null;
  category: CatalogCategory;
  color: string | null;
  minecraftVersion: string | null;
  sourceType: CatalogSourceType;
  sourceId: string | null;
}

export interface CatalogImportEntry {
  name: string;
  itemIdentifier: string;
  category: CatalogCategory;
  color?: string;
}

export interface CatalogImportContract {
  sourceIdentifier: string;
  displayName: string;
  minecraftVersion: string;
  addsCatalogContent: boolean;
  entries: CatalogImportEntry[];
}

export interface ImportedBlockCandidate {
  name: string;
  itemIdentifier: string;
}

export interface JarAnalysis {
  path: string;
  fileName: string;
  contentHash: string;
  modId: string;
  modName: string;
  modVersion: string | null;
  blocks: ImportedBlockCandidate[];
  warnings: string[];
  error: string | null;
}

export interface CatalogSourceModel {
  id: number;
  sourceIdentifier: string;
  displayName: string;
  minecraftVersion: string | null;
  contentHash: string | null;
  modVersion: string | null;
  sourcePath: string | null;
  createdAt: string;
}
