import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom simula el DOM del navegador dentro de Node. Así podemos renderizar
    // componentes React sin abrir una ventana real de Tauri.
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/test/**", "src/vite-env.d.ts", "src/main.tsx"],
    },
  },
});
