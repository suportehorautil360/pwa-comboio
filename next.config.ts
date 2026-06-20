import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O @serwist/next injeta uma config `webpack`. No Next 16 o `next dev` roda
  // Turbopack por padrão e ABORTA quando vê webpack sem turbopack. Este marcador
  // vazio diz "Turbopack é intencional no dev" e silencia o erro. O SW continua
  // sendo gerado só no build (`next build --webpack`); o dev não precisa dele.
  turbopack: {},
  async headers() {
    return [
      {
        // O service worker não pode ser cacheado, senão atualizações não chegam.
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

// Revisão estável por build para as páginas pré-cacheadas (cache-bust do precache).
const revision =
  spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    encoding: "utf-8",
  }).stdout?.trim() || `${process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"}`;

/**
 * Enumera as rotas de nível superior do App Router (cada pasta `app/<rota>` com
 * `page.tsx`) + a raiz. São telas estáticas (dados vêm do Dexie no cliente),
 * então o documento de cada uma pode ser pré-cacheado — assim QUALQUER tela abre
 * offline mesmo que nunca tenha sido acessada online. Exclui rotas especiais, o
 * fallback `/~offline` e o `design-system` (só dev).
 */
function collectAppRoutes(): string[] {
  const appDir = join(process.cwd(), "app");
  const routes = ["/"]; // página raiz (login)
  for (const entry of readdirSync(appDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    if (/^[_(@.~]/.test(name) || name === "design-system") continue;
    if (existsSync(join(appDir, name, "page.tsx"))) routes.push(`/${name}`);
  }
  return routes;
}

const offlineRoutes = collectAppRoutes();

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  additionalPrecacheEntries: [
    // Página de fallback offline (último recurso).
    { url: "/~offline", revision },
    // Documento de todas as telas → abrem offline sem visita prévia online.
    ...offlineRoutes.map((url) => ({ url, revision })),
  ],
  // O SW é gerado pelo webpack (`next build --webpack`); o dev usa Turbopack e
  // não precisa do SW (registro só roda em produção).
  disable: process.env.NODE_ENV !== "production",
  // Atualização controlada pelo app (prompt) — não recarrega sozinho.
  reloadOnOnline: false,
});

export default withSerwist(nextConfig);
