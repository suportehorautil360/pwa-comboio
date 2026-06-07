import { Truck } from "lucide-react";

import { brand } from "@/lib/design-system";
import { Badge } from "@/components/ui/badge";

const operator = {
  role: "COMBOÍSTA",
  name: "J. FERREIRA",
};

export function FieldHeader() {
  return (
    <header className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-success">
          <span className="size-2 rounded-full bg-success" aria-hidden />
          Online
        </div>
        <Badge variant="outline" className="uppercase tracking-wider">
          Sincronizado
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand/15 ring-1 ring-brand/30">
          <Truck className="size-5 text-brand" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-bold uppercase tracking-wide">
            {brand.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {operator.role} · {operator.name}
          </p>
        </div>
      </div>
    </header>
  );
}
