"use client";

import { useMemo, useState } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Check, ChevronDown, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ComboioItem } from "@/lib/api/comboios";

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function litros(c: ComboioItem): string {
  return `${(c.tank?.currentVolume ?? 0).toLocaleString("pt-BR")} L`;
}

/** Linha secundária: chassi + saldo (o que diferencia comboios homônimos). */
function subtitulo(c: ComboioItem): string {
  return [c.chassis, litros(c)].filter(Boolean).join(" · ");
}

/**
 * Seletor de comboio com busca — diferencia comboios de mesmo nome pelo chassi
 * e filtra por placa/chassi (inclui os últimos dígitos). Radix Popover + Input.
 */
export function ComboioSelect({
  comboios,
  value,
  onChange,
  id,
  placeholder = "Selecione o comboio",
  disabled,
}: {
  comboios: ComboioItem[];
  value: string;
  onChange: (id: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");

  const selecionado = comboios.find((c) => c.id === value) ?? null;

  const filtradas = useMemo(() => {
    const q = normalizar(busca.trim());
    if (!q) return comboios;
    return comboios.filter((c) =>
      normalizar(`${c.descricao} ${c.placa} ${c.chassis}`).includes(q),
    );
  }, [comboios, busca]);

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) setBusca("");
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
        >
          <span className="flex min-w-0 flex-col items-start text-left">
            {selecionado ? (
              <>
                <span className="truncate">{selecionado.descricao}</span>
                <span className="truncate font-mono text-[11px] text-muted-foreground">
                  {subtitulo(selecionado)}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          className="z-50 w-(--radix-popover-trigger-width) rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none"
        >
          <div className="relative mb-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar (placa, chassi, 4 últimos…)"
              inputMode="search"
              className="h-9 pl-7"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtradas.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum comboio encontrado.
              </p>
            ) : (
              filtradas.map((c) => {
                const sel = c.id === value;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onChange(c.id);
                      handleOpenChange(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent",
                      sel && "bg-accent/60",
                    )}
                  >
                    <Check
                      className={cn(
                        "size-4 shrink-0",
                        sel ? "opacity-100" : "opacity-0",
                      )}
                      aria-hidden
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">
                        {c.descricao}
                        {c.placa ? ` · ${c.placa}` : ""}
                      </span>
                      {c.chassis ? (
                        <span className="truncate font-mono text-[11px] text-muted-foreground">
                          {c.chassis}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {litros(c)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
