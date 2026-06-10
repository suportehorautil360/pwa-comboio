"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { featureFlagsApi } from "@/lib/api/feature-flags";
import { jaBateuHoje } from "@/lib/ponto/ponto-dia";
import { getSessionUser } from "@/lib/session";

/**
 * Gate de ponto: quando a prefeitura tem o ponto ativo e o operador ainda não
 * bateu a entrada hoje, bloqueia o app e manda para /ponto. Envolve as telas
 * que rodam dentro do MobileShell (dashboard, abastecer, engraxar, etc.).
 *
 * Já bateu hoje? curto-circuita sem nem consultar a flag — economiza rede a
 * cada navegação. A verificação roda só no cliente (sessão + flag no browser).
 */
export function PontoGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [liberado, setLiberado] = useState(false);

  useEffect(() => {
    let vivo = true;
    const user = getSessionUser();
    if (!user) {
      router.replace("/");
      return;
    }
    // Já bateu a entrada hoje: libera direto, sem consultar a flag.
    if (jaBateuHoje(user)) {
      queueMicrotask(() => {
        if (vivo) setLiberado(true);
      });
      return;
    }
    void (async () => {
      const ativo = await featureFlagsApi.pontoAtivo(user.prefeituraId);
      if (!vivo) return;
      if (ativo) {
        router.replace("/ponto");
        return; // segue "não liberado" enquanto navega
      }
      setLiberado(true);
    })();
    return () => {
      vivo = false;
    };
  }, [router]);

  if (!liberado) {
    return (
      <div className="flex min-h-[60svh] items-center justify-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }

  return <>{children}</>;
}
