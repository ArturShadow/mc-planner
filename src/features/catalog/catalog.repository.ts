import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";
import type { CatalogCategory, CatalogItemModel, CatalogSourceModel, CatalogSourceType, JarAnalysis } from "../../models/catalog.model";
import type { MultiblockModel } from "../../models/multiblock.model";
import type { ProjectModel } from "../../models/project.model";
import { representativeSymbol } from "../../utils/representative-symbol";

const DATABASE_URL = "sqlite:mc-planner.db";

interface CatalogItemRow {
  id: number; name: string; mod_name: string | null; item_identifier: string | null;
  category: CatalogCategory; color: string | null; minecraft_version: string | null;
  source_type: CatalogSourceType; source_id: string | null;
}

interface MultiblockRow {
  id: number; name: string; symbol: string; width_blocks: number;
  depth_blocks: number; height_blocks: number; can_share_walls?: number; created_at: string; updated_at: string;
}

interface MultiblockRequirementRow extends CatalogItemRow {
  requirement_id: number; multiblock_id: number; quantity: number; role: string | null; notes: string | null;
}

export interface CreateMultiblockInput {
  name: string;
  widthBlocks: number;
  depthBlocks: number;
  heightBlocks: number;
  canShareWalls: boolean;
  requirements: Array<{ itemId: number; quantity: number }>;
}

interface CatalogSourceRow {
  id: number; source_identifier: string; display_name: string; minecraft_version: string | null;
  content_hash: string | null; mod_version: string | null; source_path: string | null; created_at: string;
}

let databasePromise: Promise<Database> | undefined;
function getDatabase(): Promise<Database> {
  databasePromise ??= Database.load(DATABASE_URL);
  return databasePromise;
}

export function mapCatalogItem(row: CatalogItemRow): CatalogItemModel {
  return {
    id: row.id, name: row.name, modName: row.mod_name, itemIdentifier: row.item_identifier,
    category: row.category, color: row.color, minecraftVersion: row.minecraft_version,
    sourceType: row.source_type, sourceId: row.source_id,
  };
}

export function mapMultiblock(row: MultiblockRow): MultiblockModel {
  return {
    id: row.id, name: row.name, symbol: representativeSymbol(row.name), widthBlocks: row.width_blocks,
    depthBlocks: row.depth_blocks, heightBlocks: row.height_blocks, canShareWalls: row.can_share_walls === 1,
    createdAt: row.created_at, updatedAt: row.updated_at, requirements: [],
  };
}

export async function listCompatibleCatalog(project: ProjectModel): Promise<CatalogItemModel[]> {
  const database = await getDatabase();
  const rows = await database.select<CatalogItemRow[]>(
    `SELECT id, name, mod_name, item_identifier, category, color, minecraft_version, source_type, source_id
     FROM item_catalog item
     WHERE category IN ('block', 'cable', 'pipe', 'tool') AND (
       (source_type = 'vanilla' AND $1 = 1 AND (minecraft_version IS NULL OR minecraft_version = $2)) OR
       (source_type = 'mod' AND EXISTS (
         SELECT 1 FROM catalog_sources source
         WHERE source.project_id = $3 AND source.source_type = 'mod'
           AND source.source_identifier = item.source_id AND source.adds_catalog_content = 1
       )) OR source_type = 'manual'
     ) ORDER BY category, name COLLATE NOCASE, id`,
    [project.includeVanilla ? 1 : 0, project.minecraftVersion, project.id],
  );
  return rows.map(mapCatalogItem);
}

export async function listMultiblocks(): Promise<MultiblockModel[]> {
  const database = await getDatabase();
  const [rows, requirements] = await Promise.all([database.select<MultiblockRow[]>(
    `SELECT id, name, symbol, width_blocks, depth_blocks, height_blocks, can_share_walls, created_at, updated_at
     FROM multiblocks ORDER BY name COLLATE NOCASE, id`,
  ), database.select<MultiblockRequirementRow[]>(
    `SELECT requirement.id AS requirement_id, requirement.multiblock_id, requirement.quantity, requirement.role, requirement.notes,
       item.id, item.name, item.mod_name, item.item_identifier, item.category, item.color,
       item.minecraft_version, item.source_type, item.source_id
     FROM multiblock_requirements requirement
     JOIN item_catalog item ON item.id = requirement.item_id
     ORDER BY item.name COLLATE NOCASE`,
  )]);
  return rows.map((row) => ({ ...mapMultiblock(row), requirements: requirements
    .filter((requirement) => requirement.multiblock_id === row.id)
    .map((requirement) => ({
      id: requirement.requirement_id, item: mapCatalogItem(requirement), quantity: requirement.quantity,
      role: requirement.role, notes: requirement.notes,
    })) }));
}

export async function createMultiblock(input: CreateMultiblockInput): Promise<void> {
  await invoke("create_multiblock_atomic", { input });
}

export async function updateMultiblock(id: number, input: CreateMultiblockInput): Promise<void> {
  await invoke("update_multiblock_atomic", { id, input });
}

export async function deleteMultiblock(id: number): Promise<void> {
  const database = await getDatabase();
  await database.execute("DELETE FROM multiblocks WHERE id = $1", [id]);
}

export async function listCatalogSources(projectId: number): Promise<CatalogSourceModel[]> {
  const database = await getDatabase();
  const rows = await database.select<CatalogSourceRow[]>(
    `SELECT id, source_identifier, display_name, minecraft_version, content_hash, mod_version, source_path, created_at
     FROM catalog_sources WHERE project_id = $1 AND source_type = 'mod'
     ORDER BY display_name COLLATE NOCASE`, [projectId],
  );
  return rows.map((row) => ({
    id: row.id, sourceIdentifier: row.source_identifier, displayName: row.display_name,
    minecraftVersion: row.minecraft_version, contentHash: row.content_hash, modVersion: row.mod_version,
    sourcePath: row.source_path, createdAt: row.created_at,
  }));
}

export async function listCatalogIdentifiers(): Promise<string[]> {
  const database = await getDatabase();
  const rows = await database.select<Array<{ item_identifier: string }>>(
    "SELECT item_identifier FROM item_catalog WHERE item_identifier IS NOT NULL",
  );
  return rows.map((row) => row.item_identifier);
}

export async function importJarAnalyses(project: ProjectModel, analyses: JarAnalysis[]): Promise<number> {
  return invoke<number>("import_catalog_jars", {
    projectId: project.id, minecraftVersion: project.minecraftVersion, analyses,
  });
}
