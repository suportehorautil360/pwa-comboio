import { WifiOff } from "lucide-react";

import { brand } from "@/lib/design-system";

export const metadata = {
  title: "Offline",
};

/**
 * Fallback de navegação quando a rota ainda não foi visitada e não há rede.
 * Pré-cacheada pelo Serwist (additionalPrecacheEntries em next.config).
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted ring-1 ring-border">
        <WifiOff className="size-7 text-muted-foreground" aria-hidden />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">Você está offline</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          Esta tela ainda não foi aberta com internet. Os lançamentos feitos
          agora ficam salvos no aparelho e sincronizam sozinhos quando a conexão
          voltar.
        </p>
      </div>
      <p className="text-xs text-muted-foreground/70">{brand.name}</p>
    </div>
  );
}
