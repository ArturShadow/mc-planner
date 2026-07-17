import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectModel } from "../../models/project.model";
import { CatalogView } from "./CatalogView";
import { createMultiblock, deleteMultiblock, importJarAnalyses, listCatalogIdentifiers, listCatalogSources, listCompatibleCatalog, listMultiblocks, updateMultiblock } from "./catalog.repository";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(), save: vi.fn() }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => ({ onDragDropEvent: vi.fn().mockResolvedValue(vi.fn()) }) }));
vi.mock("./catalog.repository", () => ({
  createMultiblock: vi.fn(), updateMultiblock: vi.fn(), deleteMultiblock: vi.fn(), importJarAnalyses: vi.fn(), listCatalogIdentifiers: vi.fn(), listCatalogSources: vi.fn(),
  listCompatibleCatalog: vi.fn(), listMultiblocks: vi.fn(),
}));

const project: ProjectModel = { id: 1, name: "Pack", baseWidthChunks: 1, baseHeightChunks: 1, survivalType: "modpack", minecraftVersion: "1.20.1", includeVanilla: true, createdAt: "now", updatedAt: "now" };

describe("CatalogView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listCompatibleCatalog).mockResolvedValue([]);
    vi.mocked(listMultiblocks).mockResolvedValue([]);
    vi.mocked(listCatalogSources).mockResolvedValue([]);
    vi.mocked(listCatalogIdentifiers).mockResolvedValue(["example:old_machine"]);
    vi.mocked(open).mockResolvedValue(["C:\\mods\\example.jar"]);
    vi.mocked(invoke).mockImplementation((command) => command === "collect_mod_jar_paths"
      ? Promise.resolve(["C:\\mods\\example.jar"])
      : Promise.resolve([{ path: "C:\\mods\\example.jar", fileName: "example.jar", contentHash: "abc", modId: "example", modName: "Example Mod", modVersion: "1.0", warnings: [], error: null, blocks: [{ name: "Old Machine", itemIdentifier: "example:old_machine", category: "block" }, { name: "New Machine", itemIdentifier: "example:new_machine", category: "block" }] }])) as typeof invoke;
    vi.mocked(importJarAnalyses).mockResolvedValue(1);
    vi.mocked(createMultiblock).mockResolvedValue();
    vi.mocked(updateMultiblock).mockResolvedValue();
    vi.mocked(deleteMultiblock).mockResolvedValue();
  });

  it("previews new and duplicate blocks before importing", async () => {
    const user = userEvent.setup();
    render(<CatalogView project={project} />);
    await user.click(screen.getByRole("button", { name: "Select JAR files" }));
    expect(await screen.findByRole("heading", { name: "Import preview" })).toBeInTheDocument();
    expect(screen.getByText("1 new block selected")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Expand / }));
    expect(screen.getByText("example:new_machine")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Import selected" }));
    await waitFor(() => expect(importJarAnalyses).toHaveBeenCalledWith(project, [expect.objectContaining({ modId: "example" })]));
    expect(await screen.findByText("1 new block imported.")).toBeInTheDocument();
  });

  it("marks an identical JAR as already imported and disables it", async () => {
    vi.mocked(listCatalogSources).mockResolvedValue([{ id: 1, sourceIdentifier: "example", displayName: "Example Mod", minecraftVersion: "1.20.1", contentHash: "abc", modVersion: "1.0", sourcePath: null, createdAt: "now" }]);
    const user = userEvent.setup();
    render(<CatalogView project={project} />);
    await user.click(screen.getByRole("button", { name: "Select JAR files" }));
    expect(await screen.findByText("Imported")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox").some((checkbox) => checkbox.hasAttribute("disabled"))).toBe(true);
  });

  it("creates a multiblock with manually selected block quantities", async () => {
    vi.mocked(listCompatibleCatalog).mockResolvedValue([
      { id: 10, name: "Primitive Blast Furnace", modName: "GregTech", itemIdentifier: "gtceu:primitive_blast_furnace", category: "block", color: null, minecraftVersion: "1.20.1", sourceType: "mod", sourceId: "gtceu" },
      { id: 11, name: "Firebricks", modName: "GregTech", itemIdentifier: "gtceu:firebricks", category: "block", color: null, minecraftVersion: "1.20.1", sourceType: "mod", sourceId: "gtceu" },
    ]);
    const user = userEvent.setup();
    render(<CatalogView project={project} />);
    await user.click(await screen.findByRole("button", { name: "New multiblock" }));
    await user.type(screen.getByLabelText("Name"), "Primitive Blast Furnace");
    await user.click(screen.getByRole("checkbox", { name: /Allow shared walls/ }));
    await user.click(screen.getByLabelText("Block")); await user.type(screen.getByLabelText("Block"), "Primitive");
    await user.click(screen.getByRole("option", { name: /Primitive Blast Furnace/ }));
    await user.click(screen.getByRole("button", { name: "Add block" }));
    const blockSelectors = screen.getAllByLabelText("Block");
    await user.click(blockSelectors[1]); await user.type(blockSelectors[1], "Firebricks");
    await user.click(screen.getByRole("option", { name: /Firebricks/ }));
    const quantities = screen.getAllByLabelText("Quantity");
    fireEvent.change(quantities[1], { target: { value: "32" } });
    await user.click(screen.getByRole("button", { name: "Create multiblock" }));
    await waitFor(() => expect(createMultiblock).toHaveBeenCalledWith(expect.objectContaining({
      name: "Primitive Blast Furnace", canShareWalls: true, requirements: [{ itemId: 10, quantity: 1 }, { itemId: 11, quantity: 32 }],
    })));
  });

  it("updates and deletes an existing multiblock", async () => {
    const controller = { id: 10, name: "Controller", modName: "GregTech", itemIdentifier: "gtceu:controller", category: "block" as const, color: null, minecraftVersion: "1.20.1", sourceType: "mod" as const, sourceId: "gtceu" };
    vi.mocked(listCompatibleCatalog).mockResolvedValue([controller]);
    vi.mocked(listMultiblocks).mockResolvedValue([{ id: 20, name: "Blast Furnace", symbol: "B", widthBlocks: 3, depthBlocks: 3, heightBlocks: 4, canShareWalls: false, createdAt: "now", updatedAt: "now", requirements: [{ id: 30, item: controller, quantity: 1, role: null, notes: null }] }]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<CatalogView project={project} />);
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    expect(screen.getByRole("heading", { name: "Edit multiblock" })).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Name")); await user.type(screen.getByLabelText("Name"), "Updated Furnace");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(updateMultiblock).toHaveBeenCalledWith(20, expect.objectContaining({ name: "Updated Furnace" })));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(deleteMultiblock).toHaveBeenCalledWith(20));
  });
});
