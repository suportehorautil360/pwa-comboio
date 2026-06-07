import { cn } from "@/lib/utils";

type FuelGaugeProps = {
  value: number;
  max: number;
  className?: string;
};

export function FuelGauge({ value, max, className }: FuelGaugeProps) {
  const percent = Math.min(100, Math.round((value / max) * 100));

  return (
    <div
      className={cn("h-2.5 w-full overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={`Nível do tanque: ${percent}%`}
    >
      <div
        className="h-full rounded-full bg-brand transition-all"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
