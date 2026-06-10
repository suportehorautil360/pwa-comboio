"use client";

import { useEffect, useState } from "react";

import { BottomSheet } from "@/components/mobile/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pontoApi, type PontoRegistro } from "@/lib/api/ponto";

const MOTIVO_MAX = 250;

function horaInput(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Combina a data de `iso` com um novo horário "HH:MM" (local) → ISO. */
function comNovaHora(iso: string, hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(iso);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/**
 * Solicita correção de horário de uma batida existente. Cria um ajuste no
 * ledger (pendente de aprovação) — não altera a batida original.
 */
export function EditarBatidaSheet({
  batida,
  onClose,
  onSalvo,
}: {
  batida: PontoRegistro | null;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const [novaHora, setNovaHora] = useState("");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!batida) return;
    queueMicrotask(() => {
      setNovaHora(horaInput(batida.timestampOriginal));
      setMotivo("");
      setErro("");
    });
  }, [batida]);

  async function salvar() {
    if (!batida || !novaHora) return;
    setErro("");
    setSalvando(true);
    try {
      await pontoApi.editarHorario(
        batida.id,
        comNovaHora(batida.timestampOriginal, novaHora),
        motivo,
      );
      setSalvando(false);
      onSalvo();
    } catch {
      setSalvando(false);
      setErro("Não foi possível enviar a correção. Verifique a conexão.");
    }
  }

  return (
    <BottomSheet open={!!batida} onClose={onClose} title="Editar horário">
      <p className="text-xs text-muted-foreground">
        Corrija o horário desta batida. A alteração fica pendente de aprovação do
        gestor — o horário original vale até lá.
      </p>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Novo horário</span>
        <Input
          type="time"
          value={novaHora}
          onChange={(e) => setNovaHora(e.target.value)}
          className="h-10"
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Motivo da correção</span>
        <textarea
          placeholder="Descreva o motivo…"
          rows={3}
          maxLength={MOTIVO_MAX}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </label>
      {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
      <Button
        type="button"
        variant="brand"
        className="w-full"
        disabled={salvando || !novaHora}
        onClick={() => void salvar()}
      >
        {salvando ? "Enviando…" : "Salvar correção"}
      </Button>
    </BottomSheet>
  );
}
