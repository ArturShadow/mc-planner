import Database from "@tauri-apps/plugin-sql";
import type { ProjectModel } from "../../models/project.model";

const DATABASE_URL = "sqlite:mc-planner.db";

interface ProjectRow {
  id: number;
  name: string;
  base_width_chunks: number;
  base_height_chunks: number;
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listProjects(): Promise<ProjectModel[]> {
  const database = await getDatabase();
  const rows = await database.select<ProjectRow[]>(
    "SELECT id, name, base_width_chunks, base_height_chunks, created_at, updated_at FROM projects ORDER BY updated_at DESC, id DESC",
  );
  return rows.map(mapProject);
}

export async function createProject(name: string): Promise<ProjectModel> {
  const database = await getDatabase();
  const result = await database.execute("INSERT INTO projects (name) VALUES ($1)", [name.trim()]);
  if (result.lastInsertId === undefined) throw new Error("SQLite did not return the created project id.");

  const rows = await database.select<ProjectRow[]>(
    "SELECT id, name, base_width_chunks, base_height_chunks, created_at, updated_at FROM projects WHERE id = $1",
    [result.lastInsertId],
  );
  if (!rows[0]) throw new Error("The created project could not be loaded.");
  return mapProject(rows[0]);
}
