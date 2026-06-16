"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { flushOutbox } from "@/lib/offline/outbox";

/**
 * Registra o service worker (/sw.js) — só em produção, pra não atrapalhar o
 * HMR do `next dev` (que usa Turbopack, sem o SW do Serwist). Habilita o
 * app-shell offline.
 *
 * Além do registro:
 * - detecta um SW novo "esperando" e mostra um prompt de atualização (o SW usa
 *   `skipWaiting: false`, então não troca os assets sob os pés do usuário);
 * - ouve `FLUSH_OUTBOX` do SW (Background Sync) e esvazia a fila na página,
 *   onde token + Dexie + api client estão disponíveis.
 */
export function ServiceWorkerRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const atualizandoRef = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const sw = navigator.serviceWorker;

    sw.register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        // Já existe um SW novo aguardando (atualização, não 1ª instalação).
        if (reg.waiting && sw.controller) setWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const novo = reg.installing;
          if (!novo) return;
          novo.addEventListener("statechange", () => {
            if (novo.state === "installed" && sw.controller) {
              setWaiting(reg.waiting ?? novo);
            }
          });
        });
      })
      .catch(() => undefined);

    // SW pede esvaziamento da outbox (rede voltou via Background Sync).
    const onMessage = (e: MessageEvent) => {
      if ((e.data as { type?: string } | null)?.type === "FLUSH_OUTBOX") {
        void flushOutbox();
      }
    };
    sw.addEventListener("message", onMessage);

    // Recarrega só quando FOI o usuário que pediu a atualização (evita reload
    // na 1ª instalação por causa do clientsClaim).
    const onControllerChange = () => {
      if (atualizandoRef.current) window.location.reload();
    };
    sw.addEventListener("controllerchange", onControllerChange);

    return () => {
      sw.removeEventListener("message", onMessage);
      sw.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  function atualizar() {
    atualizandoRef.current = true;
    waiting?.postMessage({ type: "SKIP_WAITING" });
    setWaiting(null);
  }

  if (!waiting) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-3 border-t border-border bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <p className="text-sm text-foreground">
        <span className="font-medium">Atualização disponível</span>
        <span className="block text-xs text-muted-foreground">
          Uma nova versão do app está pronta.
        </span>
      </p>
      <Button
        type="button"
        variant="brand"
        size="sm"
        className="gap-1.5"
        onClick={atualizar}
      >
        <RefreshCw className="size-4" aria-hidden />
        Atualizar
      </Button>
    </div>
  );
}
