import { spawnSync } from "node:child_process";

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

// Revisão estável por build para a página offline (cache-bust do precache).
const revision =
  spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    encoding: "utf-8",
  }).stdout?.trim() || `${process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"}`;

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Pré-cacheia a página de fallback offline.
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  // O SW é gerado pelo webpack (`next build --webpack`); o dev usa Turbopack e
  // não precisa do SW (registro só roda em produção).
  disable: process.env.NODE_ENV !== "production",
  // Atualização controlada pelo app (prompt) — não recarrega sozinho.
  reloadOnOnline: false,
});

export default withSerwist(nextConfig);
