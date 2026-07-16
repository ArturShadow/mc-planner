import Database from "@tauri-apps/plugin-sql";
import type { BaseAssignmentModel } from "../../models/base.model";

const DATABASE_URL = "sqlite:mc-planner.db";

interface AssignmentRow {
  id: number;
  project_id: number;
  process_id: number | null;
  chunk_x: number;
  chunk_y: number;
  assignment_group: string | null;
}

let databasePromise: Promise<Database> | undefined;

function getDatabase(): Promise<Database> {
  databasePromise ??= Database.load(DATABASE_URL);
  return databasePromise;
}

function mapAssignment(row: AssignmentRow): BaseAssignmentModel {
  return { id: row.id, projectId: row.project_id, processId: row.process_id, chunkX: row.chunk_x, chunkY: row.chunk_y, assignmentGroup: row.assignment_group };
}

export async function listBaseAssignments(projectId: number): Promise<BaseAssignmentModel[]> {
  const database = await getDatabase();
  const rows = await database.select<AssignmentRow[]>(
    "SELECT id, project_id, process_id, chunk_x, chunk_y, assignment_group FROM base_assignments WHERE project_id = $1 ORDER BY chunk_y, chunk_x",
    [projectId],
  );
  return rows.map(mapAssignment);
}

export async function assignChunk(projectId: number, processId: number, chunkX: number, chunkY: number): Promise<void> {
  const database = await getDatabase();
  await database.execute(
    `INSERT INTO base_assignments (project_id, process_id, chunk_x, chunk_y, assignment_group)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(project_id, chunk_x, chunk_y) DO UPDATE SET process_id = excluded.process_id, assignment_group = excluded.assignment_group`,
    [projectId, processId, chunkX, chunkY, `single:${projectId}:${chunkX}:${chunkY}:${Date.now()}`],
  );
}

export async function assignProcessArea(
  projectId: number,
  processId: number,
  chunks: Array<{ chunkX: number; chunkY: number }>,
): Promise<string> {
  const database = await getDatabase();
  const assignmentGroup = `process:${projectId}:${processId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  await database.execute("BEGIN IMMEDIATE");
  try {
    for (const { chunkX, chunkY } of chunks) {
      await database.execute(
        `INSERT INTO base_assignments (project_id, process_id, chunk_x, chunk_y, assignment_group)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT(project_id, chunk_x, chunk_y) DO UPDATE SET process_id = excluded.process_id, assignment_group = excluded.assignment_group`,
        [projectId, processId, chunkX, chunkY, assignmentGroup],
      );
    }
    await database.execute("COMMIT");
    return assignmentGroup;
  } catch (cause) {
    await database.execute("ROLLBACK");
    throw cause;
  }
}

export async function clearProcessAssignment(projectId: number, chunkX: number, chunkY: number): Promise<string | null> {
  const database = await getDatabase();
  const rows = await database.select<Array<{ assignment_group: string | null }>>(
    "SELECT assignment_group FROM base_assignments WHERE project_id = $1 AND chunk_x = $2 AND chunk_y = $3",
    [projectId, chunkX, chunkY],
  );
  const assignmentGroup = rows[0]?.assignment_group ?? null;
  if (assignmentGroup) {
    await database.execute("DELETE FROM base_assignments WHERE project_id = $1 AND assignment_group = $2", [projectId, assignmentGroup]);
  } else {
    await clearChunk(projectId, chunkX, chunkY);
  }
  return assignmentGroup;
}

export async function clearChunk(projectId: number, chunkX: number, chunkY: number): Promise<void> {
  const database = await getDatabase();
  await database.execute(
    "DELETE FROM base_assignments WHERE project_id = $1 AND chunk_x = $2 AND chunk_y = $3",
    [projectId, chunkX, chunkY],
  );
}
