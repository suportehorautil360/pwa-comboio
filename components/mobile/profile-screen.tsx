"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Clock, LogOut, Truck, User } from "lucide-react";

import { SyncErrors } from "@/components/mobile/sync-errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { brand } from "@/lib/design-system";
import { useOutbox } from "@/lib/offline/use-outbox";
import { clearSession, getSessionUser, type SessionUser } from "@/lib/session";

const VERSAO = "0.1.0";

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const ini = (partes[0]?.[0] ?? "") + (partes[partes.length - 1]?.[0] ?? "");
  return ini.toUpperCase() || "?";
}

function Linha({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate font-medium">{value}</span>
    </div>
  );
}

export function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [online, setOnline] = useState(true);
  const { pendentes, falhos } = useOutbox();

  useEffect(() => {
    const u = getSessionUser();
    if (!u) {
      router.push("/");
      return;
    }
    queueMicrotask(() => setUser(u));
  }, [router]);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    queueMicrotask(sync);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  function sair() {
    if (
      pendentes > 0 &&
      !window.confirm(
        `Você tem ${pendentes} lançamento(s) ainda não sincronizado(s). Sair mesmo assim?`,
      )
    ) {
      return;
    }
    clearSession();
    router.push("/");
  }

  const syncLabel =
    falhos > 0
      ? `${falhos} com erro`
      : pendentes > 0
        ? `${pendentes} pendente${pendentes > 1 ? "s" : ""}`
        : "Tudo sincronizado";

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Conta
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
      </div>

      <Card className="ring-border/50">
        <CardContent className="flex items-center gap-4 pt-0">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand/15 text-lg font-bold text-brand ring-1 ring-brand/30">
            {user ? iniciais(user.nome) : <User className="size-6" aria-hidden />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">
              {user?.nome || "—"}
            </p>
            <p className="truncate text-sm capitalize text-muted-foreground">
              {user?.perfil || "Comboísta"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="ring-border/50">
        <CardContent className="divide-y divide-border pt-0">
          <Linha label="Login" value={user?.usuario || "—"} />
          <Linha label="Cargo" value={user?.perfil || "—"} />
          <Linha label="Conexão" value={online ? "Online" : "Offline"} />
          <Linha label="Sincronização" value={syncLabel} />
        </CardContent>
      </Card>

      <SyncErrors />

      <Link href="/meu-ponto" className="block">
        <Card className="ring-border/50 transition-colors hover:bg-muted/40">
          <CardContent className="flex items-center gap-3 pt-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/15 ring-1 ring-brand/30">
              <Clock className="size-5 text-brand" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Meu ponto</p>
              <p className="truncate text-xs text-muted-foreground">
                Batidas do dia, histórico e comprovantes
              </p>
            </div>
            <ChevronRight
              className="size-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </CardContent>
        </Card>
      </Link>

      <Card className="ring-border/50">
        <CardContent className="space-y-3 pt-0">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/15 ring-1 ring-brand/30">
              <Truck className="size-5 text-brand" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{brand.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                App de campo do comboista
              </p>
            </div>
          </div>
          <Linha label="Versão" value={`v${VERSAO}`} />
        </CardContent>
      </Card>

      <Button
        type="button"
        variant="outline"
        className="w-full gap-2 text-destructive hover:text-destructive"
        onClick={sair}
      >
        <LogOut className="size-4" aria-hidden />
        Sair
      </Button>
    </div>
  );
}
