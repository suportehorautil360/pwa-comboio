"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Paperclip,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { PageBackHeader } from "@/components/mobile/page-back-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  type SolicitacaoPonto,
  type StatusSolicitacao,
  type TipoSolicitacao,
} from "@/lib/api/solicitacoes-ponto";
import { useSolicitacoes } from "@/lib/data/queries";
import { limparCpf } from "@/lib/ponto/cpf";
import { getSessionUser, type SessionUser } from "@/lib/session";

const TIPO_LABEL: Record<TipoSolicitacao, string> = {
  incluir: "Incluir batida",
  cancelar: "Cancelar batida",
  abono: "Solicitar abono",
  mensagem: "Mensagem ao gestor",
};

const STATUS_LABEL: Record<StatusSolicitacao, string> = {
  pendente: "Pendente",
  aprovado: "Aprovada",
  reprovado: "Reprovada",
};

const STATUS_ICONE: Record<StatusSolicitacao, LucideIcon> = {
  pendente: Clock,
  aprovado: CheckCircle2,
  reprovado: XCircle,
};

const STATUS_COR: Record<StatusSolicitacao, string> = {
  pendente: "text-amber-500",
  aprovado: "text-success",
  reprovado: "text-destructive",
};

function fmtDataHora(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDiaIso(diaIso?: string | null): string {
  if (!diaIso) return "—";
  const [y, m, d] = diaIso.split("-");
  if (!y || !m || !d) return diaIso;
  return `${d}/${m}/${y}`;
}

function ehMinha(s: SolicitacaoPonto, user: SessionUser): boolean {
  const cpf = limparCpf(user.cpf ?? "");
  const nome = (user.nome ?? "").trim().toLowerCase();
  if (cpf && s.cpf) return limparCpf(s.cpf) === cpf;
  return !s.cpf && nome.length > 0 && s.name.trim().toLowerCase() === nome;
}

export function MinhasSolicitacoesScreen() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [filtro, setFiltro] = useState<"todas" | StatusSolicitacao>("todas");
  const [anexo, setAnexo] = useState<string | null>(null);

  // Leitura offline-first: lista cacheada na hora, revalida em background.
  const { data, loading: carregando } = useSolicitacoes(user?.prefeituraId);
  const lista = useMemo<SolicitacaoPonto[]>(() => data ?? [], [data]);

  useEffect(() => {
    const u = getSessionUser();
    if (!u) {
      router.replace("/");
      return;
    }
    queueMicrotask(() => setUser(u));
  }, [router]);

  const minhas = useMemo(() => {
    if (!user) return [];
    return lista
      .filter((s) => ehMinha(s, user))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [lista, user]);

  const totais = useMemo(
    () => ({
      todas: minhas.length,
      pendente: minhas.filter((s) => s.status === "pendente").length,
      aprovado: minhas.filter((s) => s.status === "aprovado").length,
      reprovado: minhas.filter((s) => s.status === "reprovado").length,
    }),
    [minhas],
  );

  const visiveis = minhas.filter((s) => filtro === "todas" || s.status === filtro);

  const chips: { key: "todas" | StatusSolicitacao; label: string; n: number }[] =
    [
      { key: "todas", label: "Todas", n: totais.todas },
      { key: "pendente", label: "Pendentes", n: totais.pendente },
      { key: "aprovado", label: "Aprovadas", n: totais.aprovado },
      { key: "reprovado", label: "Reprovadas", n: totais.reprovado },
    ];

  return (
    <div className="mx-auto w-full max-w-lg space-y-5">
      <PageBackHeader
        eyebrow="Registro de ponto"
        title="Minhas solicitações"
        backHref="/meu-ponto"
      />

      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFiltro(c.key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              filtro === c.key
                ? "border-brand bg-brand/15 text-brand"
                : "border-border text-muted-foreground hover:bg-muted/40"
            }`}
          >
            {c.label} <strong>{c.n}</strong>
          </button>
        ))}
      </div>

      {carregando ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : visiveis.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {filtro === "todas"
            ? "Você ainda não enviou nenhuma solicitação. Use 'Solicitar ajustes' em Meu ponto."
            : `Nenhuma solicitação ${STATUS_LABEL[filtro].toLowerCase()}.`}
        </p>
      ) : (
        <div className="space-y-2">
          {visiveis.map((s) => {
            const Icone = STATUS_ICONE[s.status];
            return (
              <Card key={s.id} className="ring-border/50">
                <CardContent className="space-y-2 pt-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">
                      {TIPO_LABEL[s.tipo]}
                    </span>
                    <span
                      className={`flex items-center gap-1 text-xs font-medium ${STATUS_COR[s.status]}`}
                    >
                      <Icone className="size-3.5" aria-hidden />
                      {STATUS_LABEL[s.status]}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground">
                    {s.tipo === "incluir" && s.timestampOriginal ? (
                      <p>Batida pedida: {fmtDataHora(s.timestampOriginal)}</p>
                    ) : null}
                    {s.tipo === "abono" && s.data ? (
                      <p>Dia: {fmtDiaIso(s.data)}</p>
                    ) : null}
                    {s.observacao ? (
                      <p className="italic">&ldquo;{s.observacao}&rdquo;</p>
                    ) : null}
                    {s.anexoNome && s.anexoDataUrl ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-brand"
                        onClick={() => setAnexo(s.anexoDataUrl ?? null)}
                      >
                        <Paperclip className="size-3" aria-hidden /> {s.anexoNome}
                      </button>
                    ) : null}
                    {s.status === "reprovado" && s.motivoReprovacao ? (
                      <p className="flex items-start gap-1 text-destructive">
                        <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
                        Reprovada: {s.motivoReprovacao}
                      </p>
                    ) : null}
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Enviada em {fmtDataHora(s.createdAt)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {anexo ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          role="presentation"
          onClick={() => setAnexo(null)}
        >
          {anexo.startsWith("data:image") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={anexo}
              alt="Anexo"
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          ) : (
            <a
              href={anexo}
              download
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground"
            >
              Baixar anexo
            </a>
          )}
        </div>
      ) : null}
    </div>
  );
}
