"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";

import { DiaDetalhe } from "@/components/mobile/dia-detalhe";
import { EditarBatidaSheet } from "@/components/mobile/editar-batida-sheet";
import {
  IncluirBatidaSheet,
  type IncluirAberto,
} from "@/components/mobile/incluir-batida-sheet";
import { PageBackHeader } from "@/components/mobile/page-back-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { type PontoRegistro } from "@/lib/api/ponto";
import { useAbonos, useEscala, useTimeRecords } from "@/lib/data/queries";
import { batidasPendentes, mesclarBatidas } from "@/lib/offline/pendentes";
import { useOutboxRaw } from "@/lib/offline/use-outbox";
import { formatarCpf, limparCpf } from "@/lib/ponto/cpf";
import {
  ESPELHO_COLUNAS,
  ESPELHO_PESOS,
  abonosNoPeriodo,
  construirEspelho,
  dataBr,
  diasNoIntervalo,
  diasNoPeriodo,
  intervaloPreset,
  type PeriodoPreset,
} from "@/lib/ponto/espelho";
import { fmtMin, minutosPrevistos, minutosTrabalhados } from "@/lib/ponto/horas";
import { baixarPDFTabela } from "@/lib/export/pdf-tabela";
import { resolverLedger, type BatidaEfetiva } from "@/lib/ponto/resolver-ledger";
import { getSessionUser, type SessionUser } from "@/lib/session";

function diaLocal(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}

function horaDe(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function rotuloMes(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function isoHoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ehDoOperador(r: PontoRegistro, user: SessionUser): boolean {
  const cpf = limparCpf(user.cpf ?? "");
  if (cpf && r.cpf) return limparCpf(String(r.cpf)) === cpf;
  return (
    (r.name ?? "").trim().toLowerCase() === (user.nome ?? "").trim().toLowerCase()
  );
}

export function EspelhoScreen() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);

  const [mes, setMes] = useState(mesAtual);
  const [diaDetalhe, setDiaDetalhe] = useState<{
    dia: string;
    batidas: BatidaEfetiva[];
  } | null>(null);
  const [editando, setEditando] = useState<PontoRegistro | null>(null);
  const [incluirAberto, setIncluirAberto] = useState<IncluirAberto>(null);
  const [sucesso, setSucesso] = useState("");

  const [expAberto, setExpAberto] = useState(false);
  const [expDe, setExpDe] = useState("");
  const [expAte, setExpAte] = useState("");

  // Leitura offline-first: batidas + escala + abonos cacheados.
  const {
    data: recordsData,
    loading: loadingRecords,
    refetch: recarregar,
  } = useTimeRecords(user?.prefeituraId);
  const { data: escalaData } = useEscala(user?.prefeituraId);
  const { data: abonosData } = useAbonos(user?.prefeituraId);
  const escala = escalaData ?? null;
  const abonos = useMemo(() => abonosData ?? [], [abonosData]);
  const carregando = !user || loadingRecords;

  // Otimismo de UI: batidas ainda na fila aparecem no espelho (não editáveis).
  const raw = useOutboxRaw();
  const pendentes = useMemo(() => batidasPendentes(raw), [raw]);
  const pendentesIds = useMemo(
    () => new Set(pendentes.map((b) => b.id)),
    [pendentes],
  );
  const todas = useMemo(
    () =>
      user
        ? mesclarBatidas(
            (recordsData ?? []).filter((r) => ehDoOperador(r, user)),
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

  const efetivas = useMemo(() => resolverLedger(todas), [todas]);

  const abonosDoMes = useMemo(() => {
    const cpf = limparCpf(user?.cpf ?? "");
    const out = new Map<string, string | null | undefined>();
    if (!cpf || !abonos.length) return out;
    for (const a of abonos) {
      if (limparCpf(a.funcionarioCpf) !== cpf) continue;
      if (!a.data.startsWith(mes)) continue;
      out.set(a.data, a.motivo);
    }
    return out;
  }, [abonos, user, mes]);

  const diasMes = useMemo(() => {
    const map = new Map<string, BatidaEfetiva[]>();
    const [ano, mesNum] = mes.split("-").map(Number);
    const agora = new Date();
    const ehFuturo =
      ano > agora.getFullYear() ||
      (ano === agora.getFullYear() && mesNum > agora.getMonth() + 1);
    const ehMesAtual =
      ano === agora.getFullYear() && mesNum === agora.getMonth() + 1;
    const ultimoDia = new Date(ano, mesNum, 0).getDate();
    const diaLimite = ehFuturo ? 0 : ehMesAtual ? agora.getDate() : ultimoDia;
    for (let d = 1; d <= diaLimite; d++) {
      map.set(`${mes}-${String(d).padStart(2, "0")}`, []);
    }
    for (const b of efetivas) {
      const dia = diaLocal(b.timestampOriginal);
      if (!dia.startsWith(mes)) continue;
      const arr = map.get(dia) ?? [];
      arr.push(b);
      map.set(dia, arr);
    }
    for (const data of abonosDoMes.keys()) {
      if (!map.has(data)) map.set(data, []);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [efetivas, abonosDoMes, mes]);

  const totais = useMemo(() => {
    let trab = 0;
    let prev = 0;
    for (const [dia, bs] of diasMes) {
      const trabBruto = minutosTrabalhados(bs, escala?.almocoMinutos ?? 0);
      const previsto = minutosPrevistos(escala, dia);
      const abonado = abonosDoMes.has(dia) && trabBruto < previsto;
      trab += abonado ? previsto : trabBruto;
      prev += previsto;
    }
    return { trab, prev, saldo: trab - prev };
  }, [diasMes, escala, abonosDoMes]);

  const presets = useMemo(() => {
    const hoje = new Date();
    return (
      [
        { key: "hoje", label: "Hoje" },
        { key: "semana", label: "Semana" },
        { key: "mes", label: "Este mês" },
        { key: "mes-anterior", label: "Mês anterior" },
      ] as { key: PeriodoPreset; label: string }[]
    ).map((p) => ({ ...p, ...intervaloPreset(p.key, hoje) }));
  }, []);

  function mudarMes(delta: number) {
    const [y, m] = mes.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  function abrirExport() {
    const [y, m] = mes.split("-").map(Number);
    const ultimo = new Date(y, m, 0).getDate();
    setExpDe(`${mes}-01`);
    setExpAte(`${mes}-${String(ultimo).padStart(2, "0")}`);
    setExpAberto(true);
  }

  async function gerarExport() {
    if (!expDe || !expAte || expDe > expAte) return;
    const abonosDias = abonosNoPeriodo(abonos, user?.cpf, expDe, expAte);
    const dias = diasNoPeriodo(efetivas, abonosDias, expDe, expAte, isoHoje());
    const { linhas, totais: totaisLinha } = construirEspelho(
      dias,
      abonosDias,
      escala,
    );
    const subtitulo = [
      user?.cpf ? `CPF ${formatarCpf(user.cpf)}` : null,
      `Período: ${dataBr(expDe)} a ${dataBr(expAte)}`,
    ]
      .filter(Boolean)
      .join(" · ");
    const arquivo = `espelho-${(user?.nome || "funcionario")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")}-${expDe}_a_${expAte}`;
    await baixarPDFTabela(arquivo, {
      titulo: `Espelho de ponto — ${user?.nome || "—"}`,
      subtitulo,
      colunas: ESPELHO_COLUNAS,
      linhas,
      totais: totaisLinha,
      pesos: ESPELHO_PESOS,
    });
    setExpAberto(false);
  }

  if (diaDetalhe) {
    return (
      <div className="space-y-4">
        {sucesso ? (
          <p
            className="mx-auto max-w-lg rounded-lg bg-success/10 px-3 py-2 text-sm text-success"
            role="status"
          >
            {sucesso}
          </p>
        ) : null}
        <DiaDetalhe
          dia={diaDetalhe.dia}
          batidas={diaDetalhe.batidas}
          onVoltar={() => setDiaDetalhe(null)}
          onEditar={(b) => {
            // Batida ainda na fila não pode ser corrigida (id é do outbox, não
            // existe no servidor) — ignora até sincronizar.
            if (!pendentesIds.has(b.id)) setEditando(b);
          }}
          onIncluir={(dia, tipo) => {
            setSucesso("");
            setIncluirAberto({ data: dia, tipo });
          }}
        />
        <EditarBatidaSheet
          batida={editando}
          onClose={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            setSucesso("Correção enviada — pendente de aprovação do gestor.");
            recarregar();
          }}
        />
        {user ? (
          <IncluirBatidaSheet
            aberto={incluirAberto}
            onClose={() => setIncluirAberto(null)}
            onEnviado={(msg) => {
              setIncluirAberto(null);
              setSucesso(msg);
              recarregar();
            }}
            prefeituraId={user.prefeituraId}
            nome={user.nome}
            cpf={user.cpf}
          />
        ) : null}
      </div>
    );
  }

  const totalDias = diasNoIntervalo(expDe, expAte);
  const presetAtivo =
    presets.find((p) => p.de === expDe && p.ate === expAte)?.key ?? null;

  return (
    <div className="mx-auto w-full max-w-lg space-y-5">
      <PageBackHeader
        eyebrow="Registro de ponto"
        title="Espelho detalhado"
        backHref="/meu-ponto"
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Mês anterior"
            onClick={() => mudarMes(-1)}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <strong className="min-w-36 text-center text-sm font-semibold capitalize">
            {rotuloMes(mes)}
          </strong>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Próximo mês"
            onClick={() => mudarMes(1)}
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
        <Button
          variant="brand"
          size="sm"
          className="gap-1.5"
          onClick={abrirExport}
        >
          <Download className="size-4" aria-hidden />
          PDF
        </Button>
      </div>

      <Card className="ring-border/50">
        <CardContent className="grid grid-cols-3 gap-2 pt-0 text-center">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Trabalhado
            </p>
            <p className="tabular-nums text-base font-semibold">
              {fmtMin(totais.trab)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Previsto
            </p>
            <p className="tabular-nums text-base font-semibold">
              {fmtMin(totais.prev)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Saldo
            </p>
            <p
              className={`tabular-nums text-base font-semibold ${
                totais.saldo < 0 ? "text-destructive" : "text-success"
              }`}
            >
              {totais.saldo >= 0 ? "+" : ""}
              {fmtMin(totais.saldo)}
            </p>
          </div>
        </CardContent>
      </Card>

      {carregando ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : diasMes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sem dias para mostrar neste mês.
        </p>
      ) : (
        <div className="space-y-2">
          {diasMes.map(([dia, bs]) => {
            const tipos: Record<string, string> = {};
            for (const b of bs) tipos[b.tipo] = horaDe(b.timestampOriginal);
            const trabBruto = minutosTrabalhados(bs, escala?.almocoMinutos ?? 0);
            const prev = minutosPrevistos(escala, dia);
            const abonado = abonosDoMes.has(dia) && trabBruto < prev;
            const trab = abonado ? prev : trabBruto;
            const saldo = trab - prev;
            const [, , d] = dia.split("-");
            const dow = new Date(`${dia}T12:00:00`).toLocaleDateString("pt-BR", {
              weekday: "short",
            });
            return (
              <button
                key={dia}
                type="button"
                onClick={() => setDiaDetalhe({ dia, batidas: bs })}
                className="w-full rounded-xl border border-border bg-card/40 p-3 text-left transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold tabular-nums">
                      {d}
                    </span>
                    <span className="text-xs capitalize text-muted-foreground">
                      {dow}
                    </span>
                    {abonado ? (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">
                        Abonado
                      </span>
                    ) : null}
                  </div>
                  <span
                    className={`tabular-nums text-xs font-semibold ${
                      saldo < 0 ? "text-destructive" : "text-success"
                    }`}
                  >
                    {saldo >= 0 ? "+" : ""}
                    {fmtMin(saldo)}
                  </span>
                </div>
                <div className="mt-1.5 grid grid-cols-4 gap-1 text-center text-[11px]">
                  {(["entrada", "almoco", "volta", "saida"] as const).map((t) => (
                    <div key={t} className="rounded bg-muted/30 py-1">
                      <span className="block text-[9px] uppercase text-muted-foreground">
                        {t === "entrada"
                          ? "Ent"
                          : t === "almoco"
                            ? "Alm"
                            : t === "volta"
                              ? "Vol"
                              : "Saí"}
                      </span>
                      <span className="tabular-nums">{tipos[t] ?? "—"}</span>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {expAberto ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-label="Exportar espelho em PDF"
          onClick={() => setExpAberto(false)}
        >
          <div
            className="w-full max-w-lg space-y-4 rounded-t-2xl border-t border-border bg-card p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Exportar PDF</h2>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setExpAberto(false)}
                className="flex size-8 items-center justify-center rounded-full hover:bg-muted"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    setExpDe(p.de);
                    setExpAte(p.ate);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    presetAtivo === p.key
                      ? "border-brand bg-brand/15 text-brand"
                      : "border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground">De</span>
                <input
                  type="date"
                  value={expDe}
                  max={expAte || undefined}
                  onChange={(e) => setExpDe(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground">Até</span>
                <input
                  type="date"
                  value={expAte}
                  min={expDe || undefined}
                  onChange={(e) => setExpAte(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </label>
            </div>

            <p className="text-xs text-muted-foreground">
              {totalDias > 0
                ? `${dataBr(expDe)} a ${dataBr(expAte)} · ${totalDias} ${
                    totalDias === 1 ? "dia" : "dias"
                  }`
                : "Selecione um período válido."}
            </p>

            <Button
              type="button"
              variant="brand"
              className="w-full gap-2"
              disabled={totalDias === 0}
              onClick={() => void gerarExport()}
            >
              <Download className="size-4" aria-hidden />
              Gerar PDF
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
