import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { createProject, listProjects } from "./features/projects/projects.repository";
import type { ProjectModel } from "./models/project.model";

// Una prueba web no puede abrir el plugin nativo de SQLite. `vi.mock` reemplaza
// el repositorio completo por funciones controlables, manteniendo App intacto.
vi.mock("./features/projects/projects.repository", () => ({
  listProjects: vi.fn(),
  createProject: vi.fn(),
}));

const mockedListProjects = vi.mocked(listProjects);
const mockedCreateProject = vi.mocked(createProject);

const savedProject: ProjectModel = {
  id: 1,
  name: "Technical survival",
  baseWidthChunks: 3,
  baseHeightChunks: 3,
  survivalType: "vanilla",
  minecraftVersion: "",
  includeVanilla: true,
  createdAt: "2026-07-13 20:00:00",
  updatedAt: "2026-07-13 20:00:00",
};

describe("App project flow", () => {
  beforeEach(() => {
    // Arrange compartido: cada prueba comienza con una base vacía y mocks
    // limpios. `mockResolvedValue` imita una función async de SQLite.
    vi.clearAllMocks();
    mockedListProjects.mockResolvedValue([]);
  });

  it("shows the empty projects view after loading", async () => {
    // Arrange: renderizamos el componente que queremos observar.
    render(<App />);

    // Assert: findBy espera a que termine el useEffect que carga los proyectos.
    expect(await screen.findByRole("heading", { name: "Start your first plan" })).toBeInTheDocument();
    expect(mockedListProjects).toHaveBeenCalledOnce();
  });

  it("opens the dialog and requires a project name", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "Start your first plan" });

    // Act: userEvent reproduce una interacción más real que llamar onClick.
    await user.click(screen.getByRole("button", { name: "Create project" }));

    // Consultar por role y nombre accesible hace la prueba parecida a cómo una
    // persona con lector de pantalla encuentra los controles.
    const dialog = screen.getByRole("dialog", { name: "Create project" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Create project" })).toBeDisabled();

    await user.type(screen.getByRole("textbox", { name: "Project name" }), "My world");
    expect(within(dialog).getByRole("button", { name: "Create project" })).toBeEnabled();
  });

  it("persists a project and opens its planner", async () => {
    const user = userEvent.setup();
    mockedCreateProject.mockResolvedValue(savedProject);
    render(<App />);
    await screen.findByRole("heading", { name: "Start your first plan" });

    await user.click(screen.getByRole("button", { name: "Create project" }));
    await user.type(screen.getByRole("textbox", { name: "Project name" }), savedProject.name);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Create project" }));

    // Assert del resultado visible y de la frontera con SQLite: verificamos qué
    // ve el usuario y qué dato se envió al repositorio.
    expect(await screen.findByRole("heading", { name: "Base" })).toBeInTheDocument();
    expect(screen.getByText(savedProject.name)).toBeInTheDocument();
    expect(mockedCreateProject).toHaveBeenCalledWith({ name: savedProject.name, survivalType: "vanilla", minecraftVersion: "", includeVanilla: true });
  });
});
