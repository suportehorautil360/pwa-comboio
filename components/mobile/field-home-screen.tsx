import {
  ArrowDownToLine,
  Fuel,
  Sun,
} from "lucide-react";

import { ActionCard } from "@/components/mobile/action-card";
import { ActivityItem } from "@/components/mobile/activity-item";
import { FieldHeader } from "@/components/mobile/field-header";
import { FuelGauge } from "@/components/mobile/fuel-gauge";
import { SectionHeading } from "@/components/mobile/section-heading";
import { Card, CardContent } from "@/components/ui/card";

const tank = {
  label: "TANQUE DO COMBOIO",
  vehicle: "CMB-02 · MERCEDES ATEGO · PLACA RWX-4D21",
  current: 10_200,
  capacity: 15_000,
};

export function FieldHomeScreen() {
  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <FieldHeader />

      <Card className="ring-border/50">
        <CardContent className="space-y-4 pt-0">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {tank.label}
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {tank.vehicle}
            </p>
          </div>

          <FuelGauge value={tank.current} max={tank.capacity} />

          <div className="flex items-end justify-between gap-4">
            <p className="text-3xl font-semibold tabular-nums tracking-tight">
              {tank.current.toLocaleString("pt-BR")}{" "}
              <span className="text-lg font-medium text-muted-foreground">L</span>
            </p>
            <p className="pb-1 text-sm tabular-nums text-muted-foreground">
              de {tank.capacity.toLocaleString("pt-BR")} L
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
            icon={Sun}
            title="Engraxar"
            subtitle="Lubrificação de pontos"
          />
          <ActionCard
            icon={ArrowDownToLine}
            title="Reabastecer comboio"
            subtitle="Carga no posto/tanque"
          />
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading title="Últimos Lançamentos" />
        <div className="space-y-2">
          <ActivityItem
            icon={Fuel}
            code="ABC-1234"
            description="Escavadeira · 4.812 h"
            value="320 L"
            valueClassName="text-brand"
            time="14:20"
          />
          <ActivityItem
            icon={Sun}
            code="9BWZZZ377"
            description="Pá carregadeira · 4 pontos"
            value="engraxe"
            valueClassName="text-success"
            time="13:55"
          />
        </div>
      </section>
    </div>
  );
}
