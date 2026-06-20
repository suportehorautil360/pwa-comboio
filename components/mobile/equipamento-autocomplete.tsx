"use client";

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import type { EquipamentoApi } from "@/lib/api/abastecimento";

/** Normaliza para só letras/números (ignora pontos, hífens, espaços). */
function alnum(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Campo de placa/chassi com busca: sugestões filtradas por substring (placa,
 * chassi, descrição) — casa pelos últimos dígitos (ex.: "999"). Mantém texto
 * livre (offline / equipamento fora do cadastro). Substitui o `<datalist>`
 * nativo, que não filtra de forma confiável pelo fim do valor.
 */
export function EquipamentoAutocomplete({
  equipamentos,
  value,
  onChange,
  id,
  placeholder = "Ex: ABC-1234",
}: {
  equipamentos: EquipamentoApi[];
  value: string;
  onChange: (v: string) => void;
  id?: string;
  placeholder?: string;
}) {
  const [focado, setFocado] = useState(false);

  const sugestoes = useMemo(() => {
    const q = alnum(value);
    if (q.length < 2) return [];
    return equipamentos
      .map((e) => ({ e, valor: e.placa || e.chassis || "" }))
      .filter((x) => x.valor)
      .filter(({ e, valor }) =>
        alnum(`${valor} ${e.descricao ?? ""} ${e.modelo ?? ""}`).includes(q),
      )
      .sort(
        (a, b) =>
          (alnum(a.valor).endsWith(q) ? 0 : 1) -
          (alnum(b.valor).endsWith(q) ? 0 : 1),
      )
      .slice(0, 8);
  }, [equipamentos, value]);

  const mostrar = focado && sugestoes.length > 0;

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocado(true)}
        // Atraso para o clique na sugestão registrar antes do blur fechar a lista.
        onBlur={() => setTimeout(() => setFocado(false), 120)}
        placeholder={placeholder}
        className="h-11 uppercase md:text-base"
        autoComplete="off"
        required
      />
      {mostrar ? (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-input bg-popover p-1 shadow-md ring-1 ring-foreground/10">
          {sugestoes.map(({ e, valor }) => (
            <li key={e.id}>
              <button
                type="button"
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => {
                  onChange(valor.toUpperCase());
                  setFocado(false);
                }}
                className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-2 text-left hover:bg-accent"
              >
                <span className="text-sm font-medium">{valor}</span>
                {e.descricao || e.modelo ? (
                  <span className="text-xs text-muted-foreground">
                    {e.descricao ?? e.modelo}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
