"use client";

import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";

import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Prompt de instalação do PWA. No Chromium captura o `beforeinstallprompt` e
 * mostra um botão; no iOS (Safari) mostra a instrução do "Adicionar à Tela de
 * Início". Some quando o app já está instalado (display-mode: standalone).
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [isIOS, setIsIOS] = useState(false);
  const [instalado, setInstalado] = useState(false);

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
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  if (instalado) return null;

  if (deferred) {
    return (
      <Button
        type="button"
        variant="outline"
        className="mt-6 gap-2"
        onClick={instalar}
      >
        <Download className="size-4" aria-hidden />
        Instalar app
      </Button>
    );
  }

  if (isIOS) {
    return (
      <p className="mt-6 max-w-xs text-center text-xs text-muted-foreground">
        Para instalar, toque em{" "}
        <Share className="inline size-3.5 align-text-bottom" aria-hidden /> e
        depois{" "}
        <span className="font-medium text-foreground">
          &quot;Adicionar à Tela de Início&quot;
        </span>
        .
      </p>
    );
  }

  return null;
}
