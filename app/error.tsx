"use client";

import { useEffect } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Fallback in-app para erros de rota (inclui falha ao carregar o chunk da tela
 * — deploy novo / offline sem precache). Sem isso, no PWA standalone do iOS a
 * navegação "escapa" pro Safari. Em erro de chunk, recarrega 1x sozinho (com
 * trava por tempo) pra buscar a versão atual; senão, oferece recarregar.
 */
export default function RouteError({
  error,
  reset,
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
      /* sem sessionStorage — segue mostrando o botão */
    }
  }, [error]);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 ring-1 ring-destructive/30">
        <TriangleAlert className="size-7 text-destructive" aria-hidden />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">Algo deu errado</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          Não foi possível abrir esta tela. Tente recarregar — seus lançamentos
          salvos no aparelho não se perdem.
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="brand" onClick={() => reset()}>
          Tentar de novo
        </Button>
        <Button
          type="button"
          variant="outline"
          className="gap-1.5"
          onClick={() => window.location.reload()}
        >
          <RotateCw className="size-4" aria-hidden />
          Recarregar
        </Button>
      </div>
    </div>
  );
}
