"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip } from "lucide-react";

import { BottomSheet } from "@/components/mobile/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TIPOS_PONTO, type TipoPonto } from "@/lib/api/ponto";
import { solicitacoesPontoApi } from "@/lib/api/solicitacoes-ponto";

const OBS_MAX = 1000;
const ANEXO_MAX_MB = 25;

/** Estado de abertura: objeto (aberto, opcionalmente pré-preenchido) ou null. */
export type IncluirAberto = { data?: string; tipo?: TipoPonto } | null;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

function hojeIso(): string {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
}

export function IncluirBatidaSheet({
  aberto,
  onClose,
  onEnviado,
  prefeituraId,
  nome,
  cpf,
}: {
  aberto: IncluirAberto;
  onClose: () => void;
  onEnviado: (msg: string) => void;
  prefeituraId: string;
  nome: string;
  cpf?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState<TipoPonto>("entrada");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [obs, setObs] = useState("");
  const [anexo, setAnexo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  // Pré-preenche ao abrir (dia/tipo vindos do slot clicado, quando houver).
  useEffect(() => {
    if (!aberto) return;
    queueMicrotask(() => {
      setTipo(aberto.tipo ?? "entrada");
      setData(aberto.data ?? hojeIso());
      setHora("");
      setObs("");
      setAnexo(null);
      setErro("");
    });
  }, [aberto]);

  async function enviar() {
    if (!data || !hora) {
      setErro("Informe data e horário.");
      return;
    }
    setErro("");
    setEnviando(true);
    try {
      const timestampOriginal = new Date(`${data}T${hora}:00`).toISOString();
      const anexoDataUrl = anexo ? await fileToDataUrl(anexo) : undefined;
      const { synced } = await solicitacoesPontoApi.criar({
        tipo: "incluir",
        tipoBatida: tipo,
        prefeituraId,
        name: nome,
        cpf,
        data,
        timestampOriginal,
        observacao: obs.trim() || undefined,
        anexoDataUrl,
        anexoNome: anexo?.name,
      });
      setEnviando(false);
      const label = TIPOS_PONTO.find((t) => t.tipo === tipo)?.label ?? tipo;
      onEnviado(
        synced
          ? `Inclusão de "${label}" enviada ao gestor.`
          : `Inclusão de "${label}" salva no aparelho — vai ao gestor ao reconectar.`,
      );
    } catch {
      setEnviando(false);
      setErro("Não foi possível enviar. Verifique a conexão.");
    }
  }

  return (
    <BottomSheet open={!!aberto} onClose={onClose} title="Incluir batida">
      <p className="text-xs text-muted-foreground">
        Para batidas esquecidas ou não gravadas. Vai para aprovação do gestor.
      </p>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">Batida</span>
        <Select value={tipo} onValueChange={(v) => setTipo(v as TipoPonto)}>
          <SelectTrigger className="h-10 w-full">
            <SelectValue />
          </SelectTrigger>
          {/* z acima do overlay do BottomSheet (z-[60]); senão o dropdown abre atrás. */}
          <SelectContent className="z-[70]">
            {TIPOS_PONTO.map((t) => (
              <SelectItem key={t.tipo} value={t.tipo}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Data</span>
          <Input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="h-10"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Horário</span>
          <Input
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            className="h-10"
          />
        </label>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">Observação</span>
        <textarea
          placeholder="Ex.: esqueci de marcar a volta do almoço"
          rows={3}
          maxLength={OBS_MAX}
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </label>

      <div className="space-y-1">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            if (f && f.size > ANEXO_MAX_MB * 1024 * 1024) {
              setAnexo(null);
              e.target.value = "";
              return;
            }
            setAnexo(f);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip className="size-3.5" aria-hidden />
          {anexo ? anexo.name : "Anexar (opcional)"}
        </Button>
      </div>

      {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
      <Button
        type="button"
        variant="brand"
        className="w-full"
        disabled={enviando}
        onClick={() => void enviar()}
      >
        {enviando ? "Enviando…" : "Enviar solicitação"}
      </Button>
    </BottomSheet>
  );
}
