"use client";

import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";

import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Botão "Instalar app" fixo. Ao clicar: dispara o diálogo nativo quando o
 * navegador disponibiliza (Chromium); senão revela as instruções (iOS ou menu
 * do navegador). Some apenas quando o app já está instalado (standalone).
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [isIOS, setIsIOS] = useState(false);
  const [instalado, setInstalado] = useState(false);
  const [ajuda, setAjuda] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      const ua = navigator.userAgent;
      setIsIOS(/iPad|iPhone|iPod/.test(ua) && !("MSStream" in window));
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      setInstalado(standalone);
    });

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalado(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function instalar() {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      return;
    }
    setAjuda((v) => !v);
  }

  if (instalado) return null;

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={instalar}
      >
        <Download className="size-4" aria-hidden />
        Instalar app
      </Button>
      {ajuda && (
        <p className="px-1 text-center text-xs text-muted-foreground">
          {isIOS ? (
            <>
              Toque em{" "}
              <Share
                className="inline size-3.5 align-text-bottom"
                aria-hidden
              />{" "}
              e depois{" "}
              <span className="font-medium text-foreground">
                &quot;Adicionar à Tela de Início&quot;
              </span>
              .
            </>
          ) : (
            <>
              No menu do navegador (⋮), escolha{" "}
              <span className="font-medium text-foreground">
                &quot;Instalar app&quot;
              </span>{" "}
              ou &quot;Adicionar à tela inicial&quot;.
            </>
          )}
        </p>
      )}
    </div>
  );
}
