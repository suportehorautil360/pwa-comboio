"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Fuel, Sun } from "lucide-react";

import { ActivityItem } from "@/components/mobile/activity-item";
import { FieldHeader } from "@/components/mobile/field-header";
import { HistoryStatCard } from "@/components/mobile/history-stat-card";
import {
  getHistorico,
  type HistoricoGroup,
  type HistoricoSummary,
} from "@/lib/api/dashboard";
import { getSessionUser } from "@/lib/session";

const RESUMO_VAZIO: HistoricoSummary = {
  totalLitersToday: 0,
  totalAbastecimentosToday: 0,
  totalEngraxeToday: 0,
};

export function HistoryScreen() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [summary, setSummary] = useState<HistoricoSummary>(RESUMO_VAZIO);
  const [groups, setGroups] = useState<HistoricoGroup[]>([]);
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getSessionUser();
    if (!user?.prefeituraId) {
      router.push("/");
      return;
    }
    const pid = user.prefeituraId;
    let ativo = true;
    void (async () => {
      if (ativo) setNome(user.nome);
      try {
        const h = await getHistorico(pid);
        if (ativo) {
          setSummary(h.summary);
          setGroups(h.groups);
        }
      } catch {
        /* mantém vazio */
      } finally {
        if (ativo) setLoading(false);
      }
    })();
    return () => {
      ativo = false;
    };
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

      {groups.length === 0 ? (
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
