"use client";

import { cn } from "@/lib/utils";

export type MeasurementType = "horimetro" | "hodometro";

type MeasurementToggleProps = {
  value: MeasurementType;
  onChange: (value: MeasurementType) => void;
};

const options: { value: MeasurementType; label: string }[] = [
  { value: "horimetro", label: "Horímetro" },
  { value: "hodometro", label: "Hodômetro (km)" },
];

export function MeasurementToggle({ value, onChange }: MeasurementToggleProps) {
  return (
    <div
      className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
      role="group"
      aria-label="Tipo de medição"
    >
      {options.map((option) => {
        const isActive = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={isActive}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
