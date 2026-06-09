import { Truck } from "lucide-react";

import { brand } from "@/lib/design-system";
import { Badge } from "@/components/ui/badge";

type FieldHeaderProps = {
  /** Nome do operador logado (ex.: "J. Ferreira"). */
  nome?: string;
  /** Cargo/papel. Padrão: COMBOÍSTA. */
  papel?: string;
  online?: boolean;
};

export function FieldHeader({
  nome,
  papel = "COMBOÍSTA",
  online = true,
}: FieldHeaderProps) {
  return (
    <header className="space-y-4">
      <div className="flex items-center justify-between">
        <div
          className={`flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider ${online ? "text-success" : "text-muted-foreground"}`}
        >
          <span
            className={`size-2 rounded-full ${online ? "bg-success" : "bg-muted-foreground"}`}
            aria-hidden
          />
          {online ? "Online" : "Offline"}
        </div>
        <Badge variant="outline" className="uppercase tracking-wider">
          {online ? "Sincronizado" : "Pendente"}
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
            {papel}
            {nome ? ` · ${nome}` : ""}
          </p>
        </div>
      </div>
    </header>
  );
}
