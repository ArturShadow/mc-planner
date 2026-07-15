import Database from "@tauri-apps/plugin-sql";
import type { BaseAssignmentModel } from "../../models/base.model";

const DATABASE_URL = "sqlite:mc-planner.db";

interface AssignmentRow {
  id: number;
  project_id: number;
  process_id: number | null;
  chunk_x: number;
  chunk_y: number;
}

let databasePromise: Promise<Database> | undefined;

function getDatabase(): Promise<Database> {
  databasePromise ??= Database.load(DATABASE_URL);
  return databasePromise;
}

function mapAssignment(row: AssignmentRow): BaseAssignmentModel {
  return { id: row.id, projectId: row.project_id, processId: row.process_id, chunkX: row.chunk_x, chunkY: row.chunk_y };
}

export async function listBaseAssignments(projectId: number): Promise<BaseAssignmentModel[]> {
  const database = await getDatabase();
  const rows = await database.select<AssignmentRow[]>(
    "SELECT id, project_id, process_id, chunk_x, chunk_y FROM base_assignments WHERE project_id = $1 ORDER BY chunk_y, chunk_x",
    [projectId],
  );
  return rows.map(mapAssignment);
}

export async function assignChunk(projectId: number, processId: number, chunkX: number, chunkY: number): Promise<void> {
  const database = await getDatabase();
  await database.execute(
    `INSERT INTO base_assignments (project_id, process_id, chunk_x, chunk_y)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT(project_id, chunk_x, chunk_y) DO UPDATE SET process_id = excluded.process_id`,
    [projectId, processId, chunkX, chunkY],
  );
}

export async function assignProcessArea(
  projectId: number,
  processId: number,
  chunks: Array<{ chunkX: number; chunkY: number }>,
): Promise<void> {
  const database = await getDatabase();
  for (const { chunkX, chunkY } of chunks) {
    await database.execute(
      `INSERT INTO base_assignments (project_id, process_id, chunk_x, chunk_y)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT(project_id, chunk_x, chunk_y) DO UPDATE SET process_id = excluded.process_id`,
      [projectId, processId, chunkX, chunkY],
    );
  }
}

export async function clearChunk(projectId: number, chunkX: number, chunkY: number): Promise<void> {
  const database = await getDatabase();
  await database.execute(
    "DELETE FROM base_assignments WHERE project_id = $1 AND chunk_x = $2 AND chunk_y = $3",
    [projectId, chunkX, chunkY],
  );
}
