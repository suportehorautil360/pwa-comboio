"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Fuel, Sun } from "lucide-react";

import { ActivityItem } from "@/components/mobile/activity-item";
import { FieldHeader } from "@/components/mobile/field-header";
import { HistoryStatCard } from "@/components/mobile/history-stat-card";
import { type HistoricoSummary } from "@/lib/api/dashboard";
import { useHistorico } from "@/lib/data/queries";
import { useOutboxItems } from "@/lib/offline/use-outbox";
import { getSessionUser, type SessionUser } from "@/lib/session";

const RESUMO_VAZIO: HistoricoSummary = {
  totalLitersToday: 0,
  totalAbastecimentosToday: 0,
  totalEngraxeToday: 0,
};

export function HistoryScreen() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [online, setOnline] = useState(true);
  const pendentes = useOutboxItems();

  // Leitura offline-first: cache na hora, revalida em background.
  const { data, loading } = useHistorico(user?.prefeituraId);
  const summary = data?.summary ?? RESUMO_VAZIO;
  const groups = data?.groups ?? [];
  const nome = user?.nome ?? "";

  useEffect(() => {
    const u = getSessionUser();
    if (!u?.prefeituraId) {
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

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <FieldHeader nome={nome} online={online} />

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Do aparelho
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Histórico</h1>
      </div>

      <div className="flex gap-2">
        <HistoryStatCard
          value={summary.totalLitersToday.toLocaleString("pt-BR")}
          label="L hoje"
        />
        <HistoryStatCard
          value={String(summary.totalAbastecimentosToday)}
          label="Abastec."
        />
        <HistoryStatCard
          value={String(summary.totalEngraxeToday)}
          label="Engraxe"
          valueClassName="text-success"
        />
      </div>

      {pendentes.length > 0 && (
        <section className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Pendentes de envio
          </p>
          <div className="space-y-2">
            {pendentes.map((p) => (
              <ActivityItem
                key={`out-${p.id}`}
                icon={p.kind === "lubrificacao" ? Sun : Fuel}
                code={p.code}
                description={p.description}
                value={p.value}
                valueClassName={
                  p.status === "erro"
                    ? "text-destructive"
                    : "text-muted-foreground"
                }
                time={p.status === "erro" ? "erro" : "pendente"}
              />
            ))}
          </div>
        </section>
      )}

      {groups.length === 0 && pendentes.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">
          {loading ? "Carregando…" : "Nenhum lançamento ainda."}
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.dateLabel} className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {group.dateLabel}
            </p>
            <div className="space-y-2">
              {group.items.map((item) => {
                const ehEngraxe = item.tipo === "lubrificacao";
                return (
                  <ActivityItem
                    key={`${item.tipo}-${item.id}`}
                    icon={ehEngraxe ? Sun : Fuel}
                    code={item.plate}
                    description={item.equipmentLabel}
                    value={item.rightLabel}
                    valueClassName={ehEngraxe ? "text-success" : "text-brand"}
                    time={item.time}
                  />
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
