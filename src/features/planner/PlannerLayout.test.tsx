import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlannerLayout } from "./PlannerLayout";
import type { ProjectModel } from "../../models/project.model";

vi.mock("../processes/ProcessView", () => ({ ProcessView: () => <section><h2>Process editor</h2></section> }));

const project: ProjectModel = {
  id: 7,
  name: "Create Above and Beyond",
  baseWidthChunks: 3,
  baseHeightChunks: 3,
  survivalType: "vanilla",
  minecraftVersion: "",
  includeVanilla: true,
  createdAt: "2026-07-13 20:00:00",
  updatedAt: "2026-07-13 20:00:00",
};

describe("PlannerLayout navigation", () => {
  it("starts on Base and navigates between planner sections", async () => {
    const user = userEvent.setup();
    render(<PlannerLayout project={project} onCloseProject={vi.fn()} />);

    // Estado inicial: Base debe ser la página activa.
    expect(screen.getByRole("button", { name: "Base" })).toHaveAttribute("aria-current", "page");

    // Act + Assert: navegamos como usuario y comprobamos contenido y estado.
    await user.click(screen.getByRole("button", { name: "Processes" }));
    expect(screen.getByRole("heading", { name: "Process editor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Processes" })).toHaveAttribute("aria-current", "page");

    await user.click(screen.getByRole("button", { name: "Multiblocks" }));
    expect(screen.getByRole("heading", { name: "No multiblocks yet" })).toBeInTheDocument();
  });

  it("returns to the projects screen", async () => {
    const user = userEvent.setup();
    const onCloseProject = vi.fn();
    render(<PlannerLayout project={project} onCloseProject={onCloseProject} />);

    await user.click(screen.getByRole("button", { name: /All projects/ }));

    // Los callbacks se prueban como contratos: una interacción debe avisar al
    // componente padre exactamente una vez.
    expect(onCloseProject).toHaveBeenCalledOnce();
  });

  it("collapses the main menu to icon-only navigation", async () => {
    const user = userEvent.setup();
    render(<PlannerLayout project={project} onCloseProject={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Collapse main menu" }));
    expect(screen.queryByText("Current project")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand main menu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Base" })).toBeInTheDocument();
  });
});
