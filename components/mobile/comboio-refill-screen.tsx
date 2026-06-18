"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert, Wifi } from "lucide-react";

import { FieldHeader } from "@/components/mobile/field-header";
import { FormFieldLabel } from "@/components/mobile/form-field-label";
import { InputWithSuffix } from "@/components/mobile/input-with-suffix";
import { PageBackHeader } from "@/components/mobile/page-back-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ORIGENS_CARGA,
  type ReabastecimentoSource,
} from "@/lib/api/reabastecimento";
import { ComboioSelect } from "@/components/mobile/comboio-select";
import { useComboios } from "@/lib/data/queries";
import { revalidarFrota } from "@/lib/data/sync";
import { submit } from "@/lib/offline/outbox";
import { capacidadeDisponivel } from "@/lib/offline/pendentes";
import { useOutboxRaw } from "@/lib/offline/use-outbox";
import { setFlash } from "@/lib/flash";
import {
  getComboioSelecionado,
  getSessionUser,
  setComboioSelecionado,
  type SessionUser,
} from "@/lib/session";

export function ComboioRefillScreen() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [comboioId, setComboioId] = useState("");
  const [source, setSource] = useState<ReabastecimentoSource>("gasStation");
  const [liters, setLiters] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  // Leitura offline-first: cache na hora, revalida em background.
  const { data } = useComboios(user?.prefeituraId, user?.funcionarioId);
  const comboios = useMemo(() => data ?? [], [data]);
  const nome = user?.nome ?? "";

  // Quanto ainda cabe no tanque (capacidade − saldo otimista). Capacidade
  // ausente/0 ⇒ Infinity (sem limite) — não trava comboio sem capacidadeTanque.
  const raw = useOutboxRaw();
  const comboioSel = comboios.find((c) => c.id === comboioId) ?? null;
  const litrosNum = Number(liters);
  const cabe = comboioSel
    ? capacidadeDisponivel(
        comboioSel.tank.capacity,
        comboioSel.tank.currentVolume,
        raw,
      )
    : Infinity;
  const temLimite = Number.isFinite(cabe);
  const estouraCapacidade = temLimite && litrosNum > 0 && litrosNum > cabe;

  useEffect(() => {
    const u = getSessionUser();
    if (!u?.prefeituraId || !u.funcionarioId) {
      router.push("/");
      return;
    }
    queueMicrotask(() => setUser(u));
  }, [router]);

  // Seleciona o comboio salvo (ou o primeiro) quando a lista chega.
  useEffect(() => {
    if (comboios.length === 0) return;
    queueMicrotask(() =>
      setComboioId((atual) => {
        if (atual && comboios.some((c) => c.id === atual)) return atual;
        const salvo = getComboioSelecionado();
        return (
          (salvo && comboios.some((c) => c.id === salvo) && salvo) ||
          comboios[0]?.id ||
          ""
        );
      }),
    );
  }, [comboios]);

  function trocarComboio(id: string) {
    setComboioId(id);
    setComboioSelecionado(id);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    setSucesso("");

    if (!comboioId) {
      setErro("Selecione o comboio que está reabastecendo.");
      return;
    }
    if (!(litrosNum > 0)) {
      setErro("Informe os litros recebidos.");
      return;
    }
    if (estouraCapacidade) {
      setErro(
        `Acima da capacidade do tanque. Cabe no máximo ${cabe.toLocaleString("pt-BR")} L.`,
      );
      return;
    }

    const user = getSessionUser();
    if (!user?.prefeituraId) {
      setErro("Sessão expirada. Faça login novamente.");
      return;
    }

    setIsSaving(true);
    try {
      const { synced } = await submit("reabastecimento", {
        prefeituraId: user.prefeituraId,
        comboioId,
        funcionarioId: user.funcionarioId,
        sourceType: source,
        receivedLiters: litrosNum,
        invoiceNumber: invoiceNumber.trim() || undefined,
      });
      // Revalida o saldo do comboio (ignora o TTL) pro dashboard refletir a nova
      // carga na hora — o syncAll normal pularia por achar o cache fresco.
      void revalidarFrota(user);
      // Volta pro início: o dashboard mostra o tanque atualizado e o lançamento.
      setFlash(
        synced
          ? "Carga registrada no comboio"
          : "Salvo no aparelho — sincroniza sozinho",
      );
      router.replace("/dashboard");
      return;
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <FieldHeader nome={nome} />

      <PageBackHeader eyebrow="Lançamento" title="Reabastecer comboio" />

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <FormFieldLabel htmlFor="comboio" required>
            Comboio
          </FormFieldLabel>
          <ComboioSelect
            id="comboio"
            comboios={comboios}
            value={comboioId}
            onChange={trocarComboio}
            disabled={comboios.length === 0}
            placeholder={
              comboios.length
                ? "Selecione o comboio"
                : "Nenhum comboio disponível"
            }
          />
        </div>

        <div className="space-y-2">
          <FormFieldLabel htmlFor="source" required>
            Origem da carga
          </FormFieldLabel>
          <Select
            value={source}
            onValueChange={(v) => setSource(v as ReabastecimentoSource)}
          >
            <SelectTrigger id="source" className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORIGENS_CARGA.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <FormFieldLabel htmlFor="liters" required>
            Litros recebidos
          </FormFieldLabel>
          <InputWithSuffix
            id="liters"
            name="liters"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.1"
            placeholder="0"
            suffix="L"
            value={liters}
            onChange={(e) => setLiters(e.target.value)}
            required
          />
          {temLimite ? (
            estouraCapacidade ? (
              <p className="flex items-start gap-1.5 text-xs text-amber-500">
                <TriangleAlert
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden
                />
                Acima da capacidade do tanque. Cabe no máximo{" "}
                {cabe.toLocaleString("pt-BR")} L.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Cabe no máximo {cabe.toLocaleString("pt-BR")} L.
              </p>
            )
          ) : null}
        </div>

        <div className="space-y-2">
          <FormFieldLabel htmlFor="invoice">Nota fiscal</FormFieldLabel>
          <Input
            id="invoice"
            name="invoice"
            placeholder="Ex.: NF 0455123"
            className="h-11 md:text-base"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
          />
        </div>

        {erro ? (
          <p className="text-sm text-destructive" role="alert">
            {erro}
          </p>
        ) : null}
        {sucesso ? (
          <p className="text-sm font-medium text-emerald-500" role="status">
            {sucesso}
          </p>
        ) : null}

        <div className="space-y-3 pt-2">
          <Button
            type="submit"
            variant="brand"
            className="h-12 w-full text-sm font-semibold uppercase tracking-wide"
            disabled={isSaving || estouraCapacidade}
          >
            {isSaving ? "Salvando…" : "Salvar carga"}
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <Wifi className="size-3.5 shrink-0" aria-hidden />
            Funciona offline — sincroniza sozinho quando voltar o sinal.
          </p>
        </div>
      </form>
    </div>
  );
}
