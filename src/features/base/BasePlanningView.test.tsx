import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProcessModel } from "../../models/process.model";
import type { ProjectModel } from "../../models/project.model";
import { listProcesses } from "../processes/processes.repository";
import { assignProcessArea, clearChunk, listBaseAssignments } from "./base.repository";
import { BasePlanningView } from "./BasePlanningView";
import { resizeProjectBase } from "../projects/projects.repository";

vi.mock("../processes/processes.repository", () => ({ listProcesses: vi.fn() }));
vi.mock("./base.repository", () => ({ listBaseAssignments: vi.fn(), assignProcessArea: vi.fn(), clearChunk: vi.fn() }));
vi.mock("../projects/projects.repository", () => ({ resizeProjectBase: vi.fn() }));

const project: ProjectModel = { id: 7, name: "Factory", baseWidthChunks: 3, baseHeightChunks: 3, createdAt: "", updatedAt: "" };
const process: ProcessModel = { id: 4, projectId: 7, name: "Ore processing", letter: "O", color: "#d6a84f", widthChunks: 1, heightChunks: 1, layoutText: "", createdAt: "", updatedAt: "" };

describe("BasePlanningView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listProcesses).mockResolvedValue([process]);
    vi.mocked(listBaseAssignments).mockResolvedValue([]);
    vi.mocked(assignProcessArea).mockResolvedValue();
    vi.mocked(clearChunk).mockResolvedValue();
    vi.mocked(resizeProjectBase).mockResolvedValue();
  });

  it("renders every project chunk and its occupancy summary", async () => {
    render(<BasePlanningView project={project} />);
    expect(await screen.findByRole("button", { name: "Chunk 2, 2: Unassigned" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Chunk \d, \d/ })).toHaveLength(9);
    expect(screen.getByText(/0 of 9 chunks assigned · maximum 20/)).toBeInTheDocument();
  });

  it("assigns and clears a chunk with optimistic feedback", async () => {
    const user = userEvent.setup();
    render(<BasePlanningView project={project} />);
    await user.click(await screen.findByRole("button", { name: "Chunk 1, 0: Unassigned" }));

    expect(screen.getByRole("button", { name: "Chunk 1, 0: Ore processing" })).toBeInTheDocument();
    expect(assignProcessArea).toHaveBeenCalledWith(7, 4, [{ chunkX: 1, chunkY: 0 }]);

    await user.click(screen.getByRole("button", { name: "⌫ Clear" }));
    await user.click(screen.getByRole("button", { name: "Chunk 1, 0: Ore processing" }));
    expect(screen.getByRole("button", { name: "Chunk 1, 0: Unassigned" })).toBeInTheDocument();
    expect(clearChunk).toHaveBeenCalledWith(7, 1, 0);
  });

  it("restores a chunk when saving fails", async () => {
    const user = userEvent.setup();
    vi.mocked(assignProcessArea).mockRejectedValueOnce(new Error("Database unavailable"));
    render(<BasePlanningView project={project} />);
    await user.click(await screen.findByRole("button", { name: "Chunk 0, 0: Unassigned" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Chunk 0, 0: Unassigned" })).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent("Database unavailable");
  });

  it("places a process across its complete chunk footprint", async () => {
    const user = userEvent.setup();
    const largeProcess = { ...process, id: 9, name: "Large factory", widthChunks: 2, heightChunks: 2 };
    vi.mocked(listProcesses).mockResolvedValue([largeProcess]);
    render(<BasePlanningView project={project} />);

    await user.click(await screen.findByRole("button", { name: "Chunk 0, 0: Unassigned" }));
    expect(assignProcessArea).toHaveBeenCalledWith(7, 9, [
      { chunkX: 0, chunkY: 0 }, { chunkX: 1, chunkY: 0 },
      { chunkX: 0, chunkY: 1 }, { chunkX: 1, chunkY: 1 },
    ]);
    expect(screen.getAllByRole("button", { name: /Chunk .*Large factory/ })).toHaveLength(4);
    expect(screen.getByText(/4 of 9 chunks assigned/)).toBeInTheDocument();
  });

  it("rejects a process footprint that extends outside the base", async () => {
    const user = userEvent.setup();
    vi.mocked(listProcesses).mockResolvedValue([{ ...process, widthChunks: 2, heightChunks: 2 }]);
    render(<BasePlanningView project={project} />);

    await user.click(await screen.findByRole("button", { name: "Chunk 2, 2: Unassigned" }));
    expect(assignProcessArea).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("does not fit there");
  });

  it("prevents removing a row or column that contains a process", async () => {
    vi.mocked(listBaseAssignments).mockResolvedValue([
      { id: 1, projectId: 7, processId: 4, chunkX: 2, chunkY: 0 },
      { id: 2, projectId: 7, processId: 4, chunkX: 0, chunkY: 2 },
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
