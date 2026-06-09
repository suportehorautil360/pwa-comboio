"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, Fuel, Sun } from "lucide-react";

import { ActionCard } from "@/components/mobile/action-card";
import { ActivityItem } from "@/components/mobile/activity-item";
import { FieldHeader } from "@/components/mobile/field-header";
import { FuelGauge } from "@/components/mobile/fuel-gauge";
import { SectionHeading } from "@/components/mobile/section-heading";
import { Card, CardContent } from "@/components/ui/card";
import {
  getTanqueComboio,
  getUltimosLancamentos,
  type LancamentoItem,
  type TanqueComboio,
} from "@/lib/api/dashboard";
import { getSessionUser } from "@/lib/session";

function labelComboio(t: TanqueComboio): string {
  const partes = [
    t.name,
    t.veiculoModelo,
    t.veiculoPlaca ? `PLACA ${t.veiculoPlaca}` : "",
  ].filter(Boolean);
  if (partes.length > 1) return partes.join(" · ");
  return [t.name, t.fuelType].filter(Boolean).join(" · ") || "—";
}

export function FieldHomeScreen() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [tank, setTank] = useState<TanqueComboio | null>(null);
  const [lancamentos, setLancamentos] = useState<LancamentoItem[]>([]);
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
        const [t, l] = await Promise.all([
          getTanqueComboio(pid),
          getUltimosLancamentos(pid),
        ]);
        if (ativo) {
          setTank(t);
          setLancamentos(l);
        }
      } catch {
        /* mantém vazio em caso de erro */
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

      <Card className="ring-border/50">
        <CardContent className="space-y-4 pt-0">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              TANQUE DO COMBOIO
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {tank ? labelComboio(tank) : loading ? "Carregando…" : "Sem tanque cadastrado"}
            </p>
          </div>

          <FuelGauge
            value={tank?.currentVolume ?? 0}
            max={tank?.capacity ?? 0}
          />

          <div className="flex items-end justify-between gap-4">
            <p className="text-3xl font-semibold tabular-nums tracking-tight">
              {(tank?.currentVolume ?? 0).toLocaleString("pt-BR")}{" "}
              <span className="text-lg font-medium text-muted-foreground">
                L
              </span>
            </p>
            <p className="pb-1 text-sm tabular-nums text-muted-foreground">
              de {(tank?.capacity ?? 0).toLocaleString("pt-BR")} L
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <SectionHeading title="Registrar em Campo" />
        <ActionCard
          featured
          href="/abastecer"
          icon={Fuel}
          title="Abastecer equipamento"
          subtitle="Diesel · litros, horímetro ou km"
        />
        <div className="grid grid-cols-2 gap-3">
          <ActionCard
            href="/engraxar"
            icon={Sun}
            title="Engraxar"
            subtitle="Lubrificação de pontos"
          />
          <ActionCard
            icon={ArrowDownToLine}
            title="Reabastecer comboio"
            subtitle="Em breve"
          />
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading title="Últimos Lançamentos" />
        <div className="space-y-2">
          {lancamentos.length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">
              {loading ? "Carregando…" : "Nenhum lançamento ainda."}
            </p>
          ) : (
            lancamentos.map((l) => {
              const ehEngraxe = l.tipo === "lubrificacao";
              return (
                <ActivityItem
                  key={`${l.tipo}-${l.id}`}
                  icon={ehEngraxe ? Sun : Fuel}
                  code={l.plate}
                  description={l.equipmentLabel}
                  value={l.rightLabel}
                  valueClassName={ehEngraxe ? "text-success" : "text-brand"}
                  time={l.time}
                />
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
