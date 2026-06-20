import { WifiOff } from "lucide-react";

import { brand } from "@/lib/design-system";

export const metadata = {
  title: "Offline",
};

/**
 * Fallback de navegação de último recurso (rota desconhecida ou SW ainda
 * instalando). As telas do app têm o documento pré-cacheado e abrem offline
 * normalmente — esta página raramente aparece. Pré-cacheada pelo Serwist
 * (additionalPrecacheEntries em next.config).
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted ring-1 ring-border">
        <WifiOff className="size-7 text-muted-foreground" aria-hidden />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">Sem conexão</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          Não foi possível carregar esta tela agora. Tente de novo — os
          lançamentos feitos no app ficam salvos no aparelho e sincronizam
          sozinhos quando a internet voltar.
        </p>
      </div>
      <p className="text-xs text-muted-foreground/70">{brand.name}</p>
    </div>
  );
}
