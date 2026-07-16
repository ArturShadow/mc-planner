export interface BaseAssignmentModel {
  id: number;
  projectId: number;
  processId: number | null;
  chunkX: number;
  chunkY: number;
  assignmentGroup: string | null;
}
