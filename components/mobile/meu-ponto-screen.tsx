"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Camera, ChevronRight, Download } from "lucide-react";

import { FieldHeader } from "@/components/mobile/field-header";
import { PageBackHeader } from "@/components/mobile/page-back-header";
import { PhotoUpload } from "@/components/mobile/photo-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { configuracoesApi, type EmpresaConfig } from "@/lib/api/configuracoes";
import {
  pontoApi,
  TIPOS_PONTO,
  type PontoRegistro,
  type TipoPonto,
} from "@/lib/api/ponto";
import { enqueue, flushOutbox } from "@/lib/offline/outbox";
import { limparCpf } from "@/lib/ponto/cpf";
import { baixarCRPT, montarCRPT, podeEmitirCRPT } from "@/lib/ponto/crpt";
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

function selo(reg: BatidaEfetiva): { label: string; classe: string } {
  if (reg.ajustePendente)
    return { label: "Ajuste pendente", classe: "text-amber-500" };
  return { label: "Registrado", classe: "text-success" };
}

export function MeuPontoScreen() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [todas, setTodas] = useState<PontoRegistro[]>([]);
  const [empresa, setEmpresa] = useState<EmpresaConfig | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [batendo, setBatendo] = useState<TipoPonto | null>(null);
  const [foto, setFoto] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const u = getSessionUser();
    if (!u) {
      router.replace("/");
      return;
    }
    try {
      const [lista, emp] = await Promise.all([
        pontoApi.listar(u.prefeituraId),
        configuracoesApi.obterEmpresa(u.prefeituraId),
      ]);
      setUser(u);
      setTodas(lista.filter((r) => ehDoOperador(r, u)));
      setEmpresa(emp);
      setErro("");
    } catch {
      setUser(u);
      setErro("Não foi possível carregar suas batidas. Verifique a conexão.");
    } finally {
      setCarregando(false);
    }
  }, [router]);

  useEffect(() => {
    queueMicrotask(() => void carregar());
  }, [carregar]);

  const efetivas = useMemo(() => resolverLedger(todas), [todas]);

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
    if (!foto) {
      setErro("Capture a selfie antes de confirmar.");
      return;
    }
    setSalvando(true);
    try {
      await enqueue("ponto", {
        name: user.nome,
        photo: foto,
        prefeituraId: user.prefeituraId,
        timestampOriginal: new Date().toISOString(),
        tipo: batendo,
        cpf: user.cpf,
      });
      setBatendo(null);
      setFoto("");
      await flushOutbox();
      await carregar();
    } catch {
      setErro("Não foi possível registrar a batida. Tente de novo.");
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

      {/* Folha do dia */}
      <Card className="ring-border/50">
        <CardContent className="space-y-1 pt-0">
          <h2 className="pb-1 text-sm font-semibold">Hoje</h2>
          {TIPOS_PONTO.map(({ tipo, label }) => {
            const reg = porTipoHoje.get(tipo);
            const s = reg ? selo(reg) : null;
            return (
              <div key={tipo} className="border-t border-border py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{label}</p>
                    <p className={`text-xs ${s ? s.classe : "text-muted-foreground"}`}>
                      {reg ? `${horaDe(reg.timestampOriginal)} · ${s!.label}` : "Sem registro"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {reg && podeEmitirCRPT(reg) ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => void baixarComprovante(reg)}
                      >
                        <Download className="size-3.5" aria-hidden />
                        Comprovante
                      </Button>
                    ) : null}
                    {!reg ? (
                      <Button
                        type="button"
                        variant="brand"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => iniciarBater(tipo)}
                        disabled={batendo === tipo}
                      >
                        <Camera className="size-3.5" aria-hidden />
                        Bater
                      </Button>
                    ) : null}
                  </div>
                </div>

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
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Histórico */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Histórico</h2>
        {carregando ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : historico.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma batida em dias anteriores.
          </p>
        ) : (
          historico.map(({ dia, batidas }) => (
            <Card key={dia} className="ring-border/50">
              <CardContent className="space-y-1 pt-0">
                <p className="pb-1 text-xs font-semibold capitalize text-muted-foreground">
                  {dataLabel(dia)}
                </p>
                {batidas.map((b) => {
                  const label =
                    TIPOS_PONTO.find((t) => t.tipo === b.tipo)?.label ?? b.tipo;
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
                })}
              </CardContent>
            </Card>
          ))
        )}
      </div>

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
    </div>
  );
}
