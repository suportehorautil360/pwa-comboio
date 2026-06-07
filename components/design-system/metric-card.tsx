import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: string | number;
  className?: string;
};

export function MetricCard({ label, value, className }: MetricCardProps) {
  return (
    <Card className={cn("bg-card ring-border/50", className)}>
      <CardContent className="flex flex-col gap-1 pt-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-3xl font-semibold tabular-nums tracking-tight">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
