import Database from "@tauri-apps/plugin-sql";
import type { CatalogCategory, CatalogSourceType } from "../../models/catalog.model";
import type { ProcessPlacement } from "../../models/process-placement.model";
import { mapCatalogItem, mapMultiblock } from "../catalog/catalog.repository";

const DATABASE_URL = "sqlite:mc-planner.db";

interface PlacementRow {
  id: number; process_id: number; placement_type: "catalog_item" | "multiblock";
  origin_x: number; origin_z: number; width_blocks: number; depth_blocks: number;
  item_id: number | null; item_name: string | null; mod_name: string | null;
  item_identifier: string | null; category: CatalogCategory | null; color: string | null;
  minecraft_version: string | null; source_type: CatalogSourceType | null; source_id: string | null;
  multiblock_id: number | null; multiblock_name: string | null; symbol: string | null;
  mb_width: number | null; mb_depth: number | null; mb_height: number | null;
  mb_created_at: string | null; mb_updated_at: string | null;
}

let databasePromise: Promise<Database> | undefined;
function getDatabase(): Promise<Database> {
  databasePromise ??= Database.load(DATABASE_URL);
  return databasePromise;
}

function mapPlacement(row: PlacementRow): ProcessPlacement {
  const base = { id: row.id, processId: row.process_id, originX: row.origin_x, originZ: row.origin_z, widthBlocks: row.width_blocks, depthBlocks: row.depth_blocks };
  if (row.placement_type === "catalog_item" && row.item_id !== null && row.item_name && row.category && row.source_type) {
    return { ...base, type: "catalog_item", item: mapCatalogItem({
      id: row.item_id, name: row.item_name, mod_name: row.mod_name, item_identifier: row.item_identifier,
      category: row.category, color: row.color, minecraft_version: row.minecraft_version,
      source_type: row.source_type, source_id: row.source_id,
    }) };
  }
  if (row.multiblock_id !== null && row.multiblock_name && row.symbol && row.mb_width && row.mb_depth && row.mb_height && row.mb_created_at && row.mb_updated_at) {
    return { ...base, type: "multiblock", multiblock: mapMultiblock({
      id: row.multiblock_id, name: row.multiblock_name, symbol: row.symbol,
      width_blocks: row.mb_width, depth_blocks: row.mb_depth, height_blocks: row.mb_height,
      created_at: row.mb_created_at, updated_at: row.mb_updated_at,
    }) };
  }
  throw new Error("A process placement references missing catalog data.");
}

export async function listProcessPlacements(processId: number): Promise<ProcessPlacement[]> {
  const database = await getDatabase();
  const rows = await database.select<PlacementRow[]>(
    `SELECT placement.*, item.name AS item_name, item.mod_name, item.item_identifier, item.category,
      item.color, item.minecraft_version, item.source_type, item.source_id,
      mb.name AS multiblock_name, mb.symbol, mb.width_blocks AS mb_width,
      mb.depth_blocks AS mb_depth, mb.height_blocks AS mb_height,
      mb.created_at AS mb_created_at, mb.updated_at AS mb_updated_at
     FROM process_placements placement
     LEFT JOIN item_catalog item ON item.id = placement.item_id
     LEFT JOIN multiblocks mb ON mb.id = placement.multiblock_id
     WHERE placement.process_id = $1 ORDER BY placement.origin_z, placement.origin_x, placement.id`, [processId],
  );
  return rows.map(mapPlacement);
}

export async function createPlacement(input: {
  processId: number; type: "catalog_item" | "multiblock"; referenceId: number;
  originX: number; originZ: number; widthBlocks: number; depthBlocks: number;
  limitWidthBlocks: number; limitDepthBlocks: number;
}): Promise<number> {
  if (input.originX < 0 || input.originZ < 0 || input.originX + input.widthBlocks > input.limitWidthBlocks || input.originZ + input.depthBlocks > input.limitDepthBlocks) {
    throw new Error("The selected element does not fit at that position.");
  }
  const database = await getDatabase();
  const collisions = await database.select<Array<{ count: number }>>(
    `SELECT COUNT(*) AS count FROM process_placements WHERE process_id = $1
      AND origin_x < $2 AND origin_x + width_blocks > $3
      AND origin_z < $4 AND origin_z + depth_blocks > $5`,
    [input.processId, input.originX + input.widthBlocks, input.originX, input.originZ + input.depthBlocks, input.originZ],
  );
  if ((collisions[0]?.count ?? 0) > 0) throw new Error("That area is already occupied.");
  const result = await database.execute(
    `INSERT INTO process_placements
      (process_id, placement_type, item_id, multiblock_id, origin_x, origin_z, width_blocks, depth_blocks)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [input.processId, input.type, input.type === "catalog_item" ? input.referenceId : null,
      input.type === "multiblock" ? input.referenceId : null, input.originX, input.originZ,
      input.widthBlocks, input.depthBlocks],
  );
  if (result.lastInsertId === undefined) throw new Error("SQLite did not return the placement id.");
  return result.lastInsertId;
}

export async function deletePlacement(id: number): Promise<void> {
  const database = await getDatabase();
  await database.execute("DELETE FROM process_placements WHERE id = $1", [id]);
}
