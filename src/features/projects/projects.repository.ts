import Database from "@tauri-apps/plugin-sql";
import type { ProjectModel } from "../../models/project.model";
import type { SurvivalType } from "../../models/project.model";

const DATABASE_URL = "sqlite:mc-planner.db";

interface ProjectRow {
  id: number;
  name: string;
  base_width_chunks: number;
  base_height_chunks: number;
  survival_type: SurvivalType;
  minecraft_version: string;
  include_vanilla: number;
  created_at: string;
  updated_at: string;
}

let databasePromise: Promise<Database> | undefined;

function getDatabase(): Promise<Database> {
  databasePromise ??= Database.load(DATABASE_URL);
  return databasePromise;
}

function mapProject(row: ProjectRow): ProjectModel {
  return {
    id: row.id,
    name: row.name,
    baseWidthChunks: row.base_width_chunks,
    baseHeightChunks: row.base_height_chunks,
    survivalType: row.survival_type,
    minecraftVersion: row.minecraft_version,
    includeVanilla: Boolean(row.include_vanilla),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listProjects(): Promise<ProjectModel[]> {
  const database = await getDatabase();
  const rows = await database.select<ProjectRow[]>(
    "SELECT id, name, base_width_chunks, base_height_chunks, survival_type, minecraft_version, include_vanilla, created_at, updated_at FROM projects ORDER BY updated_at DESC, id DESC",
  );
  return rows.map(mapProject);
}

export interface CreateProjectInput {
  name: string;
  survivalType: SurvivalType;
  minecraftVersion: string;
  includeVanilla: boolean;
}

export async function createProject(input: CreateProjectInput): Promise<ProjectModel> {
  const database = await getDatabase();
  const includeVanilla = input.survivalType === "modpack" ? input.includeVanilla : true;
  const result = await database.execute(
    "INSERT INTO projects (name, survival_type, minecraft_version, include_vanilla) VALUES ($1, $2, $3, $4)",
    [input.name.trim(), input.survivalType, input.minecraftVersion.trim(), includeVanilla ? 1 : 0],
  );
  if (result.lastInsertId === undefined) throw new Error("SQLite did not return the created project id.");

  const rows = await database.select<ProjectRow[]>(
    "SELECT id, name, base_width_chunks, base_height_chunks, survival_type, minecraft_version, include_vanilla, created_at, updated_at FROM projects WHERE id = $1",
    [result.lastInsertId],
  );
  if (!rows[0]) throw new Error("The created project could not be loaded.");
  return mapProject(rows[0]);
}

export async function updateProjectCatalogSettings(
  projectId: number,
  survivalType: SurvivalType,
  minecraftVersion: string,
  includeVanilla: boolean,
): Promise<void> {
  const database = await getDatabase();
  const effectiveIncludeVanilla = survivalType === "modpack" ? includeVanilla : true;
  await database.execute(
    `UPDATE projects SET survival_type = $1, minecraft_version = $2, include_vanilla = $3,
      updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
    [survivalType, minecraftVersion.trim(), effectiveIncludeVanilla ? 1 : 0, projectId],
  );
}

export async function resizeProjectBase(projectId: number, widthChunks: number, heightChunks: number): Promise<void> {
  const database = await getDatabase();
  await database.execute(
    "UPDATE projects SET base_width_chunks = $1, base_height_chunks = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3",
    [widthChunks, heightChunks, projectId],
  );
  await database.execute(
    "DELETE FROM base_assignments WHERE project_id = $1 AND (chunk_x >= $2 OR chunk_y >= $3)",
    [projectId, widthChunks, heightChunks],
  );
}
