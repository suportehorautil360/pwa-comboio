"use client";

import { useRef, useState } from "react";
import {
  CalendarPlus,
  CircleMinus,
  MessageSquare,
  Paperclip,
  ShieldCheck,
} from "lucide-react";

import { BottomSheet } from "@/components/mobile/bottom-sheet";
import {
  IncluirBatidaSheet,
  type IncluirAberto,
} from "@/components/mobile/incluir-batida-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TIPOS_PONTO } from "@/lib/api/ponto";
import { solicitacoesPontoApi } from "@/lib/api/solicitacoes-ponto";
import type { BatidaEfetiva } from "@/lib/ponto/resolver-ledger";

type Aberto = "cancelar" | "abono" | "mensagem" | null;

const OBS_MAX = 1000;
const ANEXO_MAX_MB = 25;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

/** Mensagem de conclusão: online confirma o envio; offline avisa que ficou na fila. */
function msgEnvio(synced: boolean, online: string): string {
  return synced
    ? online
    : "Salvo no aparelho — vai ao gestor assim que reconectar.";
}

function hojeIso(): string {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
}

function rotuloBatida(b: BatidaEfetiva): string {
  const label = TIPOS_PONTO.find((t) => t.tipo === b.tipo)?.label ?? b.tipo;
  const d = new Date(b.timestampOriginal);
  const dia = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const hora = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dia} · ${label} · ${hora}`;
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    />
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

function Anexo({
  file,
  onFile,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1">
      <input
        ref={ref}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (f && f.size > ANEXO_MAX_MB * 1024 * 1024) {
            onFile(null);
            e.target.value = "";
            return;
          }
          onFile(f);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => ref.current?.click()}
      >
        <Paperclip className="size-3.5" aria-hidden />
        {file ? file.name : "Anexar (opcional)"}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        PDF, JPG ou PNG (máx. {ANEXO_MAX_MB}MB).
      </p>
    </div>
  );
}

export function SolicitarAjustes({
  prefeituraId,
  nome,
  cpf,
  batidas,
  onEnviado,
}: {
  prefeituraId: string;
  nome: string;
  cpf?: string;
  batidas: BatidaEfetiva[];
  onEnviado?: () => void;
}) {
  const [aberto, setAberto] = useState<Aberto>(null);
  const [incluirAberto, setIncluirAberto] = useState<IncluirAberto>(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState("");

  // Cancelar
  const [cancBatidaId, setCancBatidaId] = useState("");
  const [cancMotivo, setCancMotivo] = useState("");

  // Abono
  const [aboData, setAboData] = useState("");
  const [aboMotivo, setAboMotivo] = useState("");
  const [aboAnexo, setAboAnexo] = useState<File | null>(null);

  // Mensagem
  const [msgTexto, setMsgTexto] = useState("");

  function abrir(tipo: Exclude<Aberto, null>) {
    setErro("");
    setSucesso("");
    if (tipo === "cancelar") {
      setCancBatidaId("");
      setCancMotivo("");
    }
    if (tipo === "abono") {
      setAboData(hojeIso());
      setAboMotivo("");
      setAboAnexo(null);
    }
    if (tipo === "mensagem") setMsgTexto("");
    setAberto(tipo);
  }

  function fechar() {
    setAberto(null);
    setErro("");
  }

  function concluir(msg: string) {
    setEnviando(false);
    setAberto(null);
    setSucesso(msg);
    onEnviado?.();
  }

  async function enviarCancelar() {
    if (!cancBatidaId) {
      setErro("Selecione a batida a cancelar.");
      return;
    }
    if (!cancMotivo.trim()) {
      setErro("Descreva o motivo do cancelamento.");
      return;
    }
    setErro("");
    setEnviando(true);
    try {
      const { synced } = await solicitacoesPontoApi.criar({
        tipo: "cancelar",
        prefeituraId,
        name: nome,
        cpf,
        batidaId: cancBatidaId,
        observacao: cancMotivo.trim(),
      });
      concluir(msgEnvio(synced, "Solicitação de cancelamento enviada ao gestor."));
    } catch {
      setEnviando(false);
      setErro("Não foi possível enviar. Verifique a conexão.");
    }
  }

  async function enviarAbono() {
    if (!aboData) {
      setErro("Informe a data do abono.");
      return;
    }
    if (!aboMotivo.trim()) {
      setErro("Descreva o motivo.");
      return;
    }
    setErro("");
    setEnviando(true);
    try {
      const anexoDataUrl = aboAnexo ? await fileToDataUrl(aboAnexo) : undefined;
      const { synced } = await solicitacoesPontoApi.criar({
        tipo: "abono",
        prefeituraId,
        name: nome,
        cpf,
        data: aboData,
        observacao: aboMotivo.trim(),
        anexoDataUrl,
        anexoNome: aboAnexo?.name,
      });
      concluir(msgEnvio(synced, "Solicitação de abono enviada ao gestor."));
    } catch {
      setEnviando(false);
      setErro("Não foi possível enviar. Verifique a conexão.");
    }
  }

  async function enviarMensagem() {
    if (!msgTexto.trim()) {
      setErro("Escreva uma mensagem antes de enviar.");
      return;
    }
    setErro("");
    setEnviando(true);
    try {
      const { synced } = await solicitacoesPontoApi.criar({
        tipo: "mensagem",
        prefeituraId,
        name: nome,
        cpf,
        observacao: msgTexto.trim(),
      });
      concluir(msgEnvio(synced, "Mensagem enviada ao gestor."));
    } catch {
      setEnviando(false);
      setErro("Não foi possível enviar. Verifique a conexão.");
    }
  }

  return (
    <Card className="ring-border/50">
      <CardContent className="space-y-3 pt-0">
        <h2 className="text-sm font-semibold">Solicitar ajustes</h2>

        {sucesso ? (
          <p className="rounded-lg bg-success/10 px-3 py-2 text-xs text-success">
            {sucesso}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-auto flex-col gap-1.5 py-3 text-xs"
            onClick={() => {
              setSucesso("");
              setIncluirAberto({});
            }}
          >
            <CalendarPlus className="size-4" aria-hidden />
            Incluir batida
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto flex-col gap-1.5 py-3 text-xs"
            onClick={() => abrir("cancelar")}
          >
            <CircleMinus className="size-4" aria-hidden />
            Cancelar batida
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto flex-col gap-1.5 py-3 text-xs"
            onClick={() => abrir("abono")}
          >
            <ShieldCheck className="size-4" aria-hidden />
            Solicitar abono
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto flex-col gap-1.5 py-3 text-xs"
            onClick={() => abrir("mensagem")}
          >
            <MessageSquare className="size-4" aria-hidden />
            Enviar mensagem
          </Button>
        </div>
      </CardContent>

      <IncluirBatidaSheet
        aberto={incluirAberto}
        onClose={() => setIncluirAberto(null)}
        onEnviado={(msg) => {
          setIncluirAberto(null);
          setSucesso(msg);
          onEnviado?.();
        }}
        prefeituraId={prefeituraId}
        nome={nome}
        cpf={cpf}
      />

      {/* Cancelar batida */}
      <BottomSheet
        open={aberto === "cancelar"}
        onClose={fechar}
        title="Cancelar batida"
      >
        <p className="text-xs text-muted-foreground">
          Selecione a batida e descreva o motivo. Vai para aprovação do gestor.
        </p>
        <Campo label="Batida">
          <Select value={cancBatidaId} onValueChange={setCancBatidaId}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="Selecione…" />
            </SelectTrigger>
            <SelectContent>
              {batidas.length === 0 ? (
                <SelectItem value="__none" disabled>
                  Nenhuma batida disponível
                </SelectItem>
              ) : (
                batidas.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {rotuloBatida(b)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </Campo>
        <Campo label="Motivo">
          <Textarea
            placeholder="Ex.: bati o ponto errado por engano"
            maxLength={OBS_MAX}
            value={cancMotivo}
            onChange={(e) => setCancMotivo(e.target.value)}
          />
        </Campo>
        {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
        <Button
          type="button"
          variant="brand"
          className="w-full"
          disabled={enviando}
          onClick={() => void enviarCancelar()}
        >
          {enviando ? "Enviando…" : "Enviar solicitação"}
        </Button>
      </BottomSheet>

      {/* Solicitar abono */}
      <BottomSheet
        open={aberto === "abono"}
        onClose={fechar}
        title="Solicitar abono"
      >
        <p className="text-xs text-muted-foreground">
          Informe o dia, o motivo e — se houver — anexe o comprovante (atestado).
        </p>
        <Campo label="Data do abono">
          <input
            type="date"
            value={aboData}
            onChange={(e) => setAboData(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </Campo>
        <Campo label="Motivo">
          <Textarea
            placeholder="Ex.: consulta médica com atestado"
            maxLength={OBS_MAX}
            value={aboMotivo}
            onChange={(e) => setAboMotivo(e.target.value)}
          />
        </Campo>
        <Anexo file={aboAnexo} onFile={setAboAnexo} />
        {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
        <Button
          type="button"
          variant="brand"
          className="w-full"
          disabled={enviando}
          onClick={() => void enviarAbono()}
        >
          {enviando ? "Enviando…" : "Enviar solicitação"}
        </Button>
      </BottomSheet>

      {/* Enviar mensagem */}
      <BottomSheet
        open={aberto === "mensagem"}
        onClose={fechar}
        title="Enviar mensagem"
      >
        <p className="text-xs text-muted-foreground">
          Mande uma observação ao seu gestor sobre o seu ponto.
        </p>
        <Campo label="Mensagem">
          <Textarea
            placeholder="Descreva o que precisa…"
            maxLength={OBS_MAX}
            value={msgTexto}
            onChange={(e) => setMsgTexto(e.target.value)}
          />
        </Campo>
        {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
        <Button
          type="button"
          variant="brand"
          className="w-full"
          disabled={enviando}
          onClick={() => void enviarMensagem()}
        >
          {enviando ? "Enviando…" : "Enviar"}
        </Button>
      </BottomSheet>
    </Card>
  );
}
