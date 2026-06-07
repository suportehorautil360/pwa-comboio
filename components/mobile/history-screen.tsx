import { Fuel, Sun } from "lucide-react";

import { ActivityItem } from "@/components/mobile/activity-item";
import { FieldHeader } from "@/components/mobile/field-header";
import { HistoryStatCard } from "@/components/mobile/history-stat-card";

const stats = [
  { value: "2.840", label: "L hoje" },
  { value: "11", label: "Abastec." },
  { value: "4", label: "Engraxe", valueClassName: "text-success" },
];

const todayActivities = [
  {
    icon: Fuel,
    code: "ABC-1234",
    description: "Escavadeira · 4.812 h",
    value: "320 L",
    valueClassName: "text-brand",
    time: "14:20",
  },
  {
    icon: Sun,
    code: "9BWZZZ377",
    description: "Pá carregadeira · 4 pontos",
    value: "engraxe",
    valueClassName: "text-success",
    time: "13:55",
  },
  {
    icon: Fuel,
    code: "DEF-5678",
    description: "Retroescavadeira · 2.104 h",
    value: "180 L",
    valueClassName: "text-brand",
    time: "11:30",
  },
  {
    icon: Fuel,
    code: "GHI-9012",
    description: "Caminhão · 89.420 km",
    value: "450 L",
    valueClassName: "text-brand",
    time: "09:15",
  },
];

export function HistoryScreen() {
  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <FieldHeader />

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Do aparelho
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Histórico</h1>
      </div>

      <div className="flex gap-2">
        {stats.map((stat) => (
          <HistoryStatCard
            key={stat.label}
            value={stat.value}
            label={stat.label}
            valueClassName={stat.valueClassName}
          />
        ))}
      </div>

      <section className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Hoje · 03 jun
        </p>
        <div className="space-y-2">
          {todayActivities.map((activity) => (
            <ActivityItem key={`${activity.code}-${activity.time}`} {...activity} />
          ))}
        </div>
      </section>
    </div>
  );
}
