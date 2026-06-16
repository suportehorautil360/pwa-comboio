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
import { FlashToast } from "@/components/mobile/flash-toast";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { type TanqueComboio } from "@/lib/api/dashboard";
import { useComboios, useUltimosLancamentos } from "@/lib/data/queries";
import { saldoPendenteDelta } from "@/lib/offline/pendentes";
import { useOutboxItems, useOutboxRaw } from "@/lib/offline/use-outbox";
import {
  getComboioSelecionado,
  getSessionUser,
  setComboioSelecionado,
  type SessionUser,
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
  const [user, setUser] = useState<SessionUser | null>(null);
  const [comboioId, setComboioId] = useState("");
  const [online, setOnline] = useState(true);
  const pendentes = useOutboxItems();

  // Leitura offline-first: comboios + últimos lançamentos cacheados.
  const { data: comboiosData, loading: loadingComboios } = useComboios(
    user?.prefeituraId,
    user?.funcionarioId,
  );
  const { data: lancData } = useUltimosLancamentos(user?.prefeituraId);
  const comboios = useMemo(() => comboiosData ?? [], [comboiosData]);
  const lancamentos = lancData ?? [];
  const nome = user?.nome ?? "";
  const loading = !user || loadingComboios;

  const comboioSel = useMemo(
    () => comboios.find((c) => c.id === comboioId) ?? null,
    [comboios, comboioId],
  );
  const tank = comboioSel?.tank ?? null;

  // Otimismo de UI: desconta/soma os lançamentos ainda na fila no saldo exibido
  // (atribuídos ao comboio do turno — o front não guarda comboioId por item).
  const raw = useOutboxRaw();
  const saldoDelta = useMemo(() => saldoPendenteDelta(raw), [raw]);
  const saldoLocal = Math.max(0, (tank?.currentVolume ?? 0) + saldoDelta);

  useEffect(() => {
    const u = getSessionUser();
    if (!u?.prefeituraId || !u.funcionarioId) {
      router.push("/");
      return;
    }
    queueMicrotask(() => setUser(u));
  }, [router]);

  // Seleciona o comboio (salvo ou primeiro) quando a lista chega.
  useEffect(() => {
    if (comboios.length === 0) return;
    queueMicrotask(() =>
      setComboioId((atual) => {
        if (atual && comboios.some((c) => c.id === atual)) return atual;
        const salvo = getComboioSelecionado();
        return (
          (salvo && comboios.some((c) => c.id === salvo) && salvo) ||
          comboios[0]?.id ||
          ""
        );
      }),
    );
  }, [comboios]);

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
      <FlashToast />
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

          <FuelGauge value={saldoLocal} max={tank?.capacity ?? 0} />

          <div className="flex items-end justify-between gap-4">
            <p className="text-3xl font-semibold tabular-nums tracking-tight">
              {saldoLocal.toLocaleString("pt-BR")}{" "}
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
