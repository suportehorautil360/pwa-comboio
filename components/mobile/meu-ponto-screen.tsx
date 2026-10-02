"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Camera,
  ChevronRight,
  Download,
  ListChecks,
} from "lucide-react";

import { EditarBatidaSheet } from "@/components/mobile/editar-batida-sheet";
import { FieldHeader } from "@/components/mobile/field-header";
import { PageBackHeader } from "@/components/mobile/page-back-header";
import { PhotoUpload } from "@/components/mobile/photo-upload";
import { RelogioAoVivo } from "@/components/mobile/relogio-ao-vivo";
import { SolicitarAjustes } from "@/components/mobile/solicitar-ajustes";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  TIPOS_PONTO,
  type PontoRegistro,
  type TipoPonto,
} from "@/lib/api/ponto";
import { ApiError } from "@/lib/api/client";
import {
  useAbonos,
  useEmpresa,
  useEscala,
  usePontoRegistros,
  useSolicitacoes,
} from "@/lib/data/queries";
import { submit } from "@/lib/offline/outbox";
import { batidasPendentes, mesclarBatidas } from "@/lib/offline/pendentes";
import { useOutboxRaw } from "@/lib/offline/use-outbox";
import {
  aplicarCorrecoesPendentes,
  correcoesNaFila,
} from "@/lib/ponto/ajustes-pendentes";
import { limparCpf } from "@/lib/ponto/cpf";
import { baixarCRPT, montarCRPT, podeEmitirCRPT } from "@/lib/ponto/crpt";
import { abonosDoMes, diasDoMes, totaisDosDias } from "@/lib/ponto/espelho";
import { fmtMin } from "@/lib/ponto/horas";
import { resolverLedger, type BatidaEfetiva } from "@/lib/ponto/resolver-ledger";
import { getSessionUser, type SessionUser } from "@/lib/session";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Falha ao ler a foto."));
    reader.readAsDataURL(file);
  });
}

function horaDe(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ehHoje(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

function diaDe(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}

function dataLabel(dia: string): string {
  const [y, m, d] = dia.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function ehDoOperador(r: PontoRegistro, user: SessionUser): boolean {
  const cpf = limparCpf(user.cpf ?? "");
  if (cpf && r.cpf) return limparCpf(String(r.cpf)) === cpf;
  return (
    (r.name ?? "").trim().toLowerCase() === (user.nome ?? "").trim().toLowerCase()
  );
}

/**
 * Selo da batida, com os mesmos estados da folha do checklist ("Registrado",
 * "Ajuste pendente", "Sem registro") e mais um que só existe aqui: a batida
 * ainda na fila do aparelho.
 */
function selo(
  reg: BatidaEfetiva,
  pendente: boolean,
): { label: string; pendente: boolean } {
  if (pendente) return { label: "Pendente de envio", pendente: true };
  if (reg.ajustePendente) return { label: "Ajuste pendente", pendente: true };
  return { label: "Registrado", pendente: false };
}

const SELO_BASE =
  "whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide";
const SELO_OK = `${SELO_BASE} bg-success/15 text-success`;
const SELO_PENDENTE = `${SELO_BASE} bg-warning/15 text-warning`;

function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function MeuPontoScreen() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [erro, setErro] = useState("");

  const [batendo, setBatendo] = useState<TipoPonto | null>(null);
  const [foto, setFoto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState<PontoRegistro | null>(null);
  const [sucesso, setSucesso] = useState("");
  // Histórico inicia totalmente fechado (a seção esconde os dias) e, ao abrir,
  // cada dia também começa recolhido (a lista fica muito longa toda aberta).
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [diasAbertos, setDiasAbertos] = useState<Set<string>>(new Set());

  // Leitura offline-first: batidas + dados da empresa cacheados.
  const {
    data: recordsData,
    loading: loadingRecords,
    refetch: recarregar,
  } = usePontoRegistros(user);
  const { data: solicitacoesData, refetch: recarregarSolicitacoes } =
    useSolicitacoes(user);
  const { data: empresaData } = useEmpresa(user?.prefeituraId);
  const { data: escalaData } = useEscala(user?.prefeituraId);
  const { data: abonosData } = useAbonos(user?.prefeituraId);
  const empresa = empresaData ?? null;
  const escala = escalaData ?? null;
  const carregando = !user || loadingRecords;

  // Otimismo de UI: batidas ainda na fila aparecem na folha como "pendente".
  const raw = useOutboxRaw();
  const pendentes = useMemo(() => batidasPendentes(raw), [raw]);
  const pendentesIds = useMemo(
    () => new Set(pendentes.map((b) => b.id)),
    [pendentes],
  );
  const pendentesDoOperador = useMemo(
    () => (user ? pendentes.filter((b) => ehDoOperador(b, user)).length : 0),
    [pendentes, user],
  );
  const todas = useMemo(
    () =>
      user
        ? mesclarBatidas(
            // As do servidor já vêm recortadas pela pessoa do token; a fila é
            // do aparelho, e pode ter batida de quem usou antes.
            recordsData ?? [],
            pendentes.filter((b) => ehDoOperador(b, user)),
          )
        : [],
    [recordsData, user, pendentes],
  );

  useEffect(() => {
    const u = getSessionUser();
    if (!u) {
      router.replace("/");
      return;
    }
    queueMicrotask(() => setUser(u));
  }, [router]);

  // A folha do servidor mais os pedidos de correção em aberto — os que o RH
  // ainda não avaliou e os que nem saíram do aparelho.
  const efetivas = useMemo(
    () =>
      aplicarCorrecoesPendentes(resolverLedger(todas), [
        ...(solicitacoesData ?? []),
        ...correcoesNaFila(raw),
      ]),
    [todas, solicitacoesData, raw],
  );

  const porTipoHoje = useMemo(() => {
    const m = new Map<TipoPonto, BatidaEfetiva>();
    for (const b of efetivas) if (ehHoje(b.timestampOriginal)) m.set(b.tipo, b);
    return m;
  }, [efetivas]);

  const historico = useMemo(() => {
    const porDia = new Map<string, BatidaEfetiva[]>();
    for (const b of efetivas) {
      if (ehHoje(b.timestampOriginal)) continue;
      const dia = diaDe(b.timestampOriginal);
      const arr = porDia.get(dia) ?? [];
      arr.push(b);
      porDia.set(dia, arr);
    }
    return [...porDia.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([dia, batidas]) => ({
        dia,
        batidas: [...batidas].sort((x, y) =>
          x.timestampOriginal.localeCompare(y.timestampOriginal),
        ),
      }));
  }, [efetivas]);

  /**
   * Saldo do mês corrente — o mesmo cálculo (e as mesmas funções) do card de
   * totais do espelho, que este card abre. Mesmo papel do "Saldo do mês" da
   * folha do checklist.
   */
  const [mesCorrente] = useState(mesAtual);
  const saldoMes = useMemo(() => {
    const abonosDias = abonosDoMes(abonosData ?? [], user?.cpf, mesCorrente);
    const dias = diasDoMes(efetivas, abonosDias, mesCorrente, new Date());
    return { ...totaisDosDias(dias, abonosDias, escala), dias: dias.length };
  }, [abonosData, user, mesCorrente, efetivas, escala]);

  async function onFoto(file: File | null) {
    if (!file) {
      setFoto("");
      return;
    }
    try {
      setFoto(await fileToDataUrl(file));
    } catch {
      setErro("Não foi possível ler a foto. Tente de novo.");
    }
  }

  function iniciarBater(tipo: TipoPonto) {
    setErro("");
    setFoto("");
    setBatendo(tipo);
  }

  async function confirmarBatida() {
    if (!batendo || !user) return;
    const label = TIPOS_PONTO.find((t) => t.tipo === batendo)?.label ?? "Batida";
    if (!foto) {
      setErro("Capture a selfie antes de confirmar.");
      return;
    }
    setErro("");
    setSucesso("");
    setSalvando(true);
    const agora = new Date().toISOString();
    try {
      // `submit` tenta enviar na hora e só cai na fila sem sinal — é o que
      // permite dizer, como o checklist, se a batida já foi registrada ou
      // ficou no aparelho.
      const r = await submit("ponto", {
        name: user.nome,
        photo: foto,
        prefeituraId: user.prefeituraId,
        timestampOriginal: agora,
        tipo: batendo,
        cpf: user.cpf,
      });
      setBatendo(null);
      setFoto("");
      setSucesso(
        r.synced
          ? `${label} registrada às ${horaDe(agora)}.`
          : `${label} registrada offline — sincroniza ao reconectar.`,
      );
      recarregar();
    } catch (e) {
      setErro(
        e instanceof ApiError && e.message
          ? e.message
          : "Não foi possível registrar a batida. Tente de novo.",
      );
    } finally {
      setSalvando(false);
    }
  }

  async function baixarComprovante(reg: BatidaEfetiva) {
    try {
      await baixarCRPT(montarCRPT(reg, empresa));
    } catch {
      setErro("Não foi possível gerar o comprovante.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <FieldHeader nome={user?.nome} />

      <PageBackHeader
        eyebrow="Registro de ponto"
        title="Meu ponto"
        backHref="/perfil"
      />

      {erro ? (
        <p className="text-sm text-destructive" role="alert">
          {erro}
        </p>
      ) : null}

      {sucesso ? (
        <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success" role="status">
          {sucesso}
        </p>
      ) : null}

      <Card className="ring-border/50">
        <CardContent className="pt-0">
          <RelogioAoVivo comData />
        </CardContent>
      </Card>

      <div className="space-y-2">
        <span className="text-sm font-medium">Funcionário</span>
        <div className="flex h-11 items-center rounded-md border border-input bg-muted/30 px-3 text-sm text-muted-foreground">
          {user?.nome || "—"}
        </div>
      </div>

      {pendentesDoOperador > 0 ? (
        <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
          {pendentesDoOperador} batida(s) aguardando sincronização.
        </p>
      ) : null}

      {/* Registros do dia */}
      <Card className="ring-border/50">
        <CardContent className="pt-0">
          <h2 className="pb-2 text-sm font-semibold">Registros do dia</h2>
          <ul>
            {TIPOS_PONTO.map(({ tipo, label }) => {
              const reg = porTipoHoje.get(tipo);
              const ehPendente = reg ? pendentesIds.has(reg.id) : false;
              const s = reg ? selo(reg, ehPendente) : null;
              return (
                <li key={tipo} className="border-t border-border py-3">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    <span className="text-sm font-semibold">{label}</span>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <strong className="text-base tabular-nums">
                        {reg ? horaDe(reg.timestampOriginal) : "—:—"}
                      </strong>
                      <span className={s && !s.pendente ? SELO_OK : SELO_PENDENTE}>
                        {s ? s.label : "Sem registro"}
                      </span>
                      {reg && !ehPendente ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditando(reg)}
                        >
                          Editar
                        </Button>
                      ) : null}
                      {!reg ? (
                        <Button
                          type="button"
                          variant="brand"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => iniciarBater(tipo)}
                          disabled={batendo === tipo}
                        >
                          <Camera className="size-3.5" aria-hidden />
                          Bater
                        </Button>
                      ) : null}
                      {reg && !ehPendente && podeEmitirCRPT(reg) ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          title="Baixar comprovante (CRPT) desta batida"
                          onClick={() => void baixarComprovante(reg)}
                        >
                          <Download className="size-3.5" aria-hidden />
                          Comprovante
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {reg?.ajustePendente && reg.horarioAjustePendente ? (
                    <p className="mt-2 text-xs text-warning">
                      Correção para {horaDe(reg.horarioAjustePendente)}{" "}
                      aguardando aprovação do RH. Vale o horário original até lá.
                    </p>
                  ) : null}

                  {batendo === tipo ? (
                    <div className="mt-3 space-y-3">
                      <PhotoUpload
                        defaultFacing="user"
                        label="Tirar selfie"
                        onSelect={(f) => void onFoto(f)}
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="brand"
                          className="flex-1"
                          onClick={() => void confirmarBatida()}
                          disabled={salvando}
                        >
                          {salvando ? "Registrando…" : `Confirmar ${label}`}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setBatendo(null);
                            setFoto("");
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {/* Histórico */}
      <div className="space-y-3">
        <button
          type="button"
          aria-expanded={historicoAberto}
          onClick={() => setHistoricoAberto((v) => !v)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <h2 className="text-sm font-semibold">Histórico</h2>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {!carregando && historico.length > 0
              ? `${historico.length} ${historico.length === 1 ? "dia" : "dias"}`
              : null}
            <ChevronRight
              className={`size-4 shrink-0 transition-transform ${historicoAberto ? "rotate-90" : ""}`}
              aria-hidden
            />
          </span>
        </button>
        {!historicoAberto ? null : carregando ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : historico.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma batida em dias anteriores.
          </p>
        ) : (
          historico.map(({ dia, batidas }) => {
            const aberto = diasAbertos.has(dia);
            return (
              <Card key={dia} className="ring-border/50">
                <CardContent className="space-y-1 pt-0">
                  <button
                    type="button"
                    aria-expanded={aberto}
                    onClick={() =>
                      setDiasAbertos((atual) => {
                        const novo = new Set(atual);
                        if (novo.has(dia)) novo.delete(dia);
                        else novo.add(dia);
                        return novo;
                      })
                    }
                    className="flex w-full items-center justify-between gap-2 py-1 text-left"
                  >
                    <span className="text-xs font-semibold capitalize text-muted-foreground">
                      {dataLabel(dia)}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {batidas.length}{" "}
                      {batidas.length === 1 ? "batida" : "batidas"}
                      <ChevronRight
                        className={`size-4 shrink-0 transition-transform ${aberto ? "rotate-90" : ""}`}
                        aria-hidden
                      />
                    </span>
                  </button>
                  {aberto
                    ? batidas.map((b) => {
                        const label =
                          TIPOS_PONTO.find((t) => t.tipo === b.tipo)?.label ??
                          b.tipo;
                        return (
                          <div
                            key={b.id}
                            className="flex items-center justify-between gap-3 border-t border-border py-2 text-sm"
                          >
                            <span className="min-w-0 truncate">{label}</span>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="tabular-nums font-medium">
                                {horaDe(b.timestampOriginal)}
                              </span>
                              {podeEmitirCRPT(b) ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="Baixar comprovante"
                                  onClick={() => void baixarComprovante(b)}
                                >
                                  <Download className="size-4" aria-hidden />
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    : null}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Card className="ring-border/50">
        <CardContent className="space-y-1 pt-0">
          <p className="text-sm font-semibold text-muted-foreground">
            Saldo do mês
          </p>
          <p
            className={`text-3xl font-extrabold tabular-nums ${
              saldoMes.saldo < 0 ? "text-destructive" : "text-success"
            }`}
          >
            {saldoMes.saldo >= 0 ? "+" : ""}
            {fmtMin(saldoMes.saldo)}
          </p>
          <p className="text-xs text-muted-foreground">
            {carregando
              ? "Carregando…"
              : `${fmtMin(saldoMes.trab)} trabalhados de ${fmtMin(
                  saldoMes.prev,
                )} previstos em ${saldoMes.dias} dia(s) — mesmo cálculo do espelho`}
          </p>
        </CardContent>
      </Card>

      {user ? (
        <SolicitarAjustes
          prefeituraId={user.prefeituraId}
          nome={user.nome}
          cpf={user.cpf}
          batidas={efetivas}
          onEnviado={() => {
            recarregar();
            recarregarSolicitacoes();
          }}
        />
      ) : null}

      <Link href="/minhas-solicitacoes" className="block">
        <Card className="ring-border/50 transition-colors hover:bg-muted/40">
          <CardContent className="flex items-center gap-3 pt-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/15 ring-1 ring-brand/30">
              <ListChecks className="size-5 text-brand" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                Minhas solicitações
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Acompanhe o status dos seus pedidos
              </p>
            </div>
            <ChevronRight
              className="size-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </CardContent>
        </Card>
      </Link>

      <Link href="/espelho" className="block">
        <Card className="ring-border/50 transition-colors hover:bg-muted/40">
          <CardContent className="flex items-center gap-3 pt-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/15 ring-1 ring-brand/30">
              <CalendarDays className="size-5 text-brand" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Espelho detalhado</p>
              <p className="truncate text-xs text-muted-foreground">
                Mês a mês, detalhe do dia e exportar PDF
              </p>
            </div>
            <ChevronRight
              className="size-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </CardContent>
        </Card>
      </Link>

      <EditarBatidaSheet
        batida={editando}
        onClose={() => setEditando(null)}
onSalvo={(enviado) => {
          setEditando(null);
          setSucesso(
            enviado
              ? "Correção enviada — pendente de aprovação do gestor."
              : "Correção salva no aparelho — vai ao gestor ao reconectar.",
          );
          recarregar();
          recarregarSolicitacoes();
        }}
      />
    </div>
  );
}
