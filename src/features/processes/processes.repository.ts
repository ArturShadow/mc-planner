import Database from "@tauri-apps/plugin-sql";
import type { ProcessModel } from "../../models/process.model";

const DATABASE_URL = "sqlite:mc-planner.db";

interface ProcessRow {
  id: number;
  project_id: number;
  name: string;
  letter: string;
  color: string;
  width_chunks: number;
  height_chunks: number;
  layout_text: string;
  created_at: string;
  updated_at: string;
}

let databasePromise: Promise<Database> | undefined;

function getDatabase(): Promise<Database> {
  databasePromise ??= Database.load(DATABASE_URL);
  return databasePromise;
}

function mapProcess(row: ProcessRow): ProcessModel {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    letter: row.letter,
    color: row.color,
    widthChunks: row.width_chunks,
    heightChunks: row.height_chunks,
    layoutText: row.layout_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listProcesses(projectId: number): Promise<ProcessModel[]> {
  const database = await getDatabase();
  const rows = await database.select<ProcessRow[]>(
    `SELECT id, project_id, name, letter, color, width_chunks, height_chunks,
      layout_text, created_at, updated_at
     FROM processes WHERE project_id = $1 ORDER BY name, id`,
    [projectId],
  );
  return rows.map(mapProcess);
}
