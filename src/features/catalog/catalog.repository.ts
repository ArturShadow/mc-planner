import Database from "@tauri-apps/plugin-sql";
import type { CatalogCategory, CatalogItemModel, CatalogSourceType } from "../../models/catalog.model";
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
  depth_blocks: number; height_blocks: number; created_at: string; updated_at: string;
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
    depthBlocks: row.depth_blocks, heightBlocks: row.height_blocks,
    createdAt: row.created_at, updatedAt: row.updated_at,
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
  const rows = await database.select<MultiblockRow[]>(
    `SELECT id, name, symbol, width_blocks, depth_blocks, height_blocks, created_at, updated_at
     FROM multiblocks ORDER BY name COLLATE NOCASE, id`,
  );
  return rows.map(mapMultiblock);
}
