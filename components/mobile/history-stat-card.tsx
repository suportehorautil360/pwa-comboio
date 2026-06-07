import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type HistoryStatCardProps = {
  value: string;
  label: string;
  valueClassName?: string;
};

export function HistoryStatCard({
  value,
  label,
  valueClassName,
}: HistoryStatCardProps) {
  return (
    <Card className="flex-1 ring-border/50">
      <CardContent className="flex flex-col items-center gap-1 px-2 pt-0 text-center">
        <p
          className={cn(
            "text-2xl font-semibold tabular-nums leading-none tracking-tight",
            valueClassName ?? "text-brand"
          )}
        >
          {value}
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      </CardContent>
    </Card>
  );
}
