export type SurvivalType = "vanilla" | "technical_vanilla" | "modpack";

export interface ProjectModel {
  id: number;
  name: string;
  baseWidthChunks: number;
  baseHeightChunks: number;
  survivalType: SurvivalType;
  minecraftVersion: string;
  includeVanilla: boolean;
  createdAt: string;
  updatedAt: string;
}
