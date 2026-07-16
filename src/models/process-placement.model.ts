import type { CatalogItemModel } from "./catalog.model";
import type { MultiblockModel } from "./multiblock.model";

interface PlacementBase {
  id: number;
  processId: number;
  originX: number;
  originZ: number;
  widthBlocks: number;
  depthBlocks: number;
}

export interface CatalogItemPlacement extends PlacementBase {
  type: "catalog_item";
  item: CatalogItemModel;
}

export interface MultiblockPlacement extends PlacementBase {
  type: "multiblock";
  multiblock: MultiblockModel;
}

export type ProcessPlacement = CatalogItemPlacement | MultiblockPlacement;
