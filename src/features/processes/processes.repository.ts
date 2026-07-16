import Database from "@tauri-apps/plugin-sql";
import type { ProcessModel } from "../../models/process.model";
import { representativeSymbol } from "../../utils/representative-symbol";

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
    letter: representativeSymbol(row.name),
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

async function findProcess(id: number): Promise<ProcessModel> {
  const database = await getDatabase();
  const rows = await database.select<ProcessRow[]>(
    `SELECT id, project_id, name, letter, color, width_chunks, height_chunks,
      layout_text, created_at, updated_at FROM processes WHERE id = $1`, [id],
  );
  if (!rows[0]) throw new Error("The process could not be loaded.");
  return mapProcess(rows[0]);
}

export interface ProcessInput {
  name: string;
  color: string;
  widthChunks: number;
  heightChunks: number;
}

function validateInput(input: ProcessInput): void {
  if (!input.name.trim()) throw new Error("Process name is required.");
  if (!Number.isInteger(input.widthChunks) || input.widthChunks < 1 || !Number.isInteger(input.heightChunks) || input.heightChunks < 1) {
    throw new Error("Process dimensions must be positive whole numbers.");
  }
}

export async function createProcess(projectId: number, input: ProcessInput): Promise<ProcessModel> {
  validateInput(input);
  const database = await getDatabase();
  const result = await database.execute(
    `INSERT INTO processes (project_id, name, letter, color, width_chunks, height_chunks, layout_text)
     VALUES ($1, $2, $3, $4, $5, $6, '')`,
    [projectId, input.name.trim(), representativeSymbol(input.name), input.color, input.widthChunks, input.heightChunks],
  );
  if (result.lastInsertId === undefined) throw new Error("SQLite did not return the created process id.");
  return findProcess(result.lastInsertId);
}

export async function updateProcess(id: number, input: ProcessInput): Promise<ProcessModel> {
  validateInput(input);
  const database = await getDatabase();
  const maxWidthBlocks = input.widthChunks * 16;
  const maxDepthBlocks = input.heightChunks * 16;
  const outside = await database.select<Array<{ count: number }>>(
    `SELECT COUNT(*) AS count FROM process_placements
     WHERE process_id = $1 AND (origin_x + width_blocks > $2 OR origin_z + depth_blocks > $3)`,
    [id, maxWidthBlocks, maxDepthBlocks],
  );
  if ((outside[0]?.count ?? 0) > 0) throw new Error("Clear placements outside the new process size before shrinking it.");
  await database.execute(
    `UPDATE processes SET name = $1, letter = $2, color = $3, width_chunks = $4,
      height_chunks = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6`,
    [input.name.trim(), representativeSymbol(input.name), input.color, input.widthChunks, input.heightChunks, id],
  );
  return findProcess(id);
}

export async function deleteProcess(id: number): Promise<void> {
  const database = await getDatabase();
  await database.execute("DELETE FROM processes WHERE id = $1", [id]);
}
