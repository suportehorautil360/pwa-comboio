import { type LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ActivityItemProps = {
  icon: LucideIcon;
  code: string;
  description: string;
  value: string;
  valueClassName?: string;
  time: string;
};

export function ActivityItem({
  icon: Icon,
  code,
  description,
  value,
  valueClassName,
  time,
}: ActivityItemProps) {
  return (
    <Card className="ring-border/50">
      <CardContent className="flex items-center gap-3 pt-0">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm font-medium">{code}</p>
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={cn("text-sm font-semibold tabular-nums", valueClassName)}>
            {value}
          </p>
          <p className="text-xs tabular-nums text-muted-foreground">{time}</p>
        </div>
      </CardContent>
    </Card>
  );
}
