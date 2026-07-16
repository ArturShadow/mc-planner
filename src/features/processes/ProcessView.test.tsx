import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectModel } from "../../models/project.model";
import { ProcessView } from "./ProcessView";
import { createPlacement, deletePlacement, listProcessPlacements } from "./process-placements.repository";
import { createProcess, listProcesses } from "./processes.repository";

vi.mock("../catalog/catalog.repository", () => ({
  listCompatibleCatalog: vi.fn().mockResolvedValue([{ id: 10, name: "Stone", modName: null, itemIdentifier: "minecraft:stone", category: "block", color: null, minecraftVersion: "1.21.1", sourceType: "vanilla", sourceId: null }]),
  listMultiblocks: vi.fn().mockResolvedValue([{ id: 20, name: "Water Pump", symbol: "WP", widthBlocks: 4, depthBlocks: 3, heightBlocks: 4, createdAt: "now", updatedAt: "now" }]),
}));
vi.mock("../projects/projects.repository", () => ({ updateProjectCatalogSettings: vi.fn() }));
vi.mock("./processes.repository", () => ({ listProcesses: vi.fn(), createProcess: vi.fn(), updateProcess: vi.fn(), deleteProcess: vi.fn() }));
vi.mock("./process-placements.repository", () => ({ listProcessPlacements: vi.fn(), createPlacement: vi.fn(), deletePlacement: vi.fn() }));

const project: ProjectModel = { id: 7, name: "Factory", baseWidthChunks: 3, baseHeightChunks: 3, survivalType: "vanilla", minecraftVersion: "1.21.1", includeVanilla: true, createdAt: "now", updatedAt: "now" };
const process = { id: 4, projectId: 7, name: "Steam", letter: "S", color: "#8fd694", widthChunks: 1, heightChunks: 1, layoutText: "", createdAt: "now", updatedAt: "now" };

describe("ProcessView", () => {
  beforeEach(() => {
    vi.mocked(listProcesses).mockResolvedValue([process]);
    vi.mocked(listProcessPlacements).mockResolvedValue([]);
    vi.mocked(createPlacement).mockResolvedValue(30);
    vi.mocked(deletePlacement).mockResolvedValue();
  });

  it("renders a 16 by 16 grid and the visual tool palette", async () => {
    const user = userEvent.setup();
    render(<ProcessView project={project} navigationRequest={{ processId: 4, nonce: 1 }} />);
    expect(await screen.findByRole("grid", { name: /16 by 16 block grid/ })).toBeInTheDocument();
    expect(screen.getAllByRole("gridcell")).toHaveLength(256);
    expect(screen.getByRole("toolbar", { name: "Process editing tools" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Select placement element" }));
    expect(screen.getByRole("region", { name: "Multiblocks" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Blocks" })).toBeInTheDocument();
  });

  it("places a selected multiblock using its complete footprint", async () => {
    const user = userEvent.setup();
    render(<ProcessView project={project} navigationRequest={{ processId: 4, nonce: 1 }} />);
    await user.click(await screen.findByRole("button", { name: "Select placement element" }));
    await user.click(screen.getByRole("option", { name: /Water Pump/ }));
    await user.click(screen.getByRole("gridcell", { name: "Block 2, 3: Empty" }));
    await waitFor(() => expect(createPlacement).toHaveBeenCalledWith(expect.objectContaining({ processId: 4, originX: 2, originZ: 3, widthBlocks: 4, depthBlocks: 3 })));
    expect(screen.getByRole("gridcell", { name: "Block 5, 5: Water Pump" })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: "Block 5, 5: Water Pump" })).toHaveTextContent("WP");
  });

  it("creates a rectangular process from the dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(listProcesses).mockResolvedValue([]);
    vi.mocked(createProcess).mockResolvedValue({ ...process, name: "Crusher", widthChunks: 2, heightChunks: 1 });
    render(<ProcessView project={project} />);
    await user.click(await screen.findByRole("button", { name: "Create process" }));
    await user.type(screen.getByLabelText("Name"), "Crusher");
    await user.clear(screen.getByLabelText("Width (chunks)"));
    await user.type(screen.getByLabelText("Width (chunks)"), "2");
    await user.click(screen.getByRole("button", { name: "Save process" }));
    await waitFor(() => expect(createProcess).toHaveBeenCalledWith(7, expect.objectContaining({ name: "Crusher", widthChunks: 2, heightChunks: 1 })));
  });

  it("shows process cards first and switches processes from the editor dropdown", async () => {
    const user = userEvent.setup();
    const second = { ...process, id: 5, name: "Storage" };
    vi.mocked(listProcesses).mockResolvedValue([process, second]);
    render(<ProcessView project={project} />);
    expect(await screen.findByRole("button", { name: /Steam/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Steam/ }));
    await user.selectOptions(screen.getByLabelText("Current process"), "5");
    expect(await screen.findByRole("grid", { name: /Storage 16 by 16/ })).toBeInTheDocument();
  });
});
