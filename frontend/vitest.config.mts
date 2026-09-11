import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    server: {
      deps: {
        // Une seule instance React pour tout le graphe de test : les deps
        // externalisées (zustand, @base-ui, lucide…) obtiennent sinon une
        // copie distincte de react → dispatcher null dans les hooks.
        inline: ["use-sync-external-store", "zustand", /@base-ui/, "lucide-react"],
      },
    },
  },
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(import.meta.dirname, "./src") },
      // lucide-react est remplacé par un stub léger en test (icônes = svg vides).
      { find: /^lucide-react$/, replacement: path.resolve(import.meta.dirname, "./src/test/lucide-stub.tsx") },
      // Forcer toutes les résolutions de react/react-dom vers la copie racine.
      { find: /^react$/, replacement: path.resolve(import.meta.dirname, "./node_modules/react") },
      { find: /^react\/(.*)$/, replacement: path.resolve(import.meta.dirname, "./node_modules/react/$1") },
      { find: /^react-dom$/, replacement: path.resolve(import.meta.dirname, "./node_modules/react-dom") },
      { find: /^react-dom\/(.*)$/, replacement: path.resolve(import.meta.dirname, "./node_modules/react-dom/$1") },
    ],
  },
});
