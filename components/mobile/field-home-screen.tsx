"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, Fuel, Sun } from "lucide-react";

import { ActionCard } from "@/components/mobile/action-card";
import { ActivityItem } from "@/components/mobile/activity-item";
import { FieldHeader } from "@/components/mobile/field-header";
import { FuelGauge } from "@/components/mobile/fuel-gauge";
import { SectionHeading } from "@/components/mobile/section-heading";
import { Card, CardContent } from "@/components/ui/card";
import { ComboioSelect } from "@/components/mobile/comboio-select";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import {
  getUltimosLancamentos,
  type LancamentoItem,
  type TanqueComboio,
} from "@/lib/api/dashboard";
import { listarComboiosDoMotorista, type ComboioItem } from "@/lib/api/comboios";
import { useOutboxItems } from "@/lib/offline/use-outbox";
import {
  getComboioSelecionado,
  getSessionUser,
  setComboioSelecionado,
} from "@/lib/session";

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
  const [comboios, setComboios] = useState<ComboioItem[]>([]);
  const [comboioId, setComboioId] = useState("");
  const [lancamentos, setLancamentos] = useState<LancamentoItem[]>([]);
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const pendentes = useOutboxItems();

  const comboioSel = useMemo(
    () => comboios.find((c) => c.id === comboioId) ?? null,
    [comboios, comboioId],
  );
  const tank = comboioSel?.tank ?? null;

  useEffect(() => {
    const user = getSessionUser();
    if (!user?.prefeituraId || !user.funcionarioId) {
      router.push("/");
      return;
    }
    const pid = user.prefeituraId;
    const fid = user.funcionarioId;
    let ativo = true;
    void (async () => {
      if (ativo) setNome(user.nome);
      try {
        const [lista, l] = await Promise.all([
          listarComboiosDoMotorista(pid, fid),
          getUltimosLancamentos(pid),
        ]);
        if (!ativo) return;
        setComboios(lista);
        const salvo = getComboioSelecionado();
        setComboioId(
          (salvo && lista.some((c) => c.id === salvo) && salvo) ||
            lista[0]?.id ||
            "",
        );
        setLancamentos(l);
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

  function trocarComboio(id: string) {
    setComboioId(id);
    setComboioSelecionado(id);
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <FieldHeader nome={nome} online={online} />

      {comboios.length > 1 ? (
        <ComboioSelect
          comboios={comboios}
          value={comboioId}
          onChange={trocarComboio}
        />
      ) : null}

      <Card className="ring-border/50">
        <CardContent className="space-y-4 pt-0">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              TANQUE DO COMBOIO
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {tank
                ? labelComboio(tank)
                : loading
                  ? "Carregando…"
                  : "Nenhum comboio disponível"}
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
            href="/reabastecer"
            icon={ArrowDownToLine}
            title="Reabastecer comboio"
            subtitle="Carga no posto/tanque"
          />
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading title="Últimos Lançamentos" />
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
          {lancamentos.length === 0 && pendentes.length === 0 ? (
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

      <InstallPrompt />
    </div>
  );
}
