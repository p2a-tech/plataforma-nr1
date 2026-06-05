import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      // Stub do `server-only` para que lib/pgr.ts importe sem lançar em Node.
      "server-only": fileURLToPath(
        new URL("./test/stubs/empty.ts", import.meta.url),
      ),
      // Subpaths do pacote de contratos ANTES do prefixo base, para casar primeiro.
      "@previa/contracts/signing": fileURLToPath(
        new URL("./packages/contracts/src/signing.ts", import.meta.url),
      ),
      "@previa/contracts": fileURLToPath(
        new URL("./packages/contracts/src/index.ts", import.meta.url),
      ),
      // Alias `@` → raiz do repo (espelha tsconfig paths "@/*": ["./*"]).
      "@": rootDir,
    },
  },
});
