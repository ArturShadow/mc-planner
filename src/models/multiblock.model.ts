import type { CatalogItemModel } from "./catalog.model";

export interface MultiblockRequirementModel {
  id: number;
  item: CatalogItemModel;
  quantity: number;
  role: string | null;
  notes: string | null;
}

export interface MultiblockModel {
  id: number;
  name: string;
  symbol: string;
  widthBlocks: number;
  depthBlocks: number;
  heightBlocks: number;
  canShareWalls: boolean;
  createdAt: string;
  updatedAt: string;
  requirements: MultiblockRequirementModel[];
}
