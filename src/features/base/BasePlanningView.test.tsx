import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProcessModel } from "../../models/process.model";
import type { ProjectModel } from "../../models/project.model";
import { listProcesses } from "../processes/processes.repository";
import { assignProcessArea, clearProcessAssignment, listBaseAssignments } from "./base.repository";
import { BasePlanningView } from "./BasePlanningView";
import { resizeProjectBase } from "../projects/projects.repository";

vi.mock("../processes/processes.repository", () => ({ listProcesses: vi.fn() }));
vi.mock("./base.repository", () => ({ listBaseAssignments: vi.fn(), assignProcessArea: vi.fn(), clearProcessAssignment: vi.fn() }));
vi.mock("../projects/projects.repository", () => ({ resizeProjectBase: vi.fn() }));

const project: ProjectModel = { id: 7, name: "Factory", baseWidthChunks: 3, baseHeightChunks: 3, survivalType: "vanilla", minecraftVersion: "", includeVanilla: true, createdAt: "", updatedAt: "" };
const process: ProcessModel = { id: 4, projectId: 7, name: "Ore processing", letter: "O", color: "#d6a84f", widthChunks: 1, heightChunks: 1, layoutText: "", createdAt: "", updatedAt: "" };

describe("BasePlanningView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listProcesses).mockResolvedValue([process]);
    vi.mocked(listBaseAssignments).mockResolvedValue([]);
    vi.mocked(assignProcessArea).mockResolvedValue("group-1");
    vi.mocked(clearProcessAssignment).mockResolvedValue("group-1");
    vi.mocked(resizeProjectBase).mockResolvedValue();
  });

  it("renders every project chunk and its occupancy summary", async () => {
    render(<BasePlanningView project={project} />);
    expect(await screen.findByRole("button", { name: "Chunk 2, 2: Unassigned" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Chunk \d, \d/ })).toHaveLength(9);
    expect(screen.getByText(/0 of 9 chunks assigned · maximum 20/)).toBeInTheDocument();
  });

  it("opens the process assigned to an occupied chunk", async () => {
    const user = userEvent.setup();
    const onOpenProcess = vi.fn();
    vi.mocked(listBaseAssignments).mockResolvedValue([{ id: 1, projectId: 7, processId: 4, chunkX: 1, chunkY: 0, assignmentGroup: "group-1" }]);
    render(<BasePlanningView project={project} onOpenProcess={onOpenProcess} />);
    await user.click(await screen.findByRole("button", { name: "Chunk 1, 0: Ore processing" }));
    await user.click(screen.getByRole("menuitem", { name: "Open Ore processing" }));
    expect(onOpenProcess).toHaveBeenCalledWith(4);
  });

  it("requests a new process from an empty chunk", async () => {
    const user = userEvent.setup();
    const onOpenProcess = vi.fn();
    render(<BasePlanningView project={project} onOpenProcess={onOpenProcess} />);
    await user.click(await screen.findByRole("button", { name: "Chunk 2, 2: Unassigned" }));
    await user.click(screen.getByRole("menuitem", { name: /Create new process/ }));
    expect(onOpenProcess).toHaveBeenCalledWith(null);
  });

  it("assigns a process from the chunk context menu", async () => {
    const user = userEvent.setup();
    render(<BasePlanningView project={project} />);
    await user.click(await screen.findByRole("button", { name: "Chunk 1, 0: Unassigned" }));
    await user.click(screen.getByRole("menuitem", { name: /Ore processing/ }));
    expect(assignProcessArea).toHaveBeenCalledWith(7, 4, [{ chunkX: 1, chunkY: 0 }]);
    expect(screen.getByRole("button", { name: "Chunk 1, 0: Ore processing" })).toBeInTheDocument();
  });

  it("clears every chunk in the same process assignment", async () => {
    const user = userEvent.setup();
    vi.mocked(listBaseAssignments).mockResolvedValue([
      { id: 1, projectId: 7, processId: 4, chunkX: 0, chunkY: 0, assignmentGroup: "group-1" },
      { id: 2, projectId: 7, processId: 4, chunkX: 1, chunkY: 0, assignmentGroup: "group-1" },
    ]);
    render(<BasePlanningView project={project} />);
    await user.click(await screen.findByRole("button", { name: "Chunk 1, 0: Ore processing" }));
    await user.click(screen.getByRole("menuitem", { name: "Clear assignment" }));
    expect(clearProcessAssignment).toHaveBeenCalledWith(7, 1, 0);
    expect(screen.getByRole("button", { name: "Chunk 0, 0: Unassigned" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chunk 1, 0: Unassigned" })).toBeInTheDocument();
  });

  it("prevents removing a row or column that contains a process", async () => {
    vi.mocked(listBaseAssignments).mockResolvedValue([
      { id: 1, projectId: 7, processId: 4, chunkX: 2, chunkY: 0, assignmentGroup: "right" },
      { id: 2, projectId: 7, processId: 4, chunkX: 0, chunkY: 2, assignmentGroup: "bottom" },
    ]);
    render(<BasePlanningView project={project} />);

    expect(await screen.findByRole("button", { name: "− Column" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "− Row" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "− Column" })).toHaveAttribute("title", expect.stringContaining("Clear the processes"));
  });

  it("adds and removes rows and columns while enforcing the size limits", async () => {
    const user = userEvent.setup();
    const onSizeChange = vi.fn();
    const { rerender } = render(<BasePlanningView project={project} onProjectBaseSizeChange={onSizeChange} />);

    await user.click(await screen.findByRole("button", { name: "＋ Column" }));
    expect(resizeProjectBase).toHaveBeenCalledWith(7, 4, 3);
    expect(onSizeChange).toHaveBeenCalledWith(4, 3);

    await user.click(screen.getByRole("button", { name: "− Row" }));
    expect(resizeProjectBase).toHaveBeenLastCalledWith(7, 3, 2);
    expect(onSizeChange).toHaveBeenLastCalledWith(3, 2);

    const twentyChunks = { ...project, baseWidthChunks: 5, baseHeightChunks: 4 };
    rerender(<BasePlanningView project={twentyChunks} onProjectBaseSizeChange={onSizeChange} />);
    expect(screen.getByRole("button", { name: "＋ Column" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "＋ Row" })).toBeDisabled();
    expect(screen.getByText(/maximum 20/)).toBeInTheDocument();

    const minimumBase = { ...project, baseWidthChunks: 1, baseHeightChunks: 1 };
    rerender(<BasePlanningView project={minimumBase} onProjectBaseSizeChange={onSizeChange} />);
    expect(screen.getByRole("button", { name: "− Column" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "− Row" })).toBeDisabled();
  });
});
