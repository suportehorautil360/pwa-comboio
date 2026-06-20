"use client";

import { useEffect } from "react";

/**
 * Último fallback: erro no próprio layout raiz. Substitui o documento inteiro,
 * então usa estilos inline (não dá pra contar com o CSS do app aqui). Mesma
 * recuperação de chunk do error.tsx, pra não "escapar" pro Safari no iOS.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const msg = `${error?.name ?? ""} ${error?.message ?? ""}`;
    const ehChunk =
      /ChunkLoadError|Loading chunk|dynamically imported|Importing a module|Failed to fetch/i.test(
        msg,
      );
    if (!ehChunk) return;
    try {
      const last = Number(sessionStorage.getItem("hu360-chunk-reload") ?? 0);
      if (Date.now() - last > 10_000) {
        sessionStorage.setItem("hu360-chunk-reload", String(Date.now()));
        window.location.reload();
      }
    } catch {
      /* ignora */
    }
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100svh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          background: "#0a0e17",
          color: "#e5e7eb",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: 24,
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
          Algo deu errado
        </h1>
        <p style={{ fontSize: 14, color: "#9ca3af", maxWidth: 320, margin: 0 }}>
          Não foi possível abrir o app. Recarregue — seus lançamentos salvos no
          aparelho não se perdem.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            background: "#f97316",
            color: "#0a0e17",
            border: "none",
            borderRadius: 10,
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Recarregar
        </button>
      </body>
    </html>
  );
}
