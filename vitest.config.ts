import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mesmo alias do tsconfig (`@/*` → raiz). Sem ele, todo teste que importa
    // um módulo com `@/lib/...` falha ao carregar — e não roda.
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)).replace(/\/$/, "") },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "components/**/*.test.ts"],
  },
});
