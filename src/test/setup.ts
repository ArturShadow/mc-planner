import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library desmonta los componentes entre pruebas. Hacerlo de forma
// explícita evita que una prueba deje botones o diálogos para la siguiente.
afterEach(() => cleanup());
